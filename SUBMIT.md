# Nimiq mini-app submission — Get Ransom

Use this when filling the Nimiq Pay mini-app form. Category: **NIM** (not EVM).

---

## Name

Get Ransom

## Tagline (one line)

Keep the light on for open work — NIM bounties on GitHub issues, paid on merge in Nimiq Pay.

## Short description

Import a GitHub issue, sign a NIM promise for the pot, claim with a pull request. The creator pays the hunter from their Nimiq Pay wallet when the PR merges.

## Full description

Get Ransom is a bounty hub for open-source work inside Nimiq Pay.

Creators paste a public GitHub issue, set a reward in NIM, and sign a promise. Anyone can pledge more; the pot and who promised what stay visible on the bounty. Hunters connect GitHub, save a payout NQ address, open a PR, and claim with the PR URL. When the keeper accepts a merged PR, they send NIM from their own wallet to the hunter — on-chain, with Nimiq Pay’s native confirm.

Identity is GitHub OAuth (works on every device). Wallet actions use the Mini App SDK: list accounts, sign promises, and send NIM with a memo. No platform escrow on v1 — we do not hold user funds. Locked USDC/USDT escrow on EVM (via window.ethereum) is on the roadmap.

Best experienced inside Nimiq Pay for real sends and signatures.

## Category

NIM

## Keywords / tags

bounty, github, open source, nim, nimiq pay, pull request, rewards

## URL

https://get-ransom.vercel.app

## Deeplink

https://nimpay.app/miniapps/open/get-ransom.vercel.app

## What Nimiq features you use

- Nimiq provider via `@nimiq/mini-app-sdk` `init()`
- `listAccounts` — connect wallet
- `sign` — signed bounty promises
- `sendBasicTransactionWithData` — pay-on-merge NIM transfers with bounty memo
- `isConsensusEstablished` / `getBlockNumber` — network status in Settings
- `window.nimiqPay.language` — locale fallback

## Screenshots to capture (suggested)

1. Landing (lighthouse + CTA)  
2. Explore board with reward amounts  
3. Bounty detail — Reward + Contributions (Promised)  
4. Claim modal with PR URL  
5. Promise sign modal  

## One-liner for reviewers

NIM bounties on GitHub issues: signed promises, PR claims, pay-on-merge from the creator’s Nimiq Pay wallet.
