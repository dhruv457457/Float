# FLOAT — Yield While You Wait

> Put your idle stablecoins to work. Tell FLOAT what you're saving for, and it earns yield in YO Protocol vaults until you need it back.

**Live demo:** [float-omega.vercel.app](https://float-omega.vercel.app)  
Built for the [Hack with YO: Designing Smart DeFi Savings](https://dorahacks.io) hackathon.

![Base](https://img.shields.io/badge/chain-Base-blue) ![YO Protocol](https://img.shields.io/badge/protocol-YO-brightgreen) ![ERC-4626](https://img.shields.io/badge/standard-ERC--4626-orange) ![Next.js](https://img.shields.io/badge/Next.js-16-black)

---

## The Problem

You have $500 sitting in your wallet for rent due in 25 days. That money is doing nothing.

| Where your money sits | 25-day yield on $500 |
|---|---|
| Bank savings (0.5% APY) | $0.17 |
| High-yield savings (4.5% APY) | $1.54 |
| **FLOAT → YO Protocol** | **$1.10 (a coffee ☕)** |

FLOAT makes this effortless — describe what you're saving for in plain English, and the AI handles everything.

---

## How It Works

```
"$500 for rent in 25 days"
        │
        ▼
   AI Classifies Intent
   (Claude via OpenRouter)
        │
        ▼
   Approve USDC → Deposit into yoUSD vault
        │
        ▼
   Yield accrues via yoToken exchange rate
        │  (25 days later)
        ▼
   Redeem → $500 + yield, right on time
```

---

## Features

### Unified AI Chat — Float / Zap / Optimizer modes
One input, three modes toggled at the top:

- **💸 Float** — Describe a savings goal in plain English. Claude analyzes intent, picks the optimal YO vault, sets the deadline, and can recommend splitting across vaults for better yield.
- **⚡ Zap** — Deposit any token (ETH, USDC, WETH, cbBTC) into any YO vault in one transaction. AI picks the best route. Powered by our custom **FloatZap** contract which swaps via Uniswap V3 then deposits.
- **🔮 Optimizer** — Auto-split USDC across all 3 YO vaults for maximum APY. AI explains *why* the allocation makes sense for your timeline. Powered by our custom **FloatOptimizer** contract.

### Live Vault Dashboard
- Real-time APY, TVL, and exchange rates from YO SDK (`useVaultState`, `useVaults`, `useVaultHistory`)
- 30-day APY bar chart with hover tooltips
- Live yield tickers counting up per-second in real time

### On-Chain Positions + Redeem
- Reads optimizer positions directly from contract (`getUserPositions`)
- Two-step redeem: `optimizer.redeem()` sends yoUSD tokens → `yoUSD.redeem()` converts to USDC
- Emergency exit button on every float card — redeem early anytime, keep yield earned so far
- Auto-redeem triggers when deadline passes while app is open

### AI Intelligence Panel
- **AI Coach** — chat with Claude about your portfolio, ask if you're beating a HYSA, get rebalance advice
- **Portfolio Report** — full analysis of your positions with specific numbers
- **Yield Forecast** — 14-day AI prediction curve on top of 30-day historical APY
- **Rebalancer** — AI suggests vault switches based on current APYs and gas costs

### Risk & Transparency
- Per-vault breakdown: underlying asset, chains, audit status, total supply
- Direct links to YO Protocol audit reports
- Clear risk factor disclosures

### Yield Comparison
- Interactive Bank vs HYSA vs FLOAT bars — seeded with your actual USDC balance
- Shows the multiplier: *"6x more than a bank savings account"*

### Shareable Savings Receipt
- Receipt modal showing total deposited, yield earned, APY
- One-click Share on X tagging @yo_xyz

---

## YO SDK Integration

FLOAT uses `@yo-protocol/react` for all core deposit and redeem flows.

| Hook | Where used | Purpose |
|------|-----------|---------|
| `useDeposit({ vault })` | FloatChat (float mode), FloatCard | Execute deposits via YO Gateway |
| `useApprove({ token })` | FloatChat (float mode) | ERC-20 approval before deposit |
| `useRedeem({ vault })` | FloatCard | Redeem yoTokens back to USDC |
| `useVaultState(vaultId)` | VaultComparisonTable, RiskPanel | Live APY, TVL, exchange rate |
| `useVaults()` | VaultDashboard | List all available vaults |
| `useVaultHistory(vaultId)` | VaultDashboard, YieldForecast | 30-day APY + TVL timeseries |

### Transaction Flow (Float mode)
```
User: "500 for rent in 25 days"
  → POST /api/classify (Claude via OpenRouter)
  → AI returns: vault=yoUSD, amount=500, days=25, reasoning
  → useApprove({ token: USDC }) → ERC-20 approval tx
  → useDeposit({ vault: yoUSD, slippageBps: 50 }) → YO Gateway deposit tx
  → saveFloat() → localStorage tracks deadline + auto-redeem
```

---

## Custom Smart Contracts (on top of YO vaults)

Both contracts are live on **Base mainnet** and use YO vaults as the yield layer.

### FloatZap — `0x0BE25e03Bec708aCFb2f74C9f99986453702D27C`
Swap any token into any YO vault in a single transaction. Handles ETH→WETH→yoETH, USDC→yoUSD direct, and USDC→WETH→cbBTC→yoBTC multi-hop routes via Uniswap V3.

```solidity
function zapIn(address tokenIn, uint256 amountIn, address vault, uint256 minShares)
    external payable returns (uint256 shares)
```

### FloatOptimizer — `0xABcD707afA9548AAEa0eA3f909bE08c793C64214`
Takes USDC, uses FloatZap internally to route into all 3 YO vaults based on live APY rankings and configurable split weights. Tracks positions on-chain with labels and deadlines.

```solidity
function deposit(uint256 usdcAmount, uint256 matureAt, string calldata label)
    external returns (uint256 positionId)

function redeem(uint256 positionId) external // sends yoTokens to wallet
```

Both contracts verified on [BaseScan](https://basescan.org).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Chain | Base mainnet (Chain ID 8453) |
| Yield | YO Protocol (`@yo-protocol/core` + `@yo-protocol/react`) |
| Wallet | RainbowKit + wagmi v2 |
| AI | Claude Sonnet 4.5 via **OpenRouter** |
| Styling | TailwindCSS + Neubrutalism design system |
| Contracts | Hardhat + Solidity 0.8.28 |

---

## Setup

```bash
git clone https://github.com/your-repo/float.git
cd float/fload-app
cp .env.example .env.local
```

`.env.local`:
```
OPENROUTER_API_KEY=your_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_key
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — connect MetaMask on Base network.

---

## Architecture

```
fload-app/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── dashboard/page.tsx          # Main dashboard (AI / Float / Vaults tabs)
│   └── api/
│       ├── classify/               # AI intent classifier (float mode)
│       ├── zap-ai/                 # AI token + vault picker (zap mode)
│       ├── optimizer-ai/           # AI goal parser + split explainer
│       ├── coach/                  # AI savings coach chat
│       ├── forecast/               # AI yield forecast (14-day)
│       ├── intel/                  # Portfolio intelligence report
│       └── rebalance/              # AI rebalance recommendations
│
├── components/
│   ├── FloatChat.tsx               # Unified AI input (Float / Zap / Optimizer modes)
│   ├── FloatCard.tsx               # Active float with live yield ticker + emergency exit
│   ├── PaginatedFloats.tsx         # Shows 3 floats, expand for more + on-chain positions
│   ├── VaultComparisonTable.tsx    # Live APY/TVL/rate table + yield tickers
│   ├── VaultDashboard.tsx          # 30-day APY bar chart
│   ├── YieldComparison.tsx         # Bank vs HYSA vs FLOAT (real balance)
│   ├── RiskPanel.tsx               # Vault transparency + audit links
│   ├── AICoach.tsx                 # Chat with Claude about your portfolio
│   ├── RebalancerPanel.tsx         # AI rebalance with execute button
│   ├── YieldForecast.tsx           # Chart.js + AI 14-day prediction
│   ├── PortfolioIntel.tsx          # Full AI portfolio analysis
│   ├── ZapHistory.tsx              # Paginated ZapIn tx history (on-chain events)
│   ├── OptimizerHistory.tsx        # Paginated optimizer positions list
│   ├── AutoRedeemToast.tsx         # Notification when auto-redeem fires
│   └── MilestoneToasts.tsx         # Yield milestone gamification
│
├── hooks/
│   └── useAutoRedeem.ts            # Polls for matured floats, auto-redeems
│
├── lib/
│   ├── contracts.ts                # ABIs + deployed addresses (FloatZap + FloatOptimizer)
│   ├── classify.ts                 # Claude intent classifier
│   ├── schedule.ts                 # Float localStorage management
│   ├── worth-it.ts                 # Yield calculator + bank comparison
│   └── yo.ts                       # YO SDK vault constants
│
contracts/
├── FloatZap.sol                    # Swap any token → any YO vault in 1 tx
├── FloatOptimizer.sol              # Auto-split USDC across 3 YO vaults
└── scripts/                        # Deploy + setup scripts
```

---

## Judging Criteria

### UX Simplicity — 30%
Natural language input. Type *"$500 for rent in 25 days"* and the AI handles vault selection, amount, deadline, and yield projection. No DeFi jargon. Three steps: tell it → confirm → done. Emergency exit on every position so users never feel locked in.

### Creativity & Growth Potential — 30%
- AI savings coach with portfolio-specific answers (not generic DeFi advice)
- ZapIn lets users deposit ETH or BTC without manual swaps — one tx from any token
- FloatOptimizer automatically maximizes yield by splitting across vaults based on live APYs
- Yield comparison vs banks makes the value prop instantly obvious
- Shareable receipts + milestones create organic sharing moments

### Quality of Integration — 20%
6 YO React hooks (`useDeposit`, `useApprove`, `useRedeem`, `useVaultState`, `useVaults`, `useVaultHistory`) live in production. Real approve + deposit flows via YO Gateway with 0.5% slippage. Custom contracts extend YO vaults for multi-token ZapIn and multi-vault optimization while keeping YO as the yield layer.

### Risk & Trust — 20%
Per-vault transparency panel (underlying, chains, audit status, total supply). Direct audit report links. Explicit risk warnings. Certainty-based liquid buffers for uncertain expenses. Fully non-custodial — all yield generated by YO Protocol's audited ERC-4626 vaults. Emergency exit always available.

---

## Roadmap

- **Auto-redeem via Gelato Web3 Functions** — 24/7 off-session redemption on deadline
- **Recurring floats** — "Float $800 for rent every month"
- **Multi-chain** — Ethereum + Arbitrum via YO Gateway
- **Mobile PWA** — push notifications for milestones

---

*Built with 🟢 for the Hack with YO hackathon · [float-omega.vercel.app](https://float-omega.vercel.app)*