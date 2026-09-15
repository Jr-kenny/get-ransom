import {
  createSessionToken,
  clearSessionCookie,
  setSessionCookie,
  sessionConfigured,
} from '../../lib/session.js';
import { upsertUser, publicUser, redisConfigured } from '../../lib/store.js';
import { readJson, noStore } from '../../lib/http.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.VITE_GITHUB_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const { code } = (await readJson(req)) || {};

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'GitHub OAuth is not configured' });
  }
  if (!redisConfigured()) {
    return res.status(500).json({ error: 'Database is not configured' });
  }
  if (!sessionConfigured()) {
    return res.status(500).json({ error: 'SESSION_SECRET is not set' });
  }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing code' });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    const tokenBody = await tokenRes.json();
    if (!tokenRes.ok || !tokenBody.access_token) {
      return res.status(400).json({
        error: tokenBody.error_description || tokenBody.error || 'Token exchange failed',
      });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenBody.access_token}`,
        'User-Agent': 'get-ransom',
      },
    });
    const gh = await userRes.json();
    if (!userRes.ok || !gh.login) {
      return res.status(400).json({ error: gh.message || 'Could not load GitHub user' });
    }

    const user = await upsertUser({
      githubId: gh.id,
      login: gh.login,
      avatar: gh.avatar_url || '',
      name: gh.name || '',
      accessToken: tokenBody.access_token,
    });

    const token = createSessionToken(gh.id, gh.login);
    setSessionCookie(res, token);

    return res.status(200).json({ user: publicUser(user) });
  } catch (err) {
    if (err?.code === 'no_db' || err?.code === 'no_session') {
      return res.status(500).json({ error: err.message });
    }
    return res.status(500).json({ error: err?.message || 'OAuth exchange failed' });
  }
}
