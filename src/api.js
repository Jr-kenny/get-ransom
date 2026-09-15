/** Browser API client — credentials (session cookie) always included. */

async function req(path, options = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

export function fetchMe() {
  return req('/api/me');
}

export function savePayoutWallet(payoutWallet) {
  return req('/api/me', { method: 'PATCH', body: JSON.stringify({ payoutWallet }) });
}

export function logout() {
  return req('/api/auth/logout', { method: 'POST' });
}

export function listBounties() {
  return req('/api/bounties');
}

export function createBounty(payload) {
  return req('/api/bounties', { method: 'POST', body: JSON.stringify(payload) });
}

export function patchBounty(id, payload) {
  return req(`/api/bounties/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
