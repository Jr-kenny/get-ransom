# Get Ransom

**Keep the light on for open work.**

Get Ransom is a Nimiq Pay mini-app bounty hub. Paste a public GitHub issue, fund a NIM pot, let the crowd top it up, and pay hunters when their pull request merges. Identity is a connected GitHub login. Payouts go through a relayer to a saved NIM wallet — not a pasted handle.

**Live:** [get-ransom.vercel.app](https://get-ransom.vercel.app)

## Short description

> Post NIM bounties on GitHub issues, crowdfund the pot, claim with a PR. Paid on merge via relayer. A Nimiq Pay mini-app.

## What it does

| Role | Flow |
|------|------|
| **Creator** | Import issue URL → set pot (pay-on-solve or prepaid) → publish → review claims → accept |
| **Hunter** | Connect GitHub + payout wallet → open a PR → claim with PR URL → get NIM on merge/accept |
| **Repo owner** | Optional GitHub App for bot comments; assignee lock for trusted solvers |
| **Anyone** | Crowdfund open bounties in NIM |

## Stack

- React 19 + Vite
- `@nimiq/mini-app-sdk` (wallet, payments inside Nimiq Pay)
- GitHub REST API (issue / PR import)
- Local state in `localStorage` for v1; escrow + relayer are stubbed until the backend lands

## Develop

```bash
npm install
npm run dev -- --host
```

Open the Network URL in **Nimiq Pay** (same Wi-Fi) for real wallet actions. Desktop browser uses mock connect and mock chain receipts.

## Production

- Deploy: Vercel (`get-ransom.vercel.app`)
- Share in Pay: `https://nimpay.app/miniapps/open/get-ransom.vercel.app`

## Env (when wiring for real)

```bash
VITE_GITHUB_CLIENT_ID=      # GitHub OAuth
VITE_TREASURY_ADDRESS=      # platform escrow NIM address
```

Server-side (never in the client bundle): `GITHUB_CLIENT_SECRET`, relayer key, webhooks.

## Docs

In-app **Docs** covers hunters, creators, repository owners, the GitHub App, and Nimiq payouts.

---

Lamp true. Pots honest.
