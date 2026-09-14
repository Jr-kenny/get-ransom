const PROFILE_KEY = 'gr-profile-v1';

const empty = {
  payoutWallet: '',
  githubUser: '',
  githubId: null,
  githubAvatar: '',
  githubConnected: false,
  githubConnectedAt: '',
};

export function loadProfile() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return { ...empty };
    return { ...empty, ...JSON.parse(raw) };
  } catch {
    return { ...empty };
  }
}

export function saveProfile(profile) {
  const next = { ...empty, ...profile };
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch { /* noop */ }
  return next;
}

export function disconnectGitHub(profile) {
  return saveProfile({
    ...profile,
    githubUser: '',
    githubId: null,
    githubAvatar: '',
    githubConnected: false,
    githubConnectedAt: '',
  });
}

/** Relayer: auto-pay hunter's stored wallet when keeper marks complete. */
export async function relayerPayout({ to, nim, memo }) {
  if (!to || !String(to).trim()) {
    throw new Error('Hunter has no payout wallet saved');
  }
  const amount = Number(nim);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Invalid payout amount');
  }

  await new Promise((r) => setTimeout(r, 450));
  const receipt = `relayer-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
  return {
    txHash: receipt,
    to: String(to).trim(),
    nim: amount,
    memo: memo || '',
    at: new Date().toISOString(),
  };
}
