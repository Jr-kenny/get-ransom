import { readSession } from '../../lib/session.js';
import {
  redisConfigured,
  getBounty,
  updateBounty,
  getUser,
} from '../../lib/store.js';
import { readJson, noStore } from '../../lib/http.js';

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export default async function handler(req, res) {
  noStore(res);
  if (!redisConfigured()) {
    return res.status(500).json({ error: 'Database is not configured' });
  }

  const id = String(req.query.id || '');
  if (!id) return res.status(400).json({ error: 'Missing id' });

  if (req.method === 'GET') {
    const bounty = await getBounty(id);
    if (!bounty) return res.status(404).json({ error: 'Not found' });
    return res.status(200).json({ bounty });
  }

  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'GET, PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = readSession(req);
  if (!session) return res.status(401).json({ error: 'Sign in with GitHub first' });
  const user = await getUser(session.githubId);
  if (!user) return res.status(401).json({ error: 'Session user not found' });

  const body = (await readJson(req)) || {};
  const action = String(body.action || '');
  const existing = await getBounty(id);
  if (!existing) return res.status(404).json({ error: 'Not found' });

  const now = new Date().toISOString();

  if (action === 'pledge') {
    const amount = Math.max(1, Math.round(Number(body.amount) || 0));
    if (!body.promise?.signature) {
      return res.status(400).json({ error: 'Signed promise required' });
    }
    const entry = {
      id: uid('p'),
      role: 'pledge',
      by: user.payoutWallet || `github:${user.login}`,
      githubUser: user.login,
      githubId: user.githubId,
      amount,
      signature: body.promise.signature,
      publicKey: body.promise.publicKey || '',
      method: body.promise.method || 'pay',
      message: body.promise.message || '',
      at: now.slice(0, 10),
    };
    const bounty = await updateBounty(id, (b) => ({
      ...b,
      promises: [...(b.promises || []), entry],
      topups: [
        ...(b.topups || []),
        {
          by: user.payoutWallet || `github:${user.login}`,
          githubUser: user.login,
          amount,
          txHash: null,
          pledged: true,
          signature: body.promise.signature,
          at: entry.at,
        },
      ],
      updatedAt: now,
    }));
    return res.status(200).json({ bounty });
  }

  if (action === 'claim') {
    const prUrl = String(body.prUrl || '').trim();
    if (!prUrl) return res.status(400).json({ error: 'PR URL required' });
    if (!user.payoutWallet) {
      return res.status(400).json({ error: 'Save a payout wallet in Settings first' });
    }
    const bounty = await updateBounty(id, (b) => {
      if (b.claims.some((c) => c.ref === prUrl)) return b;
      return {
        ...b,
        status: b.status === 'open' ? 'review' : b.status,
        claims: [
          ...b.claims,
          {
            id: uid('c'),
            by: user.payoutWallet || `github:${user.login}`,
            githubUser: user.login,
            githubId: user.githubId,
            hunterAddr: user.payoutWallet,
            payoutWallet: user.payoutWallet,
            ref: prUrl,
            note: '',
            state: body.prMerged ? 'merged' : 'in-review',
            prMerged: !!body.prMerged,
            prState: body.prState || '',
            at: now.slice(0, 10),
            payoutTx: null,
            payoutHeld: false,
            relayer: null,
          },
        ],
        updatedAt: now,
      };
    });
    return res.status(200).json({ bounty });
  }

  if (action === 'decide') {
    const claimId = String(body.claimId || '');
    const accept = !!body.accept;
    const isCreator =
      existing.creatorGithubId === user.githubId || existing.creatorGithub === user.login;
    if (!isCreator) return res.status(403).json({ error: 'Only the bounty creator can decide' });

    const bounty = await updateBounty(id, (b) => {
      const claims = b.claims.map((c) => {
        if (c.id !== claimId) {
          return accept ? { ...c, state: c.state === 'accepted' ? c.state : 'rejected' } : c;
        }
        return {
          ...c,
          state: accept ? 'accepted' : 'rejected',
          payoutHeld: false,
          payoutTx: body.payoutTx || c.payoutTx,
          relayer: body.relayer || c.relayer,
        };
      });
      return {
        ...b,
        claims,
        status: accept
          ? 'paid'
          : claims.some((c) => c.state === 'in-review' || c.state === 'merged' || c.payoutHeld)
            ? 'review'
            : 'open',
        updatedAt: now,
      };
    });
    return res.status(200).json({ bounty });
  }

  if (action === 'retract') {
    const isCreator =
      existing.creatorGithubId === user.githubId || existing.creatorGithub === user.login;
    if (!isCreator) return res.status(403).json({ error: 'Only the bounty creator can retract' });
    const bounty = await updateBounty(id, (b) => {
      if (b.claims.some((c) => c.state === 'in-review')) return b;
      return { ...b, status: 'retracted', updatedAt: now };
    });
    return res.status(200).json({ bounty });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
