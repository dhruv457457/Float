'use client'

import { useState } from 'react'
import { useAccount, useWriteContract, useReadContract, useBalance, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits, parseEther, formatUnits } from 'viem'
import { addDays } from 'date-fns'
import { saveFloat } from '@/lib/schedule'
import {
  FLOAT_ZAP_ADDRESS, FLOAT_ZAP_ABI,
  TOKENS, YO_VAULTS,
} from '@/lib/contracts'

const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable',
    inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }] },
] as const

const TOKEN_OPTIONS = [
  { ...TOKENS.ETH,  label: 'ETH',   icon: '⟠' },
  { ...TOKENS.USDC, label: 'USDC',  icon: '◎' },
  { ...TOKENS.WETH, label: 'WETH',  icon: '⟠' },
  { ...TOKENS.cbBTC,label: 'cbBTC', icon: '₿' },
]

const VAULT_OPTIONS = [
  { id: 'yoUSD' as const, label: 'yoUSD', underlying: 'USDC', apy: '3.18', color: '#9BD600', desc: 'Stable · low risk' },
  { id: 'yoETH' as const, label: 'yoETH', underlying: 'WETH', apy: '5.42', color: '#3B82F6', desc: 'ETH · medium risk' },
  { id: 'yoBTC' as const, label: 'yoBTC', underlying: 'cbBTC', apy: '1.92', color: '#FF6B35', desc: 'BTC · low-med risk' },
]

type VaultKey = 'yoUSD' | 'yoETH' | 'yoBTC'

interface Props {
  onFloatCreated?: () => void
}

