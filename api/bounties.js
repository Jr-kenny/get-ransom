import { readSession } from '../lib/session.js';
import {
  redisConfigured,
  listBounties,
  saveBounty,
  getUser,
} from '../lib/store.js';
import { readJson, noStore } from '../lib/http.js';

function uid(prefix) {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* node */
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default async function handler(req, res) {
  noStore(res);
  try {
    if (!redisConfigured()) {
      return res.status(500).json({ error: 'Service temporarily unavailable' });
    }

    if (req.method === 'GET') {
      const list = await listBounties();
      return res.status(200).json({ bounties: list });
    }

    if (req.method === 'POST') {
      const session = readSession(req);
      if (!session) return res.status(401).json({ error: 'Sign in with GitHub first' });
      const user = await getUser(session.githubId);
      if (!user) return res.status(401).json({ error: 'Session user not found' });

      const body = (await readJson(req)) || {};
      const base = Math.max(1, Math.round(Number(body.base) || 0));
      const title = String(body.title || '').trim();
      const bodyText = String(body.body || '').trim();
      const repo = String(body.repo || '').trim();
      if (title.length < 8 || bodyText.length < 20 || !repo) {
        return res.status(400).json({ error: 'Invalid bounty fields' });
      }
      if (!body.promise?.signature) {
        return res.status(400).json({ error: 'Signed promise required' });
      }

      const id = uid('gr');
      const now = new Date().toISOString();
      const bounty = {
        id,
        kind: 'github',
        title,
        body: bodyText,
        repo,
        issueUrl: String(body.issueUrl || '').trim(),
        issueNumber: body.issueNumber ?? null,
        issueAssignees: Array.isArray(body.issueAssignees) ? body.issueAssignees.slice(0, 20) : [],
        requireAssignment:
          !!body.requireAssignment &&
          Array.isArray(body.issueAssignees) &&
          body.issueAssignees.length > 0,
        tags: Array.isArray(body.tags) ? body.tags.slice(0, 5) : [],
        paymentMode: 'on-solve',
        base,
        topups: [],
        promises: [
          {
            id: uid('p'),
            role: 'creator',
            by: user.payoutWallet || `github:${user.login}`,
            githubUser: user.login,
            githubId: user.githubId,
            amount: base,
            signature: body.promise.signature,
            publicKey: body.promise.publicKey || '',
            method: body.promise.method || 'pay',
            message: body.promise.message || '',
            at: now.slice(0, 10),
          },
        ],
        fundTx: null,
        status: 'open',
        creator: user.payoutWallet || `github:${user.login}`,
        creatorGithub: user.login,
        creatorGithubId: user.githubId,
        createdAt: now.slice(0, 10),
        updatedAt: now,
        claims: [],
      };

      await saveBounty(bounty);
      return res.status(201).json({ bounty });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('bounties handler', err);
    return res.status(500).json({ error: 'Service temporarily unavailable' });
  }
}
