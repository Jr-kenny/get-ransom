# Get Ransom

**Keep the light on for open work.**

Get Ransom is a **Nimiq Pay** mini-app that puts a **NIM bounty** on any public GitHub issue. Hunters ship a pull request. When the keeper accepts a **merged** PR, they pay from their own Nimiq Pay wallet — on-chain, no Stripe, no paste-a-handle identity.

**Live:** [get-ransom.vercel.app](https://get-ransom.vercel.app)  
**Open in Pay:** [nimpay.app/miniapps/open/get-ransom.vercel.app](https://nimpay.app/miniapps/open/get-ransom.vercel.app)

---

## Why it exists

Open source work is full of hard bugs and thin motivation. Labels and “good first issue” threads do not move a maintainer’s worst ticket. A **visible pot** does.

Get Ransom makes that pot:

- **Public** — anyone can see the reward and who promised what  
- **Accountable** — promises and GitHub identity are signed / OAuth-bound  
- **Honest about custody** — today the creator pays on merge from their wallet; we do **not** run a hot escrow  

## The product in one loop

```text
GitHub issue  →  signed NIM promise  →  PR claim  →  merge  →  creator pays in Pay
```

| Who | What they do |
|-----|----------------|
| **Creator** | Import issue → set NIM amount → **sign promise** → optional assignee lock → review PRs → **Pay** on merge |
| **Hunter** | Connect GitHub + payout NQ address → open PR → **Claim** with PR URL → get NIM |
| **Anyone** | **Promise +N** — grows the pot and shows under Contributions |
| **Maintainer** | Assign the issue on GitHub if you want an assignee-only lock |

## What makes it feel real

- **Nimiq Pay native** — `listAccounts`, `sign` (promises), `sendBasicTransactionWithData` (payouts) with native confirm dialogs  
- **Cross-device accounts** — Connect GitHub anywhere; payout wallet and history come back from the server  
- **Shared board** — bounties, promises, and claims live in Redis, not one phone’s localStorage  
- **Claim modal** — paste a PR URL; other submitted PRs listed underneath  
- **Markdown issue bodies** — GitHub write-ups render as headings, lists, and code  

## Honest money model (v1)

| | |
|--|--|
| **Currency** | **NIM** (1 NIM = 100,000 Luna) |
| **Promises** | Signed messages, not locked coins |
| **Payout** | Creator’s wallet → hunter’s saved NQ address on accept of a merged PR |
| **Platform custody** | **None** — we never hold user NIM |

Why not prepaid on NIM L1: Nimiq has no general smart contracts (only vesting / HTLC / staking). A platform treasury would mean **we** custody funds. We chose not to.

### Upcoming: EVM escrow (USDC / USDT)

Nimiq Pay also injects `window.ethereum` for Base, Polygon, and other EVM chains. Next we want a **bounty escrow contract** so pots lock on create and can only pay the hunter (or refund on timeout) — not a hot wallet.

Tracked in in-app **Docs → Upcoming**. Mini-app ERC-20 sends still need the chain’s gas token (no Pay gas abstraction), so dual-currency ships with the contract + keeper path, not as a half-feature.

## Stack

- React 19 + Vite  
- `@nimiq/mini-app-sdk`  
- GitHub OAuth (httpOnly session)  
- Upstash Redis + Vercel serverless API  

## Develop

```bash
npm install
npm run dev -- --host
```

Open the Network URL in **Nimiq Pay** (same Wi-Fi) for wallet actions. Desktop browser is browse + GitHub connect; real NIM needs Pay.

### Env

Frontend:

```bash
VITE_GITHUB_CLIENT_ID=
VITE_GITHUB_REDIRECT_URI=https://get-ransom.vercel.app
```

Server (Vercel):

```bash
GITHUB_CLIENT_SECRET=
SESSION_SECRET=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Share

```
https://nimpay.app/miniapps/open/get-ransom.vercel.app
```

---

Lamp true. Pots honest.
