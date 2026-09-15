# Get Ransom

**Keep the light on for open work.**

Get Ransom is a Nimiq Pay mini-app bounty hub. Paste a public GitHub issue, sign a NIM promise for the pot, let others pledge, and pay hunters when their PR merges. Identity is a connected GitHub login (shared across devices). Payouts go from the creator's Nimiq Pay wallet to the hunter's saved NQ address. No platform escrow.

**Live:** [get-ransom.vercel.app](https://get-ransom.vercel.app)

## Short description

> Post NIM bounties on GitHub issues, grow the pot with signed promises, claim with a PR. Paid on merge from the creator's Nimiq Pay wallet.

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
- `@nimiq/mini-app-sdk` (wallet, payments, message signing inside Nimiq Pay)
- GitHub OAuth (httpOnly session cookie) + REST
- **Upstash Redis** — shared users, payout wallets, bounties, promises, claims
- Vercel serverless API (`/api/*`)

## Develop

```bash
npm install
npm run dev -- --host
```

API routes need the same env as production (or Vercel CLI). Open the Network URL in **Nimiq Pay** for real wallet actions.

### Real NIM inside Nimiq Pay

| Action | What happens |
|--------|----------------|
| **Connect GitHub** | OAuth → server session cookie; profile lives in Redis |
| **Save payout wallet** | `PATCH /api/me` — validated NQ address, stored server-side |
| **Connect wallet** | `listAccounts()` — native confirm |
| **Sign promise** | `sign()` modal on publish / pledge; stored on the bounty |
| **Accept claim (pay)** | Creator wallet → hunter payout via `sendBasicTransactionWithData`, then `PATCH` bounty |

Share in Pay: `https://nimpay.app/miniapps/open/get-ransom.vercel.app`

## Production

- Deploy: Vercel (`get-ransom.vercel.app`)
- Share in Pay: `https://nimpay.app/miniapps/open/get-ransom.vercel.app`

## Env

Frontend:

```bash
VITE_GITHUB_CLIENT_ID=
VITE_GITHUB_REDIRECT_URI=https://get-ransom.vercel.app
```

Server (Vercel → Project → Settings → Environment Variables):

```bash
GITHUB_CLIENT_SECRET=
SESSION_SECRET=                 # long random string
UPSTASH_REDIS_REST_URL=         # from Upstash console
UPSTASH_REDIS_REST_TOKEN=
```

Identity and payout wallets are **never** stored in `localStorage` as source of truth — only a paint cache.

## Docs

In-app **Docs** covers hunters, creators, repository owners, the GitHub App, and Nimiq payouts.

---

Lamp true. Pots honest.
