import { init } from '@nimiq/mini-app-sdk';

export const LUNA_PER_NIM = 100_000;

const TREASURY_KEY = 'gr-treasury';

/** Platform-maintained escrow. Users never enter this. */
export const PLATFORM_TREASURY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_TREASURY_ADDRESS) ||
  'NQ07 PLAT ESCROW DEMO0001';

let nimiqPromise = null;

export function inNimiqPay() {
  try {
    return typeof window !== 'undefined' && !!window.nimiqPay;
  } catch {
    return false;
  }
}

export function payLanguage() {
  try {
    return (
      (typeof window !== 'undefined' && window.nimiqPay && window.nimiqPay.language) ||
      (typeof navigator !== 'undefined' ? (navigator.language || 'en').split('-')[0] : 'en') ||
      'en'
    );
  } catch {
    return 'en';
  }
}

export async function connectNimiq(timeout = 8000) {
  if (!nimiqPromise) {
    nimiqPromise = init({ timeout });
  }
  return nimiqPromise;
}

export function nimToLuna(nim) {
  return Math.round(Number(nim) * LUNA_PER_NIM);
}

export function lunaToNim(luna) {
  return Number(luna) / LUNA_PER_NIM;
}

export function getTreasuryAddress() {
  try {
    return localStorage.getItem(TREASURY_KEY) || PLATFORM_TREASURY;
  } catch {
    return PLATFORM_TREASURY;
  }
}

export function setTreasuryAddress(addr) {
  try {
    if (addr) localStorage.setItem(TREASURY_KEY, addr.trim());
    else localStorage.removeItem(TREASURY_KEY);
  } catch { /* noop */ }
}

function providerError(value) {
  if (value && typeof value === 'object' && value.error && typeof value.error.message === 'string') {
    return new Error(value.error.message);
  }
  return null;
}

export function isDemoAddress(addr) {
  const n = normalizeNimiqAddress(addr);
  if (!n) return true;
  if (/DEMO|ESCROW|PLAT|TEST|XXXX|PREVIEW/i.test(n)) return true;
  return !isValidNimiqAddress(addr);
}

/** User-friendly NIM address: 36 chars, starts with NQ, spaces allowed. */
export function isValidNimiqAddress(addr) {
  const n = normalizeNimiqAddress(addr);
  // e.g. NQ26 1MYH 6SSQ 2EBV Q0XQ SDPD X9KA HMYB VMTG → 36 chars
  if (!/^NQ[0-9A-Z]{34}$/.test(n)) return false;
  if (/DEMO|ESCROW|PLAT|TEST|XXXX|PREVIEW/i.test(n)) return false;
  return true;
}

export function normalizeNimiqAddress(addr) {
  return String(addr || '').replace(/\s+/g, '').toUpperCase();
}

