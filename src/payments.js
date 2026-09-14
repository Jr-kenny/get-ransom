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

/** Real NIM payment with optional memo. Throws if not inside Nimiq Pay. */
export async function sendNim({ recipient, nim, memo }) {
  if (!recipient || !String(recipient).trim()) {
    throw new Error('Missing recipient address');
  }
  const amount = Number(nim);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than 0');
  }
  if (!inNimiqPay()) {
    throw new Error('Open this mini app inside Nimiq Pay to send NIM');
  }
  const nimiq = await connectNimiq(10_000);
  const value = nimToLuna(amount);
  const payload = {
    recipient: String(recipient).trim(),
    value,
  };
  if (memo && String(memo).trim()) {
    const result = await nimiq.sendBasicTransactionWithData({
      ...payload,
      data: String(memo).slice(0, 64),
    });
    const err = providerError(result);
    if (err) throw err;
    return typeof result === 'string' ? result : String(result);
  }
  const result = await nimiq.sendBasicTransaction(payload);
  const err = providerError(result);
  if (err) throw err;
  return typeof result === 'string' ? result : String(result);
}

export async function listNimiqAccounts() {
  if (!inNimiqPay()) throw new Error('Not inside Nimiq Pay');
  const nimiq = await connectNimiq(10_000);
  const accounts = await nimiq.listAccounts();
  const err = providerError(accounts);
  if (err) throw err;
  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error('No Nimiq accounts available');
  }
  return accounts;
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
  const redirect = `${window.location.origin}${window.location.pathname}`;
  const url =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirect)}` +
    `&scope=read:user` +
    `&state=${encodeURIComponent(state)}`;
  return url;
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
