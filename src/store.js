/**
 * Bounty store — API is source of truth.
 * localStorage is a read cache only (cleared when API returns data).
 */
import { listBounties, createBounty, patchBounty } from './api.js';

export { patchBounty };

const KEY = 'get-ransom-v1';

export function bountyTotal(b) {
  if (Array.isArray(b.promises) && b.promises.length) {
    return b.promises.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }
  return (Number(b.base) || 0) + (b.topups || []).reduce((s, t) => s + (Number(t.amount) || 0), 0);
}

export function uid(prefix) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* noop */
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function shortAddr(a) {
  if (!a) return 'anon';
  const s = String(a).trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

function normalize(b) {
  return {
    paymentMode: 'on-solve',
    kind: 'github',
    fundTx: null,
    topups: [],
    claims: [],
    tags: [],
    requireAssignment: false,
    issueAssignees: [],
    issueNumber: null,
    promises: [],
    ...b,
    kind: 'github',
    paymentMode: 'on-solve',
    promises: Array.isArray(b.promises) ? b.promises : [],
    topups: Array.isArray(b.topups) ? b.topups : [],
    claims: Array.isArray(b.claims)
      ? b.claims.map((c) => ({
          hunterAddr: '',
          githubUser: '',
          payoutWallet: '',
          payoutTx: null,
          payoutHeld: false,
          relayer: null,
          prMerged: false,
          prState: '',
          ...c,
        }))
      : [],
  };
}

export function loadBountiesCache() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize);
  } catch {
    return [];
  }
}

export function cacheBounties(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export async function fetchBounties() {
  const { bounties } = await listBounties();
  const list = (bounties || []).map(normalize);
  cacheBounties(list);
  return list;
}

export async function createBountyRemote(payload) {
  const { bounty } = await createBounty(payload);
  return normalize(bounty);
}

export async function pledgeRemote(id, { amount, promise }) {
  const { bounty } = await patchBounty(id, { action: 'pledge', amount, promise });
  return normalize(bounty);
}

export async function claimRemote(id, { prUrl, prMerged, prState }) {
  const { bounty } = await patchBounty(id, {
    action: 'claim',
    prUrl,
    prMerged,
    prState,
  });
  return normalize(bounty);
}

export async function decideRemote(id, { claimId, accept, payoutTx, relayer }) {
  const { bounty } = await patchBounty(id, {
    action: 'decide',
    claimId,
    accept,
    payoutTx,
    relayer,
  });
  return normalize(bounty);
}