/** HTTPS deeplink that opens this origin inside Nimiq Pay. */
export function nimiqPayAppLink(pathname) {
  try {
    const origin = window.location.origin.replace(/^https?:\/\//, '');
    const path = pathname && pathname !== '/' ? pathname.replace(/^\//, '') : '';
    return `https://nimpay.app/miniapps/open/${origin}${path ? `/${path}` : ''}`;
  } catch {
    return 'https://nimpay.app/miniapps/open/get-ransom.vercel.app';
  }
}

function unwrap(value, label) {
  const err = providerError(value);
  if (err) throw err;
  if (value && typeof value === 'object' && 'error' in value) {
    throw new Error(value.error?.message || `${label} failed`);
  }
  return value;
}

/**
 * Real NIM payment with optional memo. Throws if not inside Nimiq Pay.
 * recipient must be a valid user-friendly NIM address.
 */
export async function sendNim({ recipient, nim, memo, requireConsensus = true }) {
  if (!recipient || !String(recipient).trim()) {
    throw new Error('Missing recipient address');
  }
  if (!isValidNimiqAddress(recipient)) {
    throw new Error('Recipient is not a valid NIM address (NQ…)');
  }
  const amount = Number(nim);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  if (!inNimiqPay()) {
    throw new Error('Open this mini app inside Nimiq Pay to send NIM');
  }
  const nimiq = await connectNimiq(10_000);
  if (requireConsensus) {
    try {
      const ok = await nimiq.isConsensusEstablished();
      if (ok === false) {
        throw new Error('Nimiq network not ready — wait for consensus and retry');
      }
    } catch (err) {
      if (err instanceof Error && /consensus/i.test(err.message)) throw err;
      // consensus check optional if provider errors; continue to send
    }
  }
  const value = nimToLuna(amount);
  const cleanRecipient = normalizeNimiqAddress(recipient);
  // User-friendly spaced form is what Pay expects
  const recipientFriendly = cleanRecipient.replace(/(.{4})/g, '$1 ').trim();

  if (memo && String(memo).trim()) {
    const result = await nimiq.sendBasicTransactionWithData({
      recipient: recipientFriendly,
      value,
      data: String(memo).slice(0, 64),
    });
    return String(unwrap(result, 'Payment'));
  }
  const result = await nimiq.sendBasicTransaction({
    recipient: recipientFriendly,
    value,
  });
  return String(unwrap(result, 'Payment'));
}

/** Consensus + height. Requires Nimiq Pay provider (no user confirm). */
export async function getNimiqNetworkStatus() {
  if (!inNimiqPay()) {
    return { consensus: null, blockNumber: null };
  }
  const nimiq = await connectNimiq(8000);
  const [consensus, blockNumber] = await Promise.all([
    nimiq.isConsensusEstablished(),
    nimiq.getBlockNumber(),
  ]);
  return {
    consensus: unwrap(consensus, 'Consensus') === true,
    blockNumber: Number(unwrap(blockNumber, 'Block')) || 0,
  };
}

export async function listNimiqAccounts() {
  if (!inNimiqPay()) throw new Error('Not inside Nimiq Pay');
  const nimiq = await connectNimiq(10_000);
  const accounts = unwrap(await nimiq.listAccounts(), 'Accounts');
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('No Nimiq accounts available');
  }
  return accounts.map((a) => String(a));
}

/**
 * Sign a bounty promise with the Nimiq wallet (native confirm in Pay).
 * Browser preview returns a mock signature so UI can flow without a chain.
 */
export async function signNimiqMessage(message) {
  const text = String(message || '');
  if (!text.trim()) throw new Error('Nothing to sign');
  if (!inNimiqPay()) {
    return {
      method: 'preview',
      publicKey: '',
      signature: `preview-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`,
    };
  }
  const nimiq = await connectNimiq(10_000);
  const result = unwrap(await nimiq.sign(text), 'Sign');
  if (!result || typeof result !== 'object' || !result.signature) {
    throw new Error('Wallet returned no signature');
  }
  return {
    method: 'pay',
    publicKey: String(result.publicKey || ''),
    signature: String(result.signature),
  };
}

const ISSUE_RE = /github\.com\/([^/\s]+)\/([^/\s]+)\/issues\/(\d+)/i;
const PR_RE = /github\.com\/([^/\s]+)\/([^/\s]+)\/pull\/(\d+)/i;

export function parseIssueUrl(url) {
  const m = String(url || '').match(ISSUE_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: m[3] };
}

export function parsePrUrl(url) {
  const m = String(url || '').match(PR_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: m[3] };
}

async function gh(path) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null;
  if (res.status === 403) throw new Error('GitHub rate limit — try again shortly');
  if (!res.ok) throw new Error(`GitHub failed (${res.status})`);
  return res.json();
}

export function githubClientId() {
  try {
    return import.meta.env.VITE_GITHUB_CLIENT_ID || '';
  } catch {
    return '';
  }
}

