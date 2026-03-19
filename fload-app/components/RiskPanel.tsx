'use client'

import { useVaultState } from '@yo-protocol/react'
import { useState } from 'react'
import type { VaultId } from '@yo-protocol/core'

const VAULT_INFO: Record<string, { underlying: string; chains: string[]; auditStatus: string }> = {
  yoUSD: { underlying: 'USDC', chains: ['Base', 'Ethereum', 'Arbitrum'], auditStatus: 'Audited' },
  yoETH: { underlying: 'WETH', chains: ['Base', 'Ethereum'], auditStatus: 'Audited' },
  yoBTC: { underlying: 'cbBTC', chains: ['Base', 'Ethereum'], auditStatus: 'Audited' },
}

export function RiskPanel({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [expanded, setExpanded] = useState(defaultOpen)

  return (
    <div className="neu-card p-5 flex flex-col gap-3">
      <button onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2">
          <div className="neu-tag bg-pink text-black">RISK</div>
          <p className="font-display font-bold text-sm">TRANSPARENCY</p>
        </div>
        <span className="font-display text-lg">{expanded ? '−' : '+'}</span>
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 animate-float-in">
          <p className="font-body text-sm text-black/60">
            YO Protocol vaults are ERC-4626 compliant, non-custodial, and audited.
            Your funds are deposited into diversified DeFi yield pools managed by the protocol.
          </p>

          {(Object.entries(VAULT_INFO) as [VaultId, typeof VAULT_INFO[string]][]).map(([id, info]) => (
            <VaultRiskRow key={id} vaultId={id} info={info} />
          ))}

          <div className="p-4 bg-pink/10 border-2 border-pink rounded-md">
            <p className="font-display text-xs font-bold uppercase mb-2 text-pink">Risk factors</p>
            <ul className="font-body text-xs text-black/60 space-y-1">
              <li>• Smart contract risk — protocol is audited but risk is never zero</li>
              <li>• Redemption may take up to 24h if vault liquidity is low</li>
              <li>• APY is variable and not guaranteed</li>
              <li>• yoTokens are yield-bearing — exchange rate increases over time</li>
            </ul>
          </div>

          <div className="flex gap-2">
            <a href="https://docs.yo.xyz/protocol/security-audits" target="_blank" rel="noopener"
              className="neu-btn neu-btn-secondary text-xs flex-1 text-center">AUDIT REPORTS ↗</a>
            <a href="https://docs.yo.xyz/protocol/risks" target="_blank" rel="noopener"
              className="neu-btn neu-btn-secondary text-xs flex-1 text-center">FULL RISK DOCS ↗</a>
          </div>
        </div>
      )}
    </div>
  )
}

function VaultRiskRow({ vaultId, info }: { vaultId: VaultId; info: typeof VAULT_INFO[string] }) {
  const { vaultState } = useVaultState(vaultId)
  return (
    <div className="p-3 bg-cream border-2 border-black/10 rounded-md">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="neu-tag bg-acid">{vaultId}</span>
          <span className="font-body text-xs text-black/50">{info.underlying}</span>
        </div>
        <span className="neu-tag bg-acid-dark/20 text-acid-dark">{info.auditStatus}</span>
      </div>
      <div className="flex gap-1">
        {info.chains.map(chain => (
          <span key={chain} className="font-display text-[10px] text-black/40 bg-white border border-black/10 rounded px-1.5 py-0.5">
            {chain}
          </span>
        ))}
      </div>
      {vaultState && (
        <p className="font-display text-[10px] text-black/30 mt-1">
          Total supply: {vaultState.totalSupply.toString().slice(0, 12)}...
        </p>
      )}
    </div>
  )
}