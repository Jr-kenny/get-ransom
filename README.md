# Get Ransom

**Keep the light on for open work.**

Get Ransom is a Nimiq Pay mini-app bounty hub. Paste a public GitHub issue, fund a NIM pot, let the crowd top it up, and pay hunters when their pull request merges. Identity is a connected GitHub login. Payouts go through a relayer to a saved NIM wallet — not a pasted handle.

**Live:** [get-ransom.vercel.app](https://get-ransom.vercel.app)

## Short description

> Post NIM bounties on GitHub issues, crowdfund the pot, claim with a PR. Paid on merge via relayer. A Nimiq Pay mini-app.

## What it does

| Role | Flow |
|------|------|
| **Creator** | Import GitHub issue → set pot → **sign promise** (modal) → publish → review claims → pay on merge |
| **Hunter** | Connect GitHub + payout wallet → open a PR → claim with PR URL → get NIM on merge/accept |
| **Anyone** | Sign a **promise** toward the pot (shown under Contributions) |
| **Repo owner** | Optional GitHub App for bot comments; assignee lock for trusted solvers |

Payments are **on-solve only**: no platform escrow. The creator’s Nimiq Pay wallet sends the reward when they accept a merged PR. Nimiq has no general contracts for merge-conditioned escrow; a hot treasury would mean custody of user funds.

## Stack

- React 19 + Vite
- `@nimiq/mini-app-sdk` (wallet, payments inside Nimiq Pay)
- GitHub REST API (issue / PR import) + GitHub OAuth (Connect GitHub)
- Local state in `localStorage` for v1; prepaid escrow sends go to `VITE_TREASURY_ADDRESS`

## Develop

```bash
npm install
npm run dev -- --host
```

Open the Network URL in **Nimiq Pay** (same Wi-Fi) for real wallet actions. Desktop browser uses mock connect and mock chain receipts.

### Real NIM inside Nimiq Pay

| Action | What happens |
|--------|----------------|
| **Connect wallet** | `listAccounts()` — native confirm, returns your NQ address |
| **Sign promise** | `sign()` — modal on publish / pledge; stored on the bounty |
| **Accept claim (pay)** | Creator wallet → hunter payout address via `sendBasicTransactionWithData` |
| **Browser preview** | Mock wallet + preview signature / receipts only |

Share in Pay: `https://nimpay.app/miniapps/open/get-ransom.vercel.app`

## Production

- Deploy: Vercel (`get-ransom.vercel.app`)
- Share in Pay: `https://nimpay.app/miniapps/open/get-ransom.vercel.app`

## Env (when wiring for real)

```bash
VITE_GITHUB_CLIENT_ID=      # GitHub OAuth App client id
VITE_GITHUB_REDIRECT_URI=   # must match OAuth App callback exactly, e.g. https://get-ransom.vercel.app
```

Server-side (never in the client bundle): `GITHUB_CLIENT_SECRET`, relayer key, webhooks.

## Docs

In-app **Docs** covers hunters, creators, repository owners, the GitHub App, and Nimiq payouts.

---

Lamp true. Pots honest.
