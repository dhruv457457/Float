import { createYoClient, VAULTS } from '@yo-protocol/core'
import type { VaultSnapshot } from '@yo-protocol/core'

export const VAULT_ADDRESSES = {
  yoUSD: '0x0000000f2eb9f69274678c76222b35eec7588a65',
  yoETH: '0x3a43aec53490cb9fa922847385d82fe25d0e9de7',
  yoBTC: '0xbcbc8cb4d1e8ed048a6276a5e94a3e952660bcbc',
} as const

export const VAULT_DECIMALS: Record<string, number> = {
  yoUSD: 6,
  yoETH: 18,
  yoBTC: 8,
}

export const UNDERLYING_ADDRESSES: Record<string, `0x${string}`> = {
  yoUSD: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  yoETH: '0x4200000000000000000000000000000000000006',
  yoBTC: '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf',
}

export const yoClient = createYoClient({ chainId: 8453 })

export async function getVaultAPY(vault: keyof typeof VAULT_ADDRESSES): Promise<number | null> {
  try {
    const snapshot: VaultSnapshot = await yoClient.getVaultSnapshot(VAULT_ADDRESSES[vault])
    return snapshot.apy
  } catch {
    return null
  }
}

export async function getVaultSnapshot(vault: keyof typeof VAULT_ADDRESSES) {
  try {
    return await yoClient.getVaultSnapshot(VAULT_ADDRESSES[vault])
  } catch {
    return null
  }
}

export async function getAllVaultSnapshots() {
  const vaults = ['yoUSD', 'yoETH', 'yoBTC'] as const
  const results = await Promise.allSettled(
    vaults.map(v => yoClient.getVaultSnapshot(VAULT_ADDRESSES[v]))
  )
  return vaults.map((v, i) => ({
    id: v,
    snapshot: results[i].status === 'fulfilled' ? results[i].value : null,
  }))
}
