import crypto from 'node:crypto';

const COOKIE = 'gr_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function secret() {
  return process.env.SESSION_SECRET || '';
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function hmac(data) {
  return crypto.createHmac('sha256', secret()).update(data).digest('base64url');
}

export function sessionConfigured() {
  return !!secret();
}

export function createSessionToken(githubId, login) {
  if (!sessionConfigured()) {
    const err = new Error('SESSION_SECRET is not set');
    err.code = 'no_session';
    throw err;
  }
  const payload = b64url(
    JSON.stringify({
      githubId,
      login,
      iat: Date.now(),
      exp: Date.now() + MAX_AGE * 1000,
    }),
  );
  return `${payload}.${hmac(payload)}`;
}

export function verifySessionToken(token) {
  if (!token || !sessionConfigured()) return null;
  const i = token.lastIndexOf('.');
  if (i < 1) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.githubId || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const header = req.headers?.cookie || '';
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function readSession(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[COOKIE]);
}

export function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`,
  );
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`,
  );
}
