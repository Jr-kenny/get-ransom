const KEY = 'get-ransom-v1';
const LEGACY_KEY = 'bounty-keeper-v1';

const seed = [
  {
    id: 'gr-101',
    kind: 'github',
    title: 'Fix Nimiq Pay deeplink encoding for mini-app URLs',
    body: 'Deeplinks with query params break when opened from iOS share sheet. Repro steps and failing URL in the linked issue. Fix parsing, add tests, keep HTTPS + custom scheme working.',
    repo: 'nimiq/pay-core',
    issueUrl: 'https://github.com/nimiq/pay-core/issues/412',
    tags: ['typescript', 'deeplink', 'ios'],
    paymentMode: 'prepaid',
    base: 850,
    topups: [{ by: 'NQ32…7K9D', amount: 150, txHash: null }],
    fundTx: null,
    status: 'open',
    creator: 'NQ12…KEEP',
    createdAt: '2026-08-28',
    claims: [],
  },
  {
    id: 'gr-102',
    kind: 'github',
    title: 'Add Base Sepolia escrow preview to bounty cards',
    body: 'Show escrow state (unfunded, held, released) on each bounty card using the existing contract events. Read-only for v1, no writes. Design tokens already in repo.',
    repo: 'get-ransom/contracts',
    issueUrl: 'https://github.com/get-ransom/contracts/issues/18',
    tags: ['solidity', 'base', 'ui'],
    paymentMode: 'on-solve',
    base: 1200,
    topups: [],
    fundTx: null,
    status: 'open',
    creator: 'NQ77…BEAM',
    createdAt: '2026-09-02',
    claims: [
      {
        id: 'c1',
        by: 'github:@mo-dev',
        hunterAddr: '',
        ref: 'https://github.com/get-ransom/contracts/pull/21',
        note: 'Draft PR, escrow badge + event hookup.',
        state: 'in-review',
        at: '2026-09-10',
        payoutTx: null,
      },
    ],
  },
  {
    id: 'gr-103',
    kind: 'task',
    title: 'Write a 1-page keeper log for first-time hunters',
    body: 'Plain-words guide: how to pick a bounty, submit proof, and get paid. No hype words. Must read well inside Nimiq Pay on a small screen. Markdown is fine.',
    repo: '',
    issueUrl: '',
    tags: ['docs', 'onboarding'],
    paymentMode: 'on-solve',
    base: 300,
    topups: [
      { by: 'NQ90…LAMP', amount: 100, txHash: null },
      { by: 'NQ11…TIDE', amount: 50, txHash: null },
    ],
    fundTx: null,
    status: 'open',
    creator: 'NQ12…KEEP',
    createdAt: '2026-09-05',
    claims: [],
  },
  {
    id: 'gr-104',
    kind: 'task',
    title: 'Record a 90-second storm-test video of the landing',
    body: 'Screen record the lighthouse landing at gale settings, narrate what the scene does. Upload unlisted, link it here. Paid on accept.',
    repo: '',
    issueUrl: '',
    tags: ['video', 'qa'],
    paymentMode: 'prepaid',
    base: 220,
    topups: [],
    fundTx: null,
    status: 'paid',
    creator: 'NQ77…BEAM',
    createdAt: '2026-08-20',
    claims: [
      {
        id: 'c9',
        by: 'NQ44…ROCK',
        hunterAddr: 'NQ44…ROCK',
        ref: 'https://video.example/keeper-90s',
        note: 'Delivered, accepted.',
        state: 'accepted',
        at: '2026-08-27',
        payoutTx: null,
      },
    ],
  },
];

function total(b) {
  return b.base + b.topups.reduce((s, t) => s + t.amount, 0);
}

function normalize(b) {
  const merged = {
    paymentMode: 'on-solve',
    fundTx: null,
    topups: [],
    claims: [],
    tags: [],
    requireAssignment: false,
    issueAssignees: [],
    issueNumber: null,
    ...b,
  };
  return {
    ...merged,
    topups: (merged.topups || []).map((t) => ({ txHash: null, ...t })),
    claims: (merged.claims || []).map((c) => ({
      hunterAddr: '',
      githubUser: '',
      payoutWallet: '',
      payoutTx: null,
      payoutHeld: false,
      relayer: null,
      prMerged: false,
      prState: '',
      ...c,
    })),
  };
}

export function loadBounties() {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem(LEGACY_KEY);
    if (!raw) {
      const next = seed.map(normalize);
      localStorage.setItem(KEY, JSON.stringify(next));
      return next;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seed.map(normalize);
    return parsed.map(normalize);
  } catch {
    return seed.map(normalize);
  }
}

export function saveBounties(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch { /* private mode, keep in memory */ }
}

export function bountyTotal(b) {
  return total(b);
}

export function uid(prefix) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function shortAddr(a) {
  if (!a) return 'anon';
  const s = String(a).trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 4)}…${s.slice(-4)}`;
}

export const SEED = seed;
