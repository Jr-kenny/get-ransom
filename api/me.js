import { readSession } from '../lib/session.js';
import { getUser, setUserPayout, publicUser, redisConfigured } from '../lib/store.js';
import { readJson, noStore } from '../lib/http.js';
import { isValidNimiqAddress } from '../lib/nimiq-addr.js';

export default async function handler(req, res) {
  noStore(res);
  if (!redisConfigured()) {
    return res.status(500).json({ error: 'Database is not configured' });
  }

  const session = readSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Not signed in' });
  }

  if (req.method === 'GET') {
    const user = await getUser(session.githubId);
    if (!user) return res.status(401).json({ error: 'Session user not found' });
    return res.status(200).json({ user: publicUser(user) });
  }

  if (req.method === 'PATCH') {
    const body = (await readJson(req)) || {};
    if (body.payoutWallet !== undefined) {
      const wallet = String(body.payoutWallet || '').trim();
      if (wallet && !isValidNimiqAddress(wallet)) {
        return res.status(400).json({ error: 'Invalid NIM address' });
      }
      const user = await setUserPayout(session.githubId, wallet);
      if (!user) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ user: publicUser(user) });
    }
    return res.status(400).json({ error: 'Nothing to update' });
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
