# FLOAT — Your Money Has a Brain Now

> The first DeFi savings account that thinks for you.

**Live:** [float-omega.vercel.app](https://float-omega.vercel.app) · Built for [Hack with YO: Smart DeFi Savings](https://dorahacks.io)

![Base](https://img.shields.io/badge/chain-Base-blue) ![YO Protocol](https://img.shields.io/badge/protocol-YO-brightgreen) ![Claude](https://img.shields.io/badge/AI-Claude%20Sonnet-orange) ![ERC-4626](https://img.shields.io/badge/standard-ERC--4626-black)

---

## The Idea

Every day, millions of people sit on idle stablecoins — rent due in 3 weeks, a trip budget next month, an emergency fund that's just... sitting there.

Traditional savings accounts give you $0.17 on that $500. DeFi gives you better yields but asks you to understand vaults, APYs, slippage, and routing. Most people give up.

**FLOAT closes that gap with AI.**

You type one sentence. FLOAT's AI reads your intent, picks the right vault, sets your deadline, explains the yield in plain English, and handles the transaction. No DeFi knowledge required.

```
"$500 for rent in 25 days"   →   $1.10 earned. On time. Automatically.
```

---

## The AI Is the Product

FLOAT isn't a DeFi app with an AI feature bolted on. The AI *is* the interface.

### Natural Language → On-Chain Action

You never see a vault selector or an APY input. You just talk to FLOAT:

> *"I have $200 for a new bicycle in 3 months"*

FLOAT's Claude-powered classifier understands:
- **Amount:** $200
- **Timeline:** ~90 days → long enough for yoETH to beat yoUSD after swap costs
- **Certainty:** medium → keep a small buffer liquid
- **Vault:** yoETH for max yield, with reasoning shown

One confirm tap. Done.

### AI Picks Your Vault — and Explains Why

Every recommendation comes with a plain-English explanation:

> *"yoETH's 5.42% APY gives you a 70% yield advantage over yoUSD at 3.18%. The one-time Uniswap V3 swap cost breaks even in 3 days and is negligible over 90 days. Your $200 floated here earns ~$2.67 — a meal's worth of free money."*

Not just a number. A reason you can trust.

### Three Modes, One Chat

The same AI input drives three different strategies:

| Mode | What you type | What AI does |
|------|--------------|--------------|
| **Float** | *"$500 for rent in 25 days"* | Classifies intent, picks vault, sets deadline via YO SDK |
| **Zap** | *"0.01 ETH idle for 45 days"* | Routes ETH→WETH→yoETH via FloatZap in one tx |
| **Optimizer** | *"Maximize yield on $300 for 60 days"* | Splits USDC across yoETH/yoUSD/yoBTC via FloatOptimizer |

---

## ⚡ FloatZap — Any Token, Any Vault, One Transaction

Most DeFi yield apps only accept the vault's native token. If you have ETH and want to deposit into yoUSD, you'd normally need to: swap ETH → USDC on Uniswap, approve USDC, then deposit into the vault. Three separate transactions.

**FloatZap collapses that into one.**

```
ETH  ──────────────────────────────▶  yoETH  (WETH via Uniswap V3)
USDC ──────────────────────────────▶  yoUSD  (direct deposit)
USDC ──▶ WETH ──▶ cbBTC ────────────▶  yoBTC  (multi-hop via Uniswap V3)
```

Deployed at [`0x0BE25e03Bec708aCFb2f74C9f99986453702D27C`](https://basescan.org/address/0x0BE25e03Bec708aCFb2f74C9f99986453702D27C) on Base mainnet.

You just type *"I have 0.01 ETH idle for 45 days"* — the AI picks the best vault and route, one MetaMask popup, done.

---

## 🔮 FloatOptimizer — AI-Directed Multi-Vault Splitting

Single-vault deposits leave yield on the table. The Optimizer does better:

1. Reads live APYs from all 3 YO vaults on-chain
2. Sorts by yield and your timeline (short timelines favour stability, long timelines favour yoETH)
3. Uses FloatZap internally to route USDC into each vault
4. Tracks your position on-chain with label + deadline

```
$300 for 60 days
  ├── $180 (60%) → yoETH via FloatZap swap   [5.42% APY — highest yield]
  ├── $90  (30%) → yoUSD direct deposit       [3.18% APY — stability]
  └── $30  (10%) → yoBTC via FloatZap swap    [1.92% APY — diversification]

Weighted avg APY: 4.47% vs 3.18% single vault
Extra yield over 60 days: +$0.44
```

The AI explains every allocation decision before you confirm. You see exactly where your money goes and why.

Deployed at [`0xABcD707afA9548AAEa0eA3f909bE08c793C64214`](https://basescan.org/address/0xABcD707afA9548AAEa0eA3f909bE08c793C64214) on Base mainnet.

Both contracts are **live, tested, and non-custodial** — funds flow directly into YO Protocol's audited ERC-4626 vaults.

---

## Full Feature Set

### 🧠 AI Savings Coach (always available)
Chat with Claude about your live portfolio. It has real context — your positions, current APYs, gas costs — and gives specific answers:

> *"Am I beating a HYSA?"* → Claude compares your actual yield vs 4.5% HYSA with real numbers  
> *"Should I rebalance my ETH float?"* → Claude calculates gas payback period and recommends keep or move  
> *"Which vault is best for 45 days?"* → Claude factors in swap costs and timeline to give a concrete answer

### 🔄 AI Rebalancer
Analyzes all your positions and tells you exactly which ones to move and why. Shows the yield gain, gas cost, and days to break even. Execute button fires the on-chain rebalance directly.

### 📈 AI Yield Forecast
Generates a 14-day APY prediction curve on top of 30-day historical data for each vault. Claude reads the trend and gives a written analysis: *"yoUSD has shown stable yields around 3.18% with low volatility. Near-term yield expected to remain in 3.0–3.4% range..."*

### 🔬 Portfolio Intelligence Report
One-click full analysis of your portfolio. Mentions your actual floats by name, compares your yield to HYSA, and gives a concrete suggestion — e.g. *"For amounts under $50, gas cost makes FLOAT less efficient than HYSA. At $500+, FLOAT generates meaningful yield."*

### 📊 Live Vault Dashboard
- Real-time APY, TVL, and exchange rates from YO SDK (`useVaultState`, `useVaults`, `useVaultHistory`)
- 30-day APY bar chart with hover tooltips
- **Live yield tickers** — yield counting up per-second in real time on every active float

### ⚖️ Yield Comparison
Interactive bank vs HYSA vs FLOAT bars seeded with your **actual USDC balance** (not a hardcoded number). Adjustable amount and days. Shows the multiplier: *"6x more than a bank savings account."*

### 🧾 Shareable Savings Receipt
Receipt-style modal showing total deposited, yield earned, and APY. One-click **Share on X** with pre-filled tweet tagging @yo_xyz. Generates organic sharing moments when users see their earnings.

### 🎉 Milestone Toasts
Gamification layer — toast notifications fire when your floats hit yield milestones: first penny earned, first dollar, halfway to deadline, ready to redeem. Non-intrusive, dismiss on click.

### 🛡️ Risk & Transparency
Always-visible panel on the Vaults tab showing per-vault breakdown: underlying asset, supported chains, audit status, total supply from YO SDK. Direct links to YO Protocol audit reports and risk docs.

---

## Safety First

FLOAT is built on the assumption that users trust it with real money:

- **Emergency exit** on every card — redeem early anytime, keep yield earned so far
- **Auto-redeem** — detects matured floats and redeems automatically while app is open (Gelato Web3 Functions for 24/7 off-session automation post-hackathon)
- **Gas gate** — AI warns before suggesting a deposit where gas costs outweigh projected yield
- **Liquid buffers** — for uncertain expenses, AI keeps a portion in your wallet
- **Non-custodial** — your keys, your funds. FLOAT never holds anything.

---

## YO SDK Integration

| Hook | Where used | Purpose |
|------|-----------|---------|
| `useDeposit({ vault })` | FloatChat (float mode) | Execute deposits via YO Gateway |
| `useApprove({ token })` | FloatChat (float mode) | ERC-20 approval before deposit |
| `useRedeem({ vault })` | FloatCard | Redeem yoTokens → USDC |
| `useVaultState(vaultId)` | VaultComparisonTable, RiskPanel | Live APY, TVL, exchange rate |
| `useVaults()` | VaultDashboard | List all available vaults |
| `useVaultHistory(vaultId)` | VaultDashboard, YieldForecast | 30-day APY + TVL timeseries |

---

## AI Infrastructure

All AI runs through **OpenRouter → Claude Sonnet 4.5**:

| API Route | Purpose |
|-----------|---------|
| `/api/classify` | Intent parsing, vault selection, yield projection, bank comparison |
| `/api/zap-ai` | Token + vault recommendation from natural language |
| `/api/optimizer-ai` | Goal parsing + split allocation explanation |
| `/api/coach` | Conversational portfolio advisor with live vault context |
| `/api/forecast` | 14-day APY prediction from 30-day historical data |
| `/api/intel` | Full portfolio analysis report |
| `/api/rebalance` | Rebalance suggestions with gas payback calculation |

Every call passes live vault APYs and the user's actual USDC balance — AI never suggests floating money you don't have.

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
git clone https://github.com/dhruv457457/Float
cd Float/fload-app
cp .env.example .env.local
```

`.env.local`:
```
OPENROUTER_API_KEY=your_key
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_key
```

```bash
npm install && npm run dev
```

Connect MetaMask on Base mainnet → start floating.


- **Gelato automation** — 24/7 auto-redeem without needing the app open
- **Recurring floats** — *"Float my rent every month automatically"*
- **Multi-chain** — Ethereum + Arbitrum via YO Gateway
- **Mobile PWA** — push notifications for milestones and redemptions

---

## Why FLOAT Wins

Most DeFi yield products optimize for the 1% who understand the protocol. FLOAT optimizes for the 99% who just want their idle money to work.

The AI doesn't simplify DeFi — it *replaces the need to understand it*. You describe your life. FLOAT handles the yield.

That's the whole bet.

---

*Built with 🟢 for Hack with YO · [float-omega.vercel.app](https://float-omega.vercel.app)*
