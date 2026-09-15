/** Upstash Redis REST. Commands as JSON arrays to the base URL. */

function cfg() {
  const url = process.env.UPSTASH_REDIS_REST_URL || '';
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || '';
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ''), token };
}

export function redisConfigured() {
  return !!cfg();
}

async function redis(...cmds) {
  const c = cfg();
  if (!c) {
    const err = new Error('Database is not configured (UPSTASH_REDIS_REST_URL / TOKEN)');
    err.code = 'no_db';
    throw err;
  }
  const isPipeline = cmds.length > 1;
  const url = isPipeline ? `${c.url}/pipeline` : c.url;
  const payload = isPipeline ? cmds : cmds[0];
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${c.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Redis ${res.status}: ${text.slice(0, 200)}`);
  }
  const body = await res.json();
  if (body.error) throw new Error(body.error);
  // pipeline: [{result|error}, ...]; single: result
  if (isPipeline) {
    const rows = Array.isArray(body) ? body : [];
    const firstErr = rows.find((r) => r && r.error);
    if (firstErr) throw new Error(firstErr.error);
    return rows.map((r) => (r && 'result' in r ? r.result : null));
  }
  return body.result;
}

export async function getJson(key) {
  const raw = await redis(['GET', key]);
  if (raw == null) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
}

export async function setJson(key, value) {
  await redis(['SET', key, JSON.stringify(value)]);
}

export async function delKey(key) {
  await redis(['DEL', key]);
}

const USERS = 'gr:users';
const BOUNTY_IDS = 'gr:bounty_ids';

export function userKey(githubId) {
  return `gr:user:${githubId}`;
}

export function bountyKey(id) {
  return `gr:bounty:${id}`;
}

export async function upsertUser({ githubId, login, avatar, name, accessToken }) {
  const key = userKey(githubId);
  const prev = (await getJson(key)) || {};
  const next = {
    githubId,
    login,
    avatar: avatar || '',
    name: name || '',
    payoutWallet: prev.payoutWallet || '',
    payoutUpdatedAt: prev.payoutUpdatedAt || null,
    githubConnectedAt: prev.githubConnectedAt || new Date().toISOString(),
    // server-only; never sent to the client
    accessToken: accessToken || prev.accessToken || '',
  };
  await setJson(key, next);
  return next;
}

export async function getUser(githubId) {
  return getJson(userKey(githubId));
}

export async function setUserPayout(githubId, payoutWallet) {
  const user = await getUser(githubId);
  if (!user) return null;
  const next = {
    ...user,
    payoutWallet: String(payoutWallet || '').trim(),
    payoutUpdatedAt: new Date().toISOString(),
  };
  await setJson(userKey(githubId), next);
  return next;
}

/** Public shape — no access token. */
export function publicUser(user) {
  if (!user) return null;
  return {
    githubId: user.githubId,
    login: user.login,
    avatar: user.avatar || '',
    name: user.name || '',
    payoutWallet: user.payoutWallet || '',
    githubConnected: true,
    githubConnectedAt: user.githubConnectedAt || '',
  };
}

export async function listBountyIds() {
  const ids = await getJson(BOUNTY_IDS);
  return Array.isArray(ids) ? ids : [];
}

export async function saveBountyIds(ids) {
  await setJson(BOUNTY_IDS, ids);
}

export async function listBounties() {
  const ids = await listBountyIds();
  if (!ids.length) return [];
  const keys = ids.map((id) => ['GET', bountyKey(id)]);
  const raw = await redis(...keys);
  const rows = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const row of rows) {
    if (row == null) continue;
    try {
      out.push(typeof row === 'string' ? JSON.parse(row) : row);
    } catch {
      /* skip */
    }
  }
  // preserve index order
  const byId = new Map(out.map((b) => [b.id, b]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

export async function getBounty(id) {
  return getJson(bountyKey(id));
}

export async function saveBounty(bounty) {
  await setJson(bountyKey(bounty.id), bounty);
  const ids = await listBountyIds();
  if (!ids.includes(bounty.id)) {
    await saveBountyIds([bounty.id, ...ids]);
  }
  return bounty;
}

export async function updateBounty(id, mutator) {
  const current = await getBounty(id);
  if (!current) return null;
  const next = typeof mutator === 'function' ? mutator(current) : { ...current, ...mutator };
  if (!next || next.id !== id) return null;
  await saveBounty(next);
  return next;
}
