import { clearSessionCookie } from '../../lib/session.js';
import { noStore } from '../../lib/http.js';

export default async function handler(req, res) {
  noStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
