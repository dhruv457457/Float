# FLOAT — Yield While You Wait

> **Put your idle stablecoins to work.** Tell FLOAT what you're saving for, and it earns yield in YO Protocol vaults until you need it.

Built for the [Hack with YO: Designing Smart DeFi Savings](https://dorahacks.io) hackathon.

![FLOAT](https://img.shields.io/badge/chain-Base-blue) ![YO Protocol](https://img.shields.io/badge/protocol-YO-brightgreen) ![ERC-4626](https://img.shields.io/badge/standard-ERC--4626-orange) ![Next.js](https://img.shields.io/badge/Next.js-16-black) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)

---

## The Problem

You have $500 in USDC sitting in your wallet for rent due in 25 days. That money is doing **nothing**.

| Where your money sits | 25-day yield on $500 |
|---|---|
| Bank savings (0.5% APY) | $0.17 |
| High-yield savings (4.5% APY) | $1.54 |
| **FLOAT → YO Protocol** | **$1.10 (a coffee ☕)** |

FLOAT makes this effortless — just describe what you're saving for in plain English, and the AI handles everything.

---

## How FLOAT Works

```
"$500 for rent in 25 days"
        │
        ▼
   ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
   │  AI Classify │────▶│ Approve USDC │────▶│ Deposit into │
   │  (Claude)    │     │ (ERC-20)     │     │ yoUSD vault  │
   └─────────────┘     └──────────────┘     └──────┬───────┘
                                                    │
                                                    ▼
                                            ┌──────────────┐
                                            │ Yield accrues │
                                            │ via yoTokens  │
                                            └──────┬───────┘
                                                    │ Day 24
                                                    ▼
                                            ┌──────────────┐
                                            │ Auto-redeem   │
                                            │ $500 + yield  │
                                            └──────────────┘
```

1. **Tell it** — Describe your goal: *"$500 for rent in 25 days"*
2. **AI analyzes** — Claude classifies intent, picks the optimal YO vault, and can split funds across multiple vaults
3. **Approve + Deposit** — ERC-20 approval → deposit into audited YO Protocol ERC-4626 vaults on Base
4. **Earn** — Yield accrues automatically via yoTokens (exchange rate increases over time)
5. **Get it back** — FLOAT triggers redemption 1 day before your deadline. Money + yield, on time.

---

## Features

### 🧠 AI-Powered Savings Coach
- Natural language intent classification via Claude Sonnet 4.5 (OpenRouter)
- **Multi-vault split recommendations** — AI suggests splitting across vaults based on timeline and risk:
  - *"Lock your rent in stable yoUSD, and put the rest to work in yoETH for better long-term growth"*
- Certainty-based liquid buffers (keeps funds in wallet for uncertain expenses)
- Friendly yield labels: *"a coffee ($1.10)"*, *"a meal ($3.95)"*

### 📊 Live Vault Dashboard
- Real-time APY, TVL, and exchange rates from YO SDK
- 30-day APY bar chart with hover tooltips
- All three vaults: yoUSD, yoETH, yoBTC

### ⚖️ Yield Comparison Engine
- Interactive comparison: Bank (0.5% APY) vs HYSA (4.5% APY) vs FLOAT (live YO APY)
- Adjustable amount and timeline inputs
- Shows multiplier: *"6x more than a bank savings account"*

### 🛡️ Risk Transparency Panel
- Per-vault breakdown: underlying asset, supported chains, audit status, total supply
- Direct links to YO Protocol audit reports and risk documentation
- Clear risk factor warnings (smart contract risk, redemption timing, variable APY)

### 🎉 Milestone Notifications
- Toast alerts for yield milestones: first penny earned, first dollar, halfway point, redemption ready
- Non-intrusive bottom-right toasts with dismiss

### 🧾 Shareable Savings Receipt
- Receipt-style modal showing total deposited, yield earned, APY
- One-click "Share on X" with pre-filled tweet tagging @yo_xyz

### 📁 Portfolio Summary
- Aggregate stats across all active floats: total floating, total earned, next redemption date
- Active float cards with progress bars, urgency badges, and BaseScan TX links

---

## YO SDK Integration

FLOAT uses both `@yo-protocol/core` and `@yo-protocol/react` extensively:

### React Hooks Used

| Hook | Where | Purpose |
|------|-------|---------|
| `useVaultState(vaultId)` | Vault Dashboard, Risk Panel | On-chain vault state (totalAssets, exchangeRate, totalSupply) |
| `useVaults()` | Vault Dashboard | List all available vaults on connected chain |
| `useVaultHistory(vaultId)` | Vault Dashboard | Historical APY and TVL timeseries for 30-day chart |
| `useDeposit({ vault })` | IntentInput (per-split) | Execute deposits via YO Gateway with 0.5% slippage protection |
| `useApprove({ token })` | IntentInput (per-split) | ERC-20 approval for underlying token before deposit |
| `useYoClient()` | Provider context | Access underlying YoClient instance |

### Core SDK Used (Server-Side)

| Method | Where | Purpose |
|--------|-------|---------|
| `createYoClient({ chainId: 8453 })` | API route | Server-side client for Base chain |
| `getVaultSnapshot(address)` | API route | Off-chain APY, TVL, pool allocations for yield calculation |

### Transaction Flow

```
User types intent
        │
        ▼
POST /api/classify ─── classifyIntent() via OpenRouter (Claude)
        │                       │
        │               getVaultAPY() via yoClient.getVaultSnapshot()
        │                       │
        │               isWorthFloating() calculates yield vs gas + bank comparison
        │
        ▼
SplitDepositCard component (one per vault split)
        │
        ├── useApprove({ token: USDC_ADDRESS })
        │       └── approve(amount) → ERC-20 approval tx
        │
        └── useDeposit({ vault: yoUSD_ADDRESS, slippageBps: 50 })
                └── deposit({ token, amount }) → YO Gateway deposit tx
                        │
                        ▼
                saveFloat() → localStorage (tracks deadline + auto-redeem schedule)
```

### Key Implementation Detail

Each vault split renders as its own `SplitDepositCard` component. This ensures `useDeposit` and `useApprove` hooks bind to the correct vault/token addresses at mount time — the React-correct way to handle per-item hooks with different params.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) + TypeScript |
| Blockchain | Base (Chain ID 8453) |
| Yield Protocol | YO Protocol (`@yo-protocol/core` + `@yo-protocol/react`) |
| Wallet | RainbowKit + wagmi v2 |
| AI | Claude Sonnet 4.5 via OpenRouter |
| Styling | TailwindCSS v4 + Neubrutalism design system |
| Storage | localStorage (hackathon scope — production: database + cron for auto-redeem) |

---

## Setup

```bash
git clone https://github.com/user/float.git
cd float
cp .env.example .env.local
```

Add your keys to `.env.local`:
```
OPENROUTER_API_KEY=your_openrouter_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_walletconnect_id
```

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Architecture

```
float/
├── app/
│   ├── page.tsx                    # Landing page — neubrutalist hero + connect wallet
│   ├── dashboard/page.tsx          # Main dashboard — Float / Vaults / Risk tabs
│   ├── api/classify/route.ts       # AI classification + yield enrichment API
│   ├── layout.tsx                  # Root layout with Providers
│   └── globals.css                 # Neubrutalism design tokens + animations
│
├── components/
│   ├── IntentInput.tsx             # AI input → multi-split confirmation → deposit
│   ├── FloatCard.tsx               # Active float card (progress, yield, TX link)
│   ├── VaultDashboard.tsx          # Live APY chart + vault state (useVaultState)
│   ├── YieldComparison.tsx         # Bank vs HYSA vs FLOAT interactive bars
│   ├── RiskPanel.tsx               # Vault transparency + audit links
│   ├── MilestoneToasts.tsx         # Yield milestone toast notifications
│   ├── SavingsReceipt.tsx          # Shareable receipt modal + Share on X
│   ├── PortfolioSummary.tsx        # Aggregate stats across all floats
│   └── Providers.tsx               # Wagmi + RainbowKit + YieldProvider
│
├── lib/
│   ├── classify.ts                 # Claude intent classifier (multi-vault splits)
│   ├── schedule.ts                 # Float storage + milestone detection
│   ├── worth-it.ts                 # Yield calculator + bank comparison
│   ├── yo.ts                       # YO SDK client + vault constants
│   └── wagmi.ts                    # Wagmi chain config (Base + Ethereum)
│
└── config files (tailwind, tsconfig, next.config, postcss)
```

---

## Design System

FLOAT uses a **neubrutalism** design language — bold, raw, and intentional:

| Element | Style |
|---------|-------|
| Borders | 2.5px solid black on all cards, inputs, buttons |
| Shadows | Hard offset `4px 4px 0px #1A1A1A` (no blur) |
| Primary | Acid green `#BFFF0A` |
| Background | Cream `#FFFDF5` |
| Typography | Space Mono (display) + DM Sans (body) |
| Buttons | Chunky, shifts on hover/active with shadow reduction |
| Tags | Uppercase monospace labels with thick borders |

No gradients. No blur. No rounded-everything. Every element is deliberately bold and legible.

---

## Judging Criteria Alignment

### UX Simplicity — 30%
> *Is this the best savings account experience in DeFi?*

Natural language input — just describe your goal in plain English. AI handles vault selection, amount splitting, buffer calculation, and yield projection. Three-step flow: **tell it → confirm → done**. No manual vault research, no parameter tuning, no DeFi jargon.

### Creativity & Growth Potential — 30%
> *Would real users adopt this?*

- AI savings coach that gives personalized multi-vault strategies
- Yield comparison vs traditional banks (makes the value prop instantly obvious)
- Shareable savings receipts for social proof and virality
- Milestone gamification ("Your rent fund just earned its first dollar!")
- Clear target audience: anyone with idle stablecoins and upcoming expenses

### Quality of Integration — 20%
> *Is the YO SDK properly implemented?*

Full integration across 6 React hooks + 2 core SDK methods. Real approve + deposit flows via YO Gateway on Base with slippage protection. Live on-chain vault data powering the dashboard. Per-split component architecture for correct hook binding.

### Risk & Trust — 20%
> *Is it safe and transparent?*

Dedicated Risk tab with per-vault transparency (underlying assets, chains, total supply, audit status). Direct links to audit reports. Clear risk factor warnings. Certainty-based liquid buffers keep funds accessible for uncertain expenses. Fully non-custodial — all funds in YO Protocol's audited ERC-4626 vaults.

---

## Future Roadmap (Post-Hackathon)

- **Auto-redeem via Gelato/Chainlink Automation** — trigger on-chain redemption 1 day before deadline
- **Recurring floats** — "Float $800 for rent every month"
- **Mobile-first PWA** — push notifications for milestones
- **Multi-chain support** — Ethereum + Arbitrum deposits via YO Gateway
- **Real yield tracking** — read actual yoToken balance and exchange rate delta

---

## License

MIT

---

**Built with 🟢 by the FLOAT team for the Hack with YO hackathon**