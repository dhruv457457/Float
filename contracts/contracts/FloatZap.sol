// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// ─────────────────────────────────────────────────────────────────
//  FloatZap.sol — deposit ANY token into YO Protocol vaults
//  Compiler: 0.8.28, Optimizer: 200 runs
// ─────────────────────────────────────────────────────────────────

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function allowance(address owner, address spender) external view returns (uint256);
    function decimals() external view returns (uint8);
}

interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IYoVault {
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    function asset() external view returns (address);
    function totalAssets() external view returns (uint256);
    function convertToShares(uint256 assets) external view returns (uint256);
    function convertToAssets(uint256 shares) external view returns (uint256);
}

interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params)
        external payable returns (uint256 amountOut);

    struct ExactInputParams {
        bytes   path;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
    }
    function exactInput(ExactInputParams calldata params)
        external payable returns (uint256 amountOut);
}

contract FloatZap {

    // ── Base mainnet — checksummed addresses ──────────────────────
    ISwapRouter public constant SWAP_ROUTER =
        ISwapRouter(0x2626664c2603336E57B271c5C0b26F421741e481);

    IWETH public constant WETH =
        IWETH(0x4200000000000000000000000000000000000006);

    IERC20 public constant USDC =
        IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    // ✅ Fixed checksum
    IERC20 public constant cbBTC =
        IERC20(0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf);

    // ── YO Protocol vaults ────────────────────────────────────────
    IYoVault public constant yoUSD =
        IYoVault(0x0000000f2eB9f69274678c76222B35eEc7588a65);

    // ✅ Fixed checksum
    IYoVault public constant yoETH =
        IYoVault(0x3A43AEC53490CB9Fa922847385D82fe25d0E9De7);

    IYoVault public constant yoBTC =
IYoVault(0xbCbc8cb4D1e8ED048a6276a5E94A3e952660BcbC);
    // ── Uniswap V3 fees ───────────────────────────────────────────
    uint24 public constant FEE_STABLE = 500;
    uint24 public constant FEE_MEDIUM = 3000;

    // ── Admin ─────────────────────────────────────────────────────
    address public owner;
    uint256 public protocolFeeBps = 0;

    // ── Events ────────────────────────────────────────────────────
    event ZapIn(
        address indexed user,
        address indexed tokenIn,
        uint256 amountIn,
        address indexed vault,
        uint256 sharesReceived,
        uint256 assetSwapped
    );
    event ZapOut(
        address indexed user,
        address indexed vault,
        uint256 shares,
        address tokenOut,
        uint256 amountOut
    );

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // ─────────────────────────────────────────────────────────────
    //  ZAP IN — tokenIn = address(0) for native ETH
    // ─────────────────────────────────────────────────────────────
    function zapIn(
        address tokenIn,
        uint256 amountIn,
        address vault,
        uint256 minShares
    ) external payable returns (uint256 shares) {
        address vaultAsset = IYoVault(vault).asset();
        uint256 vaultAssetAmount;

        if (tokenIn == address(0)) {
            require(msg.value > 0, "no ETH sent");
            amountIn = msg.value;
            WETH.deposit{value: amountIn}();
            tokenIn = address(WETH);
        } else {
            require(amountIn > 0, "zero amount");
            IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        }

        vaultAssetAmount = (tokenIn == vaultAsset)
            ? amountIn
            : _swapToVaultAsset(tokenIn, vaultAsset, amountIn, vault);

        IERC20(vaultAsset).approve(vault, vaultAssetAmount);
        shares = IYoVault(vault).deposit(vaultAssetAmount, msg.sender);
        require(shares >= minShares, "FloatZap: slippage");

        emit ZapIn(msg.sender, tokenIn, amountIn, vault, shares, vaultAssetAmount);
    }

    // ─────────────────────────────────────────────────────────────
    //  ZAP OUT — tokenOut = address(0) for native ETH
    // ─────────────────────────────────────────────────────────────
    function zapOut(
        address vault,
        uint256 shares,
        address tokenOut,
        uint256 minOut
    ) external returns (uint256 amountOut) {
        address vaultAsset = IYoVault(vault).asset();
        IERC20(vault).transferFrom(msg.sender, address(this), shares);
        uint256 assetsOut = IYoVault(vault).redeem(shares, address(this), address(this));

        if (tokenOut == address(0) || tokenOut == address(WETH)) {
            if (vaultAsset != address(WETH)) {
                assetsOut = _swapExact(vaultAsset, address(WETH), assetsOut, FEE_STABLE);
            }
            if (tokenOut == address(0)) {
                WETH.withdraw(assetsOut);
                (bool ok,) = msg.sender.call{value: assetsOut}("");
                require(ok, "ETH transfer failed");
            } else {
                IERC20(address(WETH)).transfer(msg.sender, assetsOut);
            }
            amountOut = assetsOut;
        } else if (tokenOut == vaultAsset) {
            IERC20(vaultAsset).transfer(msg.sender, assetsOut);
            amountOut = assetsOut;
        } else {
            amountOut = _swapExact(vaultAsset, tokenOut, assetsOut, FEE_MEDIUM);
            IERC20(tokenOut).transfer(msg.sender, amountOut);
        }

        require(amountOut >= minOut, "FloatZap: slippage out");
        emit ZapOut(msg.sender, vault, shares, tokenOut, amountOut);
    }

    // ─────────────────────────────────────────────────────────────
    //  INTERNAL
    // ─────────────────────────────────────────────────────────────
    function _swapToVaultAsset(
        address tokenIn,
        address vaultAsset,
        uint256 amountIn,
        address vault
    ) internal returns (uint256 amountOut) {
        if (vault == address(yoUSD)) {
            if (tokenIn == address(WETH)) {
                amountOut = _swapExact(tokenIn, address(USDC), amountIn, FEE_STABLE);
            } else if (tokenIn == address(cbBTC)) {
                amountOut = _swapMultiHop(tokenIn, address(WETH), address(USDC), FEE_MEDIUM, FEE_STABLE, amountIn);
            } else {
                amountOut = _swapExact(tokenIn, address(USDC), amountIn, FEE_MEDIUM);
            }
        } else if (vault == address(yoETH)) {
            uint24 fee = (tokenIn == address(USDC)) ? FEE_STABLE : FEE_MEDIUM;
            amountOut = _swapExact(tokenIn, address(WETH), amountIn, fee);
        } else if (vault == address(yoBTC)) {
            if (tokenIn == address(USDC)) {
                amountOut = _swapMultiHop(address(USDC), address(WETH), address(cbBTC), FEE_STABLE, FEE_MEDIUM, amountIn);
            } else {
                amountOut = _swapExact(tokenIn, address(cbBTC), amountIn, FEE_MEDIUM);
            }
        } else {
            revert("FloatZap: unsupported vault");
        }
    }

    function _swapExact(
        address tokenIn, address tokenOut, uint256 amountIn, uint24 fee
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).approve(address(SWAP_ROUTER), amountIn);
        amountOut = SWAP_ROUTER.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: tokenIn, tokenOut: tokenOut, fee: fee,
                recipient: address(this), amountIn: amountIn,
                amountOutMinimum: 0, sqrtPriceLimitX96: 0
            })
        );
    }

    function _swapMultiHop(
        address tokenIn, address tokenMid, address tokenOut,
        uint24 fee1, uint24 fee2, uint256 amountIn
    ) internal returns (uint256 amountOut) {
        IERC20(tokenIn).approve(address(SWAP_ROUTER), amountIn);
        amountOut = SWAP_ROUTER.exactInput(
            ISwapRouter.ExactInputParams({
                path: abi.encodePacked(tokenIn, fee1, tokenMid, fee2, tokenOut),
                recipient: address(this), amountIn: amountIn, amountOutMinimum: 0
            })
        );
    }

    // ─────────────────────────────────────────────────────────────
    //  ADMIN
    // ─────────────────────────────────────────────────────────────
    function setProtocolFee(uint256 bps) external onlyOwner {
        require(bps <= 100, "max 1%");
        protocolFeeBps = bps;
    }

    function rescueToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    receive() external payable {}
}