/** Start GitHub OAuth. Requires VITE_GITHUB_CLIENT_ID + a token-exchange backend. */
export function beginGitHubOAuth() {
  const clientId = githubClientId();
  if (!clientId) return null;
  const state = mockTxHash('gh');
  try {
    sessionStorage.setItem('gr-gh-oauth-state', state);
  } catch { /* noop */ }
  // Prefer explicit env; else origin only (no path/trailing slash).
  // GitHub OAuth Apps require an exact match with the app's callback URL.
  // Omitting redirect_uri also works if the app has a single callback set.
  let redirect = '';
  try {
    redirect = import.meta.env.VITE_GITHUB_REDIRECT_URI || '';
  } catch { /* noop */ }
  if (!redirect && typeof window !== 'undefined') {
    redirect = window.location.origin;
  }
  const params = new URLSearchParams({
    client_id: clientId,
    scope: 'read:user',
    state,
  });
  if (redirect) params.set('redirect_uri', redirect);
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export function readGitHubOAuthReturn() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    if (!code) return null;
    const expected = sessionStorage.getItem('gr-gh-oauth-state');
    if (expected && state && state !== expected) return null;
    const clean = `${window.location.origin}${window.location.pathname}`;
    window.history.replaceState({}, '', clean);
    return { code, state };
  } catch {
    return null;
  }
}

/** Exchange OAuth code via our serverless route; returns { login, id, avatar }. */
export async function exchangeGitHubCode(code) {
  const res = await fetch('/api/github/oauth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || 'GitHub connect failed');
  }
  if (!body.login) {
    throw new Error('GitHub connect returned no user');
  }
  return {
    login: body.login,
    id: body.id,
    avatar: body.avatar || '',
    name: body.name || '',
  };
}

export function demoConnectGitHub() {
  // Browser preview only — production must use OAuth (VITE_GITHUB_CLIENT_ID).
  const login = `keeper-${Math.random().toString(36).slice(2, 8)}`;
  return {
    login,
    id: Math.floor(Math.random() * 1e9),
    avatar: '',
    method: 'preview',
  };
}

/** Confirm a GitHub login exists and return canonical identity. */
export async function fetchGitHubUser(login) {
  const handle = String(login || '').replace(/^@/, '').trim();
  if (!handle) throw new Error('Enter a GitHub username');
  const data = await gh(`/users/${encodeURIComponent(handle)}`);
  if (!data || !data.login) throw new Error('GitHub user not found');
  return {
    login: data.login,
    id: data.id,
    avatar: data.avatar_url || '',
    name: data.name || '',
  };
}

/** Import title/body/repo/tags/assignees from a public GitHub issue. */
export async function importGitHubIssue(url) {
  const parsed = parseIssueUrl(url);
  if (!parsed) throw new Error('Paste a GitHub issue URL like https://github.com/owner/repo/issues/12');
  const { owner, repo, number } = parsed;
  const data = await gh(`/repos/${owner}/${repo}/issues/${number}`);
  if (!data) throw new Error('Issue not found (is the repo public?)');
  if (data.pull_request) throw new Error('That URL is a pull request, not an issue');
  const assignees = Array.isArray(data.assignees)
    ? data.assignees.map((a) => a.login).filter(Boolean)
    : data.assignee
      ? [data.assignee.login]
      : [];
  return {
    title: data.title || '',
    body: data.body || '',
    repo: `${owner}/${repo}`,
    issueUrl: data.html_url || url,
    issueNumber: Number(number),
    tags: Array.isArray(data.labels)
      ? data.labels.map((l) => (typeof l === 'string' ? l : l.name)).filter(Boolean).slice(0, 5)
      : [],
    assignees,
    author: data.user?.login || '',
  };
}

/** Import a public GitHub pull request for claims. */
export async function importGitHubPull(url) {
  const parsed = parsePrUrl(url);
  if (!parsed) throw new Error('Paste a GitHub pull request URL like https://github.com/owner/repo/pull/12');
  const { owner, repo, number } = parsed;
  const data = await gh(`/repos/${owner}/${repo}/pulls/${number}`);
  if (!data) throw new Error('Pull request not found');
  return {
    title: data.title || '',
    prUrl: data.html_url || url,
    repo: `${owner}/${repo}`,
    author: data.user?.login || '',
    state: data.state || 'open',
    merged: !!data.merged_at,
  };
}

/** Does this issue assignee list include the hunter? */
export function isAssignedTo(assignees, githubUser) {
  if (!Array.isArray(assignees) || assignees.length === 0) return false;
  if (!githubUser) return false;
  const want = githubUser.replace(/^@/, '').toLowerCase();
  return assignees.some((a) => String(a).toLowerCase() === want);
}

export function mockTxHash(prefix = 'mock') {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}
