/**
 * Client profile helpers.
 * Source of truth is the server session + /api/me (GitHub identity, payout wallet).
 * localStorage is only a non-authoritative cache for paint-before-network.
 */
import { fetchMe, savePayoutWallet, logout as apiLogout } from './api.js';

const PROFILE_KEY = 'gr-profile-v1';

const empty = {
  payoutWallet: '',
  githubUser: '',
  githubId: null,
  githubAvatar: '',
  githubConnected: false,
  githubConnectedAt: '',
};

export function loadProfileCache() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return { ...empty };
  }
}

export function cacheProfile(profile) {
  const next = { ...empty, ...profile };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return next;
}

export function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_KEY);
  } catch {
    /* noop */
  }
  return { ...empty };
}

function fromServerUser(user) {
  if (!user) return { ...empty };
  return {
    payoutWallet: user.payoutWallet || '',
    githubUser: user.login || '',
    githubId: user.githubId ?? null,
    githubAvatar: user.avatar || '',
    githubConnected: true,
    githubConnectedAt: (user.githubConnectedAt || '').slice(0, 10),
  };
}

export async function loadProfileFromServer() {
  try {
    const { user } = await fetchMe();
    const profile = fromServerUser(user);
    cacheProfile(profile);
    return profile;
  } catch (err) {
    if (err?.status === 401) {
      clearProfileCache();
      return { ...empty };
    }
    throw err;
  }
}

export async function persistPayoutWallet(payoutWallet) {
  const { user } = await savePayoutWallet(payoutWallet);
  const profile = fromServerUser(user);
  cacheProfile(profile);
  return profile;
}

export async function disconnectGitHub() {
  await apiLogout();
  return clearProfileCache();
}
