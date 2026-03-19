// ─────────────────────────────────────────────────────────────────
//  lib/contracts.ts — deployed on Base mainnet
// ─────────────────────────────────────────────────────────────────

// ── Deployed contract addresses ──────────────────────────────────
export const FLOAT_ZAP_ADDRESS =
  '0x0BE25e03Bec708aCFb2f74C9f99986453702D27C' as `0x${string}`

export const FLOAT_OPTIMIZER_ADDRESS =
  '0xABcD707afA9548AAEa0eA3f909bE08c793C64214' as `0x${string}`

// ── BaseScan links ────────────────────────────────────────────────
export const BASESCAN = {
  floatZap:       `https://basescan.org/address/${FLOAT_ZAP_ADDRESS}`,
  floatOptimizer: `https://basescan.org/address/${FLOAT_OPTIMIZER_ADDRESS}`,
}

// ── Token addresses on Base mainnet (checksummed) ─────────────────
export const TOKENS = {
  ETH: {
    address: '0x0000000000000000000000000000000000000000' as `0x${string}`,
    symbol: 'ETH',
    decimals: 18,
    isNative: true,
  },
  WETH: {
    address: '0x4200000000000000000000000000000000000006' as `0x${string}`,
    symbol: 'WETH',
    decimals: 18,
    isNative: false,
  },
  USDC: {
    address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
    symbol: 'USDC',
    decimals: 6,
    isNative: false,
  },
  cbBTC: {
    address: '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf' as `0x${string}`,
    symbol: 'cbBTC',
    decimals: 8,
    isNative: false,
  },
}

// ── YO Vault addresses (checksummed) ─────────────────────────────
export const YO_VAULTS = {
  yoUSD: '0x0000000f2eB9f69274678c76222B35eEc7588a65' as `0x${string}`,
  yoETH: '0x3A43AEC53490CB9Fa922847385D82fe25d0E9De7' as `0x${string}`,
  yoBTC: '0xbCbc8cb4D1e8ED048a6276a5E94A3e952660BcbC' as `0x${string}`,
}

// ── FloatZap ABI ─────────────────────────────────────────────────
export const FLOAT_ZAP_ABI = [
  {
    name: 'zapIn',
    type: 'function',
    stateMutability: 'payable',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'vault', type: 'address' },
      { name: 'minShares', type: 'uint256' },
    ],
    outputs: [{ name: 'shares', type: 'uint256' }],
  },
  {
    name: 'zapOut',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'tokenOut', type: 'address' },
      { name: 'minOut', type: 'uint256' },
    ],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    name: 'previewZapIn',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'tokenIn', type: 'address' },
      { name: 'usdcEquivalent', type: 'uint256' },
      { name: 'vault', type: 'address' },
    ],
    outputs: [{ name: 'estimatedShares', type: 'uint256' }],
  },
  {
    name: 'ZapIn',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'tokenIn', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'vault', type: 'address', indexed: true },
      { name: 'sharesReceived', type: 'uint256', indexed: false },
      { name: 'assetSwapped', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'ZapOut',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'vault', type: 'address', indexed: true },
      { name: 'shares', type: 'uint256', indexed: false },
      { name: 'tokenOut', type: 'address', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
    ],
  },
] as const

// ── FloatOptimizer ABI ───────────────────────────────────────────
export const FLOAT_OPTIMIZER_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'matureAt', type: 'uint256' },
      { name: 'label', type: 'string' },
    ],
    outputs: [{ name: 'positionId', type: 'uint256' }],
  },
  {
    name: 'redeem',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{ name: 'totalUSDC', type: 'uint256' }],
  },
  {
    name: 'rebalance',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'positionId', type: 'uint256' },
      { name: 'fromVault', type: 'address' },
      { name: 'toVault', type: 'address' },
      { name: 'sharesToMove', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'getUserPositions',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256[]' }],
  },
  {
    name: 'getPosition',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'sharesYoUSD', type: 'uint256' },
        { name: 'sharesYoETH', type: 'uint256' },
        { name: 'sharesYoBTC', type: 'uint256' },
        { name: 'depositedUSDC', type: 'uint256' },
        { name: 'depositedAt', type: 'uint256' },
        { name: 'matureAt', type: 'uint256' },
        { name: 'label', type: 'string' },
      ],
    }],
  },
  {
    name: 'getPositionValue',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'positionId', type: 'uint256' }],
    outputs: [
      { name: 'totalValue', type: 'uint256' },
      { name: 'valueYoUSD', type: 'uint256' },
      { name: 'valueYoETH', type: 'uint256' },
      { name: 'valueYoBTC', type: 'uint256' },
    ],
  },
  {
    name: 'previewSplit',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'usdcAmount', type: 'uint256' },
      { name: 'daysUntilMature', type: 'uint256' },
    ],
    outputs: [
      { name: 'amtBest', type: 'uint256' },
      { name: 'amtSecond', type: 'uint256' },
      { name: 'amtThird', type: 'uint256' },
      { name: 'vBest', type: 'address' },
      { name: 'vSecond', type: 'address' },
      { name: 'vThird', type: 'address' },
    ],
  },
  {
    name: 'updateAPYs',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_apyYoUSD', type: 'uint256' },
      { name: '_apyYoETH', type: 'uint256' },
      { name: '_apyYoBTC', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'setSplitWeights',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'best', type: 'uint256' },
      { name: 'second', type: 'uint256' },
      { name: 'third', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    name: 'apyYoUSD',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'apyYoETH',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'apyYoBTC',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'nextPositionId',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    name: 'Deposited',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'usdcAmount', type: 'uint256', indexed: false },
      { name: 'sharesYoUSD', type: 'uint256', indexed: false },
      { name: 'sharesYoETH', type: 'uint256', indexed: false },
      { name: 'sharesYoBTC', type: 'uint256', indexed: false },
      { name: 'matureAt', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Redeemed',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'usdcReturned', type: 'uint256', indexed: false },
      { name: 'yieldEarned', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'Rebalanced',
    type: 'event',
    inputs: [
      { name: 'positionId', type: 'uint256', indexed: true },
      { name: 'fromVault', type: 'address', indexed: false },
      { name: 'toVault', type: 'address', indexed: false },
      { name: 'shares', type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'APYUpdated',
    type: 'event',
    inputs: [
      { name: 'yoUSD', type: 'uint256', indexed: false },
      { name: 'yoETH', type: 'uint256', indexed: false },
      { name: 'yoBTC', type: 'uint256', indexed: false },
    ],
  },
] as const