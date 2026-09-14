export default async function handler(req, res) {
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
    const user = await userRes.json();
    if (!userRes.ok || !user.login) {
      return res.status(400).json({ error: user.message || 'Could not load GitHub user' });
    }

    return res.status(200).json({
      login: user.login,
      id: user.id,
      avatar: user.avatar_url || '',
      name: user.name || '',
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'OAuth exchange failed' });
  }
}

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return null;
  }
}