export function ZapInput({ onFloatCreated }: Props) {
  const { address } = useAccount()
  const [tokenIn, setTokenIn] = useState(TOKEN_OPTIONS[0]) // default ETH
  const [amount, setAmount] = useState('')
  const [vault, setVault] = useState<VaultKey>('yoUSD')
  const [days, setDays] = useState(30)
  const [label, setLabel] = useState('')
  const [step, setStep] = useState<'input' | 'approving' | 'zapping' | 'done' | 'error'>('input')
  const [errorMsg, setErrorMsg] = useState('')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()

  const { writeContractAsync } = useWriteContract()

  // Get user's token balance
  const { data: ethBalance } = useBalance({ address, query: { enabled: !!address } })
  const { data: tokenBalance } = useBalance({
    address,
    token: tokenIn.isNative ? undefined : tokenIn.address,
    query: { enabled: !!address && !tokenIn.isNative },
  })

  const displayBalance = tokenIn.isNative
    ? ethBalance ? `${parseFloat(formatUnits(ethBalance.value, 18)).toFixed(4)} ETH` : '—'
    : tokenBalance ? `${parseFloat(formatUnits(tokenBalance.value, tokenIn.decimals)).toFixed(4)} ${tokenIn.symbol}` : '—'

  // Check allowance for ERC-20 tokens
  const amountParsed = amount ? parseUnits(amount, tokenIn.decimals) : 0n
  const { data: allowance } = useReadContract({
    address: tokenIn.address,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: address ? [address, FLOAT_ZAP_ADDRESS] : undefined,
    query: { enabled: !!address && !tokenIn.isNative },
  })

  const needsApproval = !tokenIn.isNative && amountParsed > 0n && (allowance ?? 0n) < amountParsed

  // Projected yield for display
  const vaultApy = VAULT_OPTIONS.find(v => v.id === vault)?.apy ?? '3.18'
  const projYield = amount
    ? ((parseFloat(vaultApy) / 100 / 365) * parseFloat(amount || '0') * days).toFixed(4)
    : '0.0000'

  async function handleApprove() {
    if (!address || tokenIn.isNative) return
    setStep('approving')
    try {
      await writeContractAsync({
        address: tokenIn.address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [FLOAT_ZAP_ADDRESS, amountParsed],
      })
    } catch (e: any) {
      setStep('error')
      setErrorMsg(e?.shortMessage || e?.message || 'Approval failed')
      return
    }
    // After approval, proceed to zap
    await handleZap()
  }

  async function handleZap() {
    if (!address || !amount) return
    setStep('zapping')
    try {
      const vaultAddress = YO_VAULTS[vault]
      const minShares = 0n // in production: use Uniswap quote * 0.995 for 0.5% slippage

      const hash = await writeContractAsync({
        address: FLOAT_ZAP_ADDRESS,
        abi: FLOAT_ZAP_ABI,
        functionName: 'zapIn',
        args: [
          tokenIn.isNative ? '0x0000000000000000000000000000000000000000' : tokenIn.address,
          tokenIn.isNative ? 0n : amountParsed,
          vaultAddress,
          minShares,
        ],
        value: tokenIn.isNative ? parseEther(amount) : 0n,
      })

      setTxHash(hash)

      // Save to local state
      saveFloat({
        id: crypto.randomUUID(),
        label: label || `${tokenIn.symbol} → ${vault}`,
        vault,
        depositedAmount: parseFloat(amount),
        shares: '0',
        depositedAt: new Date().toISOString(),
        redeemAt: addDays(new Date(), days - 1).toISOString(),
        neededAt: addDays(new Date(), days).toISOString(),
        status: 'active',
        txHash: hash,
      })

      setStep('done')
      onFloatCreated?.()
    } catch (e: any) {
      setStep('error')
      setErrorMsg(e?.shortMessage || e?.message || 'Zap failed')
    }
  }

  async function handleSubmit() {
    if (!address || !amount) return
    if (needsApproval) {
      await handleApprove()
    } else {
      setStep('zapping')
      await handleZap()
    }
  }

  if (step === 'done') return (
    <div className="neu-card p-8 flex flex-col items-center gap-4 animate-float-in">
      <div className="w-16 h-16 rounded-full bg-acid border-2 border-black flex items-center justify-center">
        <span className="font-display text-2xl font-bold">✓</span>
      </div>
      <p className="font-display font-bold text-xl">ZAP COMPLETE</p>
      <p className="font-body text-center text-black/60 max-w-sm">
        {amount} {tokenIn.symbol} zapped into {vault} and earning{' '}
        <span className="font-bold text-acid-dark">{vaultApy}% APY</span>
      </p>
      {txHash && (
        <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener"
          className="font-body text-xs text-blue hover:underline">
          View on BaseScan ↗
        </a>
      )}
      <button
        onClick={() => { setStep('input'); setAmount(''); setLabel('') }}
        className="neu-btn neu-btn-secondary mt-2"
      >
        ZAP AGAIN
      </button>
    </div>
  )

  return (
    <div className="neu-card p-6 flex flex-col gap-5 animate-float-in">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="neu-tag bg-blue text-black">ZAP IN</span>
        <span className="font-display text-xs text-black/50 uppercase tracking-wider">
          Any token → YO vault in one tx
        </span>
      </div>

      {/* Token selector */}
      <div>
        <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">
          Token to deposit
        </label>
        <div className="flex gap-2 flex-wrap">
          {TOKEN_OPTIONS.map(t => (
            <button
              key={t.symbol}
              onClick={() => setTokenIn(t)}
              className={`neu-tag cursor-pointer transition-all ${
                tokenIn.symbol === t.symbol ? 'bg-acid' : 'bg-white hover:bg-acid/30'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        {address && (
          <p className="font-body text-xs text-black/35 mt-1.5">
            Balance: {displayBalance}
          </p>
        )}
      </div>

      {/* Amount */}
      <div>
        <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">
          Amount
        </label>
        <div className="relative">
          <input
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="neu-input w-full pr-16 text-lg font-display"
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 font-display text-sm text-black/40">
            {tokenIn.symbol}
          </span>
        </div>
      </div>

      {/* Vault selector */}
      <div>
        <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">
          Target vault
        </label>
        <div className="flex flex-col gap-2">
          {VAULT_OPTIONS.map(v => (
            <button
              key={v.id}
              onClick={() => setVault(v.id)}
              className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${
                vault === v.id
                  ? 'border-black bg-acid/10'
                  : 'border-black/10 bg-white hover:border-black/30'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="neu-tag text-xs"
                  style={{ background: `${v.color}22`, color: v.color, borderColor: v.color }}>
                  {v.label}
                </span>
                <span className="font-body text-xs text-black/50">{v.desc}</span>
              </div>
              <span className="font-display text-sm font-bold" style={{ color: v.color }}>
                {v.apy}% APY
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Timeline + label */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">
            Days until needed
          </label>
          <input
            type="number"
            value={days}
            onChange={e => setDays(Number(e.target.value) || 0)}
            className="neu-input w-full text-sm"
          />
        </div>
        <div>
          <label className="font-display text-xs text-black/40 uppercase tracking-wider block mb-2">
            Label (optional)
          </label>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Rent fund"
            className="neu-input w-full text-sm"
          />
        </div>
      </div>

      {/* Projected yield preview */}
      {amount && parseFloat(amount) > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-acid/10 border border-acid-dark">
          <span className="font-body text-sm text-black/60">Projected yield ({days} days)</span>
          <span className="font-display text-sm font-bold text-acid-dark">+${projYield}</span>
        </div>
      )}

      {/* Swap route preview */}
      {amount && tokenIn.symbol !== 'USDC' && vault === 'yoUSD' && (
        <div className="font-body text-xs text-black/40 flex items-center gap-1 flex-wrap">
          <span className="neu-tag bg-white text-xs">{tokenIn.symbol}</span>
          <span>→ swap via Uniswap V3 →</span>
          <span className="neu-tag bg-white text-xs">USDC</span>
          <span>→ deposit →</span>
          <span className="neu-tag bg-acid text-xs">yoUSD</span>
          <span>in 1 tx</span>
        </div>
      )}

      {/* Error */}
      {step === 'error' && (
        <div className="p-3 rounded-lg bg-pink/10 border border-pink">
          <p className="font-body text-xs text-pink">{errorMsg}</p>
          <button onClick={() => setStep('input')} className="font-display text-xs text-pink/60 hover:text-pink mt-1">
            Try again
          </button>
        </div>
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={!amount || parseFloat(amount) <= 0 || step === 'approving' || step === 'zapping'}
        className="neu-btn neu-btn-primary w-full"
      >
        {step === 'approving' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            APPROVING {tokenIn.symbol}...
          </span>
        ) : step === 'zapping' ? (
          <span className="flex items-center justify-center gap-2">
            <span className="inline-block w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ZAPPING INTO {vault}...
          </span>
        ) : needsApproval ? (
          `APPROVE ${tokenIn.symbol} THEN ZAP →`
        ) : (
          `ZAP ${amount || '0'} ${tokenIn.symbol} → ${vault} →`
        )}
      </button>

      <p className="font-body text-xs text-black/30 text-center">
        Swap + deposit in one transaction via FloatZap contract
      </p>
    </div>
  )
}