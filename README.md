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

### AI Coach — Always Available

Beyond deposits, FLOAT's Claude-powered coach answers real questions about your portfolio:

> *"Am I beating a HYSA right now?"*
> → *"At $1 your gas cost (8¢) outweighs the yield advantage vs a 4.5% HYSA. At $500+ FLOAT generates $1.10 vs HYSA's $1.54 over 25 days — competitive and non-custodial."*

> *"Should I rebalance my ETH float?"*
> → Claude checks current APYs, calculates if gas payback period makes sense, and recommends keep or move with exact numbers.

---

## Under the Hood

### YO Protocol — The Yield Layer

FLOAT deposits all funds into YO Protocol's audited ERC-4626 vaults on Base:

- **yoUSD** — 3.18% APY, USDC, stable
- **yoETH** — 5.42% APY, WETH, medium risk
- **yoBTC** — 1.92% APY, cbBTC, low-medium risk

YO vaults handle all the complex yield generation. FLOAT handles the UX.

### YO SDK Integration

| Hook | Purpose |
|------|---------|
| `useDeposit({ vault })` | Execute deposits via YO Gateway |
| `useApprove({ token })` | ERC-20 approval before deposit |
| `useRedeem({ vault })` | Redeem yoTokens → USDC |
| `useVaultState(vaultId)` | Live APY, TVL, exchange rate |
| `useVaults()` | All available vaults |
| `useVaultHistory(vaultId)` | 30-day APY timeseries for charts + AI forecasts |

### Two Custom Contracts — Extending YO

We built two contracts on top of YO vaults to make the AI strategies possible:

**FloatZap** [`0x0BE25e03Bec708aCFb2f74C9f99986453702D27C`](https://basescan.org/address/0x0BE25e03Bec708aCFb2f74C9f99986453702D27C)
Swap any token into any YO vault in one transaction. ETH → WETH → yoETH. USDC → cbBTC → yoBTC. Uniswap V3 routing under the hood. The AI Zap mode uses this.

**FloatOptimizer** [`0xABcD707afA9548AAEa0eA3f909bE08c793C64214`](https://basescan.org/address/0xABcD707afA9548AAEa0eA3f909bE08c793C64214)
Takes USDC, reads live APYs, uses FloatZap to route into all 3 vaults weighted by yield and timeline. Tracks positions on-chain with labels and deadlines. The AI Optimizer mode uses this.

Both are live on Base mainnet. Both are non-custodial — funds flow directly into YO vaults.

### AI Infrastructure

All AI runs through **OpenRouter → Claude Sonnet 4.5**:

- `/api/classify` — intent parsing, vault selection, yield projection, bank comparison
- `/api/zap-ai` — token + vault recommendation from natural language
- `/api/optimizer-ai` — goal parsing + split allocation explanation
- `/api/coach` — conversational portfolio advisor with live context
- `/api/forecast` — 14-day APY prediction from historical data
- `/api/intel` — full portfolio analysis report
- `/api/rebalance` — rebalance suggestions with gas payback calculation

Every API call passes live vault APYs and the user's actual USDC balance to Claude — so the AI never suggests floating money you don't have, and every recommendation reflects real on-chain conditions.

---

## Safety First

FLOAT is built on the assumption that users trust it with real money.

- **Emergency exit** on every position — redeem early anytime, keep yield earned so far
- **Auto-redeem** — app detects matured floats and redeems automatically while open (Gelato Web3 Functions for 24/7 automation post-hackathon)
- **Gas gate** — AI warns before suggesting a deposit where gas costs outweigh yield
- **Liquid buffers** — for uncertain expenses, AI keeps a portion in your wallet
- **Risk transparency** — every vault shows audit status, underlying asset, chains, and risk factors
- **Non-custodial** — your keys, your funds. FLOAT never holds anything.

---

## Setup

```bash
git clone https://github.com/dhruv457457/Float
cd float/fload-app
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



---

## Why FLOAT Wins

Most DeFi yield products optimize for the 1% who understand the protocol. FLOAT optimizes for the 99% who just want their idle money to work.

The AI doesn't simplify DeFi — it *replaces the need to understand it*. You describe your life. FLOAT handles the yield.

That's the whole bet.

---

*Built with 🟢 for Hack with YO · [float-omega.vercel.app](https://float-omega.vercel.app)*
