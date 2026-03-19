// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ─────────────────────────────────────────────────────────────────
//  FloatOptimizer v3 — auto-split USDC across ALL YO vaults
//  Uses FloatZap to swap USDC → WETH/cbBTC before depositing
//  into yoETH/yoBTC. True multi-vault split.
//  Compiler: 0.8.28, viaIR: true, Optimizer: 200 runs
// ─────────────────────────────────────────────────────────────────

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IYoVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256);
    function asset() external view returns (address);
}

// FloatZap — handles token swap + vault deposit in one call
interface IFloatZap {
    function zapIn(
        address tokenIn,
        uint256 amountIn,
        address vault,
        uint256 minShares
    ) external payable returns (uint256 shares);
}

contract FloatOptimizer {

    // ── Base mainnet — checksummed ────────────────────────────────
    IERC20 public constant USDC =
        IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    IYoVault public constant yoUSD =
        IYoVault(0x0000000f2eB9f69274678c76222B35eEc7588a65);

    IYoVault public constant yoETH =
        IYoVault(0x3A43AEC53490CB9Fa922847385D82fe25d0E9De7);

    IYoVault public constant yoBTC =
        IYoVault(0xbCbc8cb4D1e8ED048a6276a5E94A3e952660BcbC);

    // FloatZap — set after deployment
    IFloatZap public floatZap;

    // ── State ─────────────────────────────────────────────────────
    address public owner;

    // APY in basis points: 318 = 3.18%
    uint256 public apyYoUSD = 318;
    uint256 public apyYoETH = 542;
    uint256 public apyYoBTC = 192;

    // Split weights in basis points (must sum to 10000)
    uint256 public splitBest   = 6000;
    uint256 public splitSecond = 3000;
    uint256 public splitThird  = 1000;

    struct Position {
        uint256 sharesYoUSD;
        uint256 sharesYoETH;
        uint256 sharesYoBTC;
        uint256 depositedUSDC;
        uint256 depositedAt;
        uint256 matureAt;
        string  label;
    }

    mapping(uint256 => Position) public positions;
    mapping(uint256 => address)  public positionOwner;
    mapping(address => uint256[]) public userPositions;
    uint256 public nextPositionId;

    // ── Events ────────────────────────────────────────────────────
    event Deposited(
        address indexed user,
        uint256 indexed positionId,
        uint256 usdcAmount,
        uint256 sharesYoUSD,
        uint256 sharesYoETH,
        uint256 sharesYoBTC,
        uint256 matureAt
    );
    event Redeemed(address indexed user, uint256 indexed positionId, uint256 yieldEarned);
    event APYUpdated(uint256 yoUSD, uint256 yoETH, uint256 yoBTC);
    event Rebalanced(uint256 indexed positionId, address fromVault, address toVault);
    event ZapAddressSet(address zap);

    constructor(address _floatZap) {
        owner = msg.sender;
        floatZap = IFloatZap(_floatZap);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  DEPOSIT — splits USDC across vaults using FloatZap routing
    // ─────────────────────────────────────────────────────────────
    function deposit(
        uint256 usdcAmount,
        uint256 matureAt,
        string calldata label
    ) external returns (uint256 positionId) {
        require(usdcAmount > 0, "zero amount");
        require(matureAt > block.timestamp, "deadline in past");

        USDC.transferFrom(msg.sender, address(this), usdcAmount);

        uint256 days_ = (matureAt - block.timestamp) / 1 days;

        positionId = nextPositionId++;
        Position storage p = positions[positionId];
        p.depositedUSDC = usdcAmount;
        p.depositedAt   = block.timestamp;
        p.matureAt      = matureAt;
        p.label         = label;
        positionOwner[positionId] = msg.sender;

        _splitAndDeposit(p, usdcAmount, days_);

        userPositions[msg.sender].push(positionId);

        emit Deposited(msg.sender, positionId, usdcAmount,
            p.sharesYoUSD, p.sharesYoETH, p.sharesYoBTC, matureAt);
    }

    // ─────────────────────────────────────────────────────────────
    //  REDEEM — sends yoTokens directly to user
    //  User receives yoUSD/yoETH/yoBTC tokens, redeems from vault
    // ─────────────────────────────────────────────────────────────
    function redeem(uint256 positionId) external {
        require(positionOwner[positionId] == msg.sender, "not your position");
        Position storage p = positions[positionId];
        require(p.depositedAt > 0, "not found");

        // Send yoTokens directly to user — they redeem from vault
        if (p.sharesYoUSD > 0) {
            IERC20(address(yoUSD)).transfer(msg.sender, p.sharesYoUSD);
            p.sharesYoUSD = 0;
        }
        if (p.sharesYoETH > 0) {
            IERC20(address(yoETH)).transfer(msg.sender, p.sharesYoETH);
            p.sharesYoETH = 0;
        }
        if (p.sharesYoBTC > 0) {
            IERC20(address(yoBTC)).transfer(msg.sender, p.sharesYoBTC);
            p.sharesYoBTC = 0;
        }

        emit Redeemed(msg.sender, positionId, 0);
        p.depositedUSDC = 0;
        p.depositedAt   = 0;
    }

    // ─────────────────────────────────────────────────────────────
    //  INTERNAL — split and deposit via FloatZap
    // ─────────────────────────────────────────────────────────────
    function _splitAndDeposit(
        Position storage p,
        uint256 usdcAmount,
        uint256 daysUntilMature
    ) internal {
        (
            uint256 amtBest, uint256 amtSecond, uint256 amtThird,
            IYoVault vBest, IYoVault vSecond, IYoVault vThird
        ) = _calculateOptimalSplit(usdcAmount, daysUntilMature);

        if (amtBest > 0)   _zapDeposit(p, vBest,   amtBest);
        if (amtSecond > 0) _zapDeposit(p, vSecond, amtSecond);
        if (amtThird > 0)  _zapDeposit(p, vThird,  amtThird);
    }

    // Deposit USDC into any vault — uses FloatZap if vault needs non-USDC
    function _zapDeposit(
        Position storage p,
        IYoVault vault,
        uint256 usdcAmount
    ) internal {
        uint256 shares;

        if (address(vault) == address(yoUSD)) {
            // yoUSD accepts USDC directly — no swap needed
            USDC.approve(address(yoUSD), usdcAmount);
            shares = yoUSD.deposit(usdcAmount, address(this));
            p.sharesYoUSD += shares;
        } else {
            // yoETH / yoBTC need WETH / cbBTC — use FloatZap to swap + deposit
            require(address(floatZap) != address(0), "FloatZap not set");
            USDC.approve(address(floatZap), usdcAmount);
            shares = floatZap.zapIn(
                address(USDC),  // tokenIn = USDC
                usdcAmount,     // amount
                address(vault), // target vault (yoETH or yoBTC)
                0               // minShares (slippage handled by ZapIn)
            );
            // shares are minted to msg.sender (this contract) by FloatZap
            if (address(vault) == address(yoETH)) p.sharesYoETH += shares;
            else if (address(vault) == address(yoBTC)) p.sharesYoBTC += shares;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  INTERNAL — optimal split logic
    // ─────────────────────────────────────────────────────────────
    function _calculateOptimalSplit(
        uint256 totalAmount,
        uint256 daysUntilMature
    ) internal view returns (
        uint256 amtBest, uint256 amtSecond, uint256 amtThird,
        IYoVault vBest, IYoVault vSecond, IYoVault vThird
    ) {
        uint256[3] memory apys    = [apyYoUSD, apyYoETH, apyYoBTC];
        IYoVault[3] memory vaults = [yoUSD, yoETH, yoBTC];

        // Bubble sort descending by APY
        for (uint i = 0; i < 2; i++) {
            for (uint j = 0; j < 2 - i; j++) {
                if (apys[j] < apys[j+1]) {
                    (apys[j], apys[j+1]) = (apys[j+1], apys[j]);
                    (vaults[j], vaults[j+1]) = (vaults[j+1], vaults[j]);
                }
            }
        }

        vBest = vaults[0]; vSecond = vaults[1]; vThird = vaults[2];

        if (daysUntilMature < 14) {
            // Short: 100% yoUSD — safest, avoid swap costs
            vBest = yoUSD; vSecond = yoUSD; vThird = yoUSD;
            amtBest = totalAmount; amtSecond = 0; amtThird = 0;
        } else if (daysUntilMature < 60) {
            amtBest   = (totalAmount * splitBest)   / 10000;
            amtSecond = (totalAmount * splitSecond) / 10000;
            amtThird  = totalAmount - amtBest - amtSecond;
        } else {
            amtBest   = (totalAmount * 7000) / 10000;
            amtSecond = (totalAmount * 2000) / 10000;
            amtThird  = totalAmount - amtBest - amtSecond;
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  VIEW
    // ─────────────────────────────────────────────────────────────
    function getPositionValue(uint256 positionId)
        external view returns (
            uint256 valueYoUSD,
            uint256 valueYoETH,
            uint256 valueYoBTC
        )
    {
        Position storage p = positions[positionId];
        if (p.sharesYoUSD > 0) valueYoUSD = yoUSD.convertToAssets(p.sharesYoUSD);
        if (p.sharesYoETH > 0) valueYoETH = yoETH.convertToAssets(p.sharesYoETH);
        if (p.sharesYoBTC > 0) valueYoBTC = yoBTC.convertToAssets(p.sharesYoBTC);
    }

    function getUserPositions(address user) external view returns (uint256[] memory) {
        return userPositions[user];
    }

    function getPosition(uint256 positionId) external view returns (Position memory) {
        return positions[positionId];
    }

    function previewSplit(uint256 usdcAmount, uint256 daysUntilMature)
        external view returns (
            uint256 amtBest, uint256 amtSecond, uint256 amtThird,
            address vBest, address vSecond, address vThird
        )
    {
        IYoVault _vBest; IYoVault _vSecond; IYoVault _vThird;
        (amtBest, amtSecond, amtThird, _vBest, _vSecond, _vThird) =
            _calculateOptimalSplit(usdcAmount, daysUntilMature);
        vBest = address(_vBest);
        vSecond = address(_vSecond);
        vThird = address(_vThird);
    }

    // ─────────────────────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────────────────────
    function setFloatZap(address _zap) external onlyOwner {
        floatZap = IFloatZap(_zap);
        emit ZapAddressSet(_zap);
    }

    function updateAPYs(uint256 _yoUSD, uint256 _yoETH, uint256 _yoBTC) external onlyOwner {
        apyYoUSD = _yoUSD; apyYoETH = _yoETH; apyYoBTC = _yoBTC;
        emit APYUpdated(_yoUSD, _yoETH, _yoBTC);
    }

    function setSplitWeights(uint256 best, uint256 second, uint256 third) external onlyOwner {
        require(best + second + third == 10000, "must sum to 10000");
        splitBest = best; splitSecond = second; splitThird = third;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }
}
