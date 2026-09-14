import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LighthouseScene from './components/LighthouseScene.jsx';
import DocsPage from './Docs.jsx';
import { loadBounties, saveBounties, bountyTotal, uid, shortAddr } from './store.js';
import {
  connectNimiq,
  payLanguage,
  inNimiqPay,
  sendNim,
  listNimiqAccounts,
  importGitHubIssue,
  importGitHubPull,
  isAssignedTo,
  getTreasuryAddress,
  mockTxHash,
  loadProfile,
  saveProfile,
  relayerPayout,
  fetchGitHubUser,
  beginGitHubOAuth,
  readGitHubOAuthReturn,
  githubClientId,
  demoConnectGitHub,
} from './nimiq.js';

const STATUS_LABEL = {
  open: 'Open',
  review: 'In review',
  paid: 'Paid',
  retracted: 'Retracted',
};

function StatusBadge({ status }) {
  return <span className={`badge ${status}`}>{STATUS_LABEL[status] || status}</span>;
}

function ModeBadge({ mode }) {
  return (
    <span className="badge type">{mode === 'prepaid' ? '◈ prepaid' : '◷ pay on solve'}</span>
  );
}

function useWallet() {
  const [address, setAddress] = useState(() => {
    try {
      return localStorage.getItem('gr-wallet') || '';
    } catch {
      return '';
    }
  });
  const [providerState, setProviderState] = useState('idle');
  const [connecting, setConnecting] = useState(false);

  const persist = useCallback((addr) => {
    setAddress(addr || '');
    try {
      if (addr) localStorage.setItem('gr-wallet', addr);
      else localStorage.removeItem('gr-wallet');
    } catch { /* noop */ }
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!inNimiqPay()) {
      setProviderState(address ? 'ready' : 'browser');
      return () => {};
    }
    (async () => {
      setProviderState('connecting');
      try {
        await connectNimiq(6000);
        const accounts = await listNimiqAccounts();
        if (!cancelled && accounts[0]) {
          persist(accounts[0]);
          setProviderState('ready');
        } else if (!cancelled) {
          setProviderState('ready');
        }
      } catch {
        if (!cancelled) setProviderState(address ? 'ready' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persist, address]);

  const connectReal = useCallback(async () => {
    setConnecting(true);
    try {
      if (!inNimiqPay()) throw new Error('Open inside Nimiq Pay for a real wallet');
      await connectNimiq(10_000);
      const accounts = await listNimiqAccounts();
      if (accounts[0]) {
        persist(accounts[0]);
        setProviderState('ready');
        return accounts[0];
      }
      throw new Error('No accounts in wallet');
    } finally {
      setConnecting(false);
    }
  }, [persist]);

  const connectMock = useCallback(() => {
    const mock = `NQ${Math.floor(Math.random() * 90 + 10)} ${Date.now().toString(36).slice(-4).toUpperCase()} DEMO`;
    persist(mock);
    setProviderState('ready');
    return mock;
  }, [persist]);

  const disconnect = useCallback(() => {
    persist('');
    setProviderState(inNimiqPay() ? 'ready' : 'browser');
  }, [persist]);

  return {
    address,
    providerState,
    connecting,
    connectReal,
    connectMock,
    disconnect,
    setAddress: persist,
    lang: payLanguage(),
    inPay: inNimiqPay(),
  };
}

function GitHubConnect({ profile, onProfileSave, compact }) {
  const clientId = githubClientId();
  const [busy, setBusy] = useState(false);

  function applyConnected(user) {
    onProfileSave({
      ...profile,
      githubUser: user.login,
      githubId: user.id,
      githubAvatar: user.avatar || '',
      githubConnected: true,
      githubConnectedAt: new Date().toISOString().slice(0, 10),
    });
  }

  if (profile.githubConnected) {
    return (
      <div className="gh-connected">
        {profile.githubAvatar ? (
          <img src={profile.githubAvatar} alt="" className="gh-avatar" width="28" height="28" />
        ) : (
          <span className="profile-avatar sm">{(profile.githubUser || '?').slice(0, 1).toUpperCase()}</span>
        )}
        <span>
          <b>@{profile.githubUser}</b>
          {!compact && <span className="muted"> · bound to this wallet</span>}
        </span>
      </div>
    );
  }

  return (
    <div className="gh-connect">
      <button
        type="button"
        className="btn primary"
        disabled={busy}
        onClick={() => {
          if (clientId) {
            const url = beginGitHubOAuth();
            if (url) window.location.href = url;
            return;
          }
          setBusy(true);
          applyConnected(demoConnectGitHub());
          setBusy(false);
        }}
      >
        {busy ? 'Connecting…' : 'Connect GitHub'}
      </button>
    </div>
  );
}

function ProfileMenu({ wallet, profile, setRoute, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onDoc(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const go = (name) => {
    setOpen(false);
    setRoute({ name });
  };

  const initial = (profile.githubUser || wallet.address || '?').slice(0, 1).toUpperCase();

  return (
    <div className="profile-wrap" ref={ref}>
      {!wallet.address ? (
        <div className="wallet-actions">
          <button
            className="btn small primary"
            disabled={wallet.connecting}
            onClick={async () => {
              try {
                await wallet.connectReal();
              } catch {
                wallet.connectMock();
              }
            }}
          >
            {wallet.connecting ? 'Connecting…' : wallet.inPay ? 'Connect wallet' : 'Connect (demo)'}
          </button>
        </div>
      ) : (
        <button
          className="profile-btn"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <span className="profile-avatar" aria-hidden="true">
            {profile.githubAvatar ? <img src={profile.githubAvatar} alt="" width="32" height="32" /> : initial}
          </span>
          <span className="profile-meta">
            <b>{profile.githubConnected ? `@${profile.githubUser}` : shortAddr(wallet.address)}</b>
            <span>{wallet.inPay ? 'nimiq pay' : 'browser'}</span>
          </span>
        </button>
      )}

      {open && wallet.address && (
        <div className="profile-menu" role="menu">
          <div className="profile-menu-head">
            <span>{profile.githubConnected ? `@${profile.githubUser}` : 'Wallet'}</span>
            <b style={{ overflowWrap: 'anywhere' }}>{wallet.address}</b>
          </div>
          <button role="menuitem" onClick={() => go('settings')}>
            Settings
          </button>
          <button role="menuitem" onClick={() => go('create')}>
            Create new bounty
          </button>
          <button role="menuitem" onClick={() => go('dashboard')}>
            Dashboard
          </button>
          <button role="menuitem" onClick={() => go('my-bounties')}>
            My bounties
          </button>
          <button role="menuitem" onClick={() => go('my-claims')}>
            My claims
          </button>
          <button role="menuitem" onClick={() => go('payouts')}>
            Payouts
          </button>
          <button role="menuitem" onClick={() => go('docs')}>
            Docs
          </button>
          <button role="menuitem" onClick={() => go('browse')}>
            Explore
          </button>
          <hr />
          <button
            role="menuitem"
            className="danger"
            onClick={() => {
              setOpen(false);
              onDisconnect();
            }}
          >
            Disconnect wallet
          </button>
        </div>
      )}
    </div>
  );
}

const ROUTE_KEY = 'gr-route-v1';

function loadRoute(bounties) {
  try {
    const raw = localStorage.getItem(ROUTE_KEY);
    if (!raw) return { name: 'landing' };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.name !== 'string') return { name: 'landing' };
    if (parsed.name === 'detail') {
      const exists = Array.isArray(bounties) && bounties.some((b) => b.id === parsed.id);
      return exists ? parsed : { name: 'browse' };
    }
    const ok = ['landing', 'browse', 'create', 'dashboard', 'my-bounties', 'my-claims', 'payouts', 'settings', 'docs'];
    return ok.includes(parsed.name) ? parsed : { name: 'landing' };
  } catch {
    return { name: 'landing' };
  }
}

function saveRoute(route) {
  try {
    localStorage.setItem(ROUTE_KEY, JSON.stringify(route));
  } catch { /* noop */ }
}

export default function App() {
  const [bounties, setBounties] = useState(() => loadBounties());
  const [route, setRoute] = useState(() => loadRoute(bounties));
  const [profile, setProfile] = useState(() => loadProfile());
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [actionModal, setActionModal] = useState(null);
  const wallet = useWallet();

  function openSettingsGate(title, body) {
    setActionModal({ title, body });
  }

  useEffect(() => saveBounties(bounties), [bounties]);
  useEffect(() => saveRoute(route), [route]);

  // GitHub OAuth return (when VITE_GITHUB_CLIENT_ID is set)
  useEffect(() => {
    const ret = readGitHubOAuthReturn();
    if (!ret?.code) return;
    // Token exchange needs a backend; keep the code briefly for that hop.
    setToast('GitHub OAuth returned — complete token exchange on the server to finish connect.');
  }, []);

  useEffect(() => {
    if (route.name !== 'detail') return;
    const exists = bounties.some((b) => b.id === route.id);
    if (!exists) setRoute({ name: 'browse' });
  }, [route, bounties]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(''), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const stats = useMemo(() => {
    const open = bounties.filter((b) => b.status === 'open' || b.status === 'review');
    const pot = open.reduce((s, b) => s + bountyTotal(b), 0);
    return { open: open.length, pot };
  }, [bounties]);

  const earnedNim = useMemo(() => {
    return bounties
      .flatMap((b) => b.claims.map((c) => ({ c, b })))
      .filter(({ c }) => c.state === 'accepted' && !c.payoutHeld)
      .filter(
        ({ c }) =>
          (profile.githubUser && c.githubUser === profile.githubUser) ||
          (wallet.address && c.by === wallet.address),
      )
      .reduce((s, { b }) => s + bountyTotal(b), 0);
  }, [bounties, profile.githubUser, wallet.address]);

  function updateBounty(id, fn) {
    setBounties((prev) => prev.map((b) => (b.id === id ? fn(b) : b)));
  }

  async function createBounty(data) {
    const base = Math.max(1, Math.round(Number(data.base) || 0));
    const id = uid('gr');
    const creator = wallet.address || 'anon';
    let fundTx = null;

    if (data.paymentMode === 'prepaid') {
      const treasury = getTreasuryAddress();
      if (wallet.inPay) {
        setBusy(`Sending ${base} NIM to escrow…`);
        try {
          fundTx = await sendNim({ recipient: treasury, nim: base, memo: `bounty:create:${id}` });
        } catch (err) {
          setToast(err?.message || 'Funding cancelled');
          setBusy('');
          return;
        }
      } else {
        fundTx = mockTxHash('fund');
      }
    }

    const assignees = data.issueAssignees || [];
    const b = {
      id,
      kind: data.kind,
      title: data.title.trim(),
      body: data.body.trim(),
      repo: data.repo.trim(),
      issueUrl: data.issueUrl.trim(),
      issueNumber: data.issueNumber ?? null,
      issueAssignees: assignees,
      requireAssignment: assignees.length > 0,
      tags: data.tags,
      paymentMode: data.paymentMode,
      base,
      topups: [],
      fundTx,
      status: 'open',
      creator,
      createdAt: new Date().toISOString().slice(0, 10),
      claims: [],
    };
    setBounties((prev) => [b, ...prev]);
    setBusy('');
    setToast(fundTx ? `Bounty live · ${String(fundTx).slice(0, 16)}…` : 'Bounty published');
    setRoute({ name: 'detail', id: b.id });
  }

  async function addTopup(id, amount) {
    const amt = Math.round(Number(amount));
    if (!amt || amt < 1) return;
    const bounty = bounties.find((b) => b.id === id);
    if (!bounty || bounty.status === 'paid' || bounty.status === 'retracted') return;

    let txHash = null;
    if (wallet.inPay) {
      const treasury = getTreasuryAddress();
      setBusy(`Sending ${amt} NIM top-up…`);
      try {
        txHash = await sendNim({ recipient: treasury, nim: amt, memo: `bounty:topup:${id}` });
      } catch (err) {
        setToast(err?.message || 'Top-up cancelled');
        setBusy('');
        return;
      }
    } else {
      txHash = mockTxHash('topup');
    }

    updateBounty(id, (b) => ({
      ...b,
      topups: [...b.topups, { by: wallet.address || 'anon', amount: amt, txHash }],
    }));
    setBusy('');
    setToast(`Top-up · ${String(txHash).slice(0, 16)}…`);
  }

  async function addClaim(id, prUrl) {
    if (!prUrl.trim()) return;
    const bounty = bounties.find((b) => b.id === id);
    if (!bounty) return;

    if (!profile.githubConnected) {
      openSettingsGate(
        'Connect GitHub',
        'Link your GitHub account in Settings before claiming a bounty.',
      );
      return;
    }
    if (!profile.payoutWallet) {
      openSettingsGate(
        'Add payout wallet',
        'Save a NIM payout wallet in Settings so the relayer can pay you.',
      );
      return;
    }

    setBusy('Importing PR…');
    let prMeta = null;
    try {
      prMeta = await importGitHubPull(prUrl);
    } catch (err) {
      if (bounty.kind === 'github') {
        setToast(err?.message || 'Could not import that PR');
        setBusy('');
        return;
      }
    }
    setBusy('');

    const ghUser = profile.githubUser;
    const prAuthor = (prMeta?.author || '').trim();
    const assigned = bounty.issueAssignees || [];

    if (bounty.kind === 'github' && prAuthor && prAuthor.toLowerCase() !== ghUser.toLowerCase()) {
      setToast(`PR author @${prAuthor} must match your connected GitHub @${ghUser}.`);
      return;
    }

    if (bounty.kind === 'github' && assigned.length > 0) {
      if (!isAssignedTo(assigned, ghUser)) {
        setToast(`Issue is assigned to ${assigned.join(', ')} — only they can claim.`);
        return;
      }
    }

    const prMerged = !!(prMeta && prMeta.merged);

    updateBounty(id, (b) => {
      if (b.claims.some((c) => c.ref === prUrl.trim())) {
        setToast('That PR is already claimed.');
        return b;
      }
      return {
        ...b,
        status: b.status === 'open' ? 'review' : b.status,
        claims: [
          ...b.claims,
          {
            id: uid('c'),
            by: wallet.address || 'anon',
            githubUser: ghUser,
            hunterAddr: wallet.address || '',
            payoutWallet: profile.payoutWallet || '',
            ref: prUrl.trim(),
            note: '',
            state: prMerged ? 'merged' : 'in-review',
            prMerged,
            prState: prMeta?.state || '',
            at: new Date().toISOString().slice(0, 10),
            payoutTx: null,
            payoutHeld: false,
            relayer: null,
          },
        ],
      };
    });
    setToast(prMerged ? 'PR already merged — ready to pay' : 'Claim submitted · pay on merge');
  }

  async function decideClaim(bountyId, claimId, accept) {
    const bounty = bounties.find((b) => b.id === bountyId);
    if (!bounty) return;
    const claim = bounty.claims.find((c) => c.id === claimId);
    if (!claim) return;
    const pot = bountyTotal(bounty);
    let relayer = null;
    let payoutTx = null;

    if (accept) {
      // Pay only when the PR is merged (or re-check live)
      let merged = claim.prMerged;
      if (!merged && claim.ref) {
        setBusy('Checking PR merge…');
        try {
          const pr = await importGitHubPull(claim.ref);
          merged = !!pr.merged;
          if (!merged) {
            setToast('PR is not merged yet. Wait for merge — that picks the winner.');
            setBusy('');
            return;
          }
        } catch {
          setToast('Could not verify PR merge status.');
          setBusy('');
          return;
        }
      }
      if (!merged) {
        setToast('Pay on merge only.');
        setBusy('');
        return;
      }

      const to = claim.payoutWallet || profile.payoutWallet || '';
      if (!to) {
        updateBounty(bountyId, (b) => {
          const claims = b.claims.map((c) => {
            if (c.id !== claimId) return { ...c, state: 'rejected' };
            return {
              ...c,
              state: 'accepted',
              payoutHeld: true,
              payoutTx: null,
              relayer: null,
            };
          });
          return { ...b, claims, status: 'review' };
        });
        setToast('Accepted · payout held until hunter saves a wallet');
        setBusy('');
        return;
      }

      setBusy(`Relayer paying ${pot} NIM…`);
      try {
        relayer = await relayerPayout({
          to,
          nim: pot,
          memo: `bounty:pay:${bountyId}`,
        });
        payoutTx = relayer.txHash;
        setToast(`Relayer paid ${shortAddr(to)} · ${String(payoutTx).slice(0, 14)}…`);
      } catch (err) {
        setToast(err?.message || 'Relayer payout failed');
        setBusy('');
        return;
      }
    }

    updateBounty(bountyId, (b) => {
      const claims = b.claims.map((c) => {
        if (c.id !== claimId) return accept ? { ...c, state: 'rejected' } : c;
        return {
          ...c,
          state: accept ? 'accepted' : 'rejected',
          payoutHeld: false,
          payoutTx: accept ? payoutTx : null,
          relayer: accept ? relayer : null,
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
      };
    });
    setBusy('');
  }

  async function releaseHeldPayouts(nextProfile) {
    const walletAddr = nextProfile.payoutWallet;
    if (!walletAddr) return;
    const held = [];
    for (const b of bounties) {
      for (const c of b.claims) {
        if (c.payoutHeld && c.state === 'accepted') {
          held.push({ bountyId: b.id, claimId: c.id, pot: bountyTotal(b) });
        }
      }
    }
    if (!held.length) return;
    for (const item of held) {
      setBusy(`Releasing held payout ${item.pot} NIM…`);
      try {
        const receipt = await relayerPayout({
          to: walletAddr,
          nim: item.pot,
          memo: `bounty:pay:${item.bountyId}`,
        });
        updateBounty(item.bountyId, (b) => ({
          ...b,
          status: 'paid',
          claims: b.claims.map((c) =>
            c.id === item.claimId
              ? {
                  ...c,
                  payoutWallet: walletAddr,
                  payoutHeld: false,
                  payoutTx: receipt.txHash,
                  relayer: receipt,
                }
              : c,
          ),
        }));
      } catch {
        /* leave held */
      }
    }
    setBusy('');
    setToast(`Released ${held.length} held payout${held.length > 1 ? 's' : ''}`);
  }

  function handleProfileSave(next) {
    const saved = saveProfile(next);
    setProfile(saved);
    setToast('Payout settings saved');
    if (saved.payoutWallet) void releaseHeldPayouts(saved);
  }

  function retractBounty(id) {
    updateBounty(id, (b) => {
      if (b.claims.some((c) => c.state === 'in-review')) {
        setToast('Resolve open claims before retracting');
        return b;
      }
      return { ...b, status: 'retracted' };
    });
  }

  const filtered = bounties.filter((b) => {
    if (kindFilter !== 'all' && b.kind !== kindFilter) return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${b.title} ${b.body} ${b.repo} ${b.tags.join(' ')}`.toLowerCase().includes(q);
  });

  const active = route.name === 'detail' ? bounties.find((b) => b.id === route.id) : null;
  const myBounties = bounties.filter((b) => b.creator === wallet.address);
  const myClaims = bounties.flatMap((b) =>
    b.claims
      .filter((c) => c.by === wallet.address || c.payoutWallet === profile.payoutWallet)
      .map((c) => ({ ...c, bounty: b })),
  );

  if (route.name === 'landing') {
    return (
      <div className="scene">
        <LighthouseScene storm={1} />
        <div className="landing-inner">
          <p className="kicker">Get Ransom · a Nimiq Pay mini-app</p>
          <h1>
            Keep the <em>light</em> on for open work
          </h1>
          <p className="lede">
            Import a GitHub issue, set the NIM pot, ship a PR. Complete → relayer pays.
          </p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => setRoute({ name: 'browse' })}>
              Explore bounties
            </button>
            <button
              className="btn"
              onClick={() => {
                if (!wallet.address) {
                  try {
                    wallet.connectReal();
                  } catch {
                    wallet.connectMock();
                  }
                }
                setRoute({ name: 'create' });
              }}
            >
              Create a bounty
            </button>
            <button className="btn ghost" onClick={() => setRoute({ name: 'docs' })}>
              Docs
            </button>
          </div>
          <div className="stat-strip" aria-label="Bounty stats">
            <div className="stat">
              <span>Open bounties</span>
              <b>{stats.open}</b>
            </div>
            <div className="stat">
              <span>In the pots</span>
              <b>
                {stats.pot.toLocaleString()}
                <i>NIM</i>
              </b>
            </div>
          </div>
          <div className="how">
            <div>
              <b>01 · Import</b>
              Paste a GitHub issue URL.
            </div>
            <div>
              <b>02 · Crowdfund</b>
              Top up the pot in NIM.
            </div>
            <div>
              <b>03 · Relayer</b>
              Complete → pays saved wallet.
            </div>
          </div>
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 4 }}>
            <ProfileMenu
              wallet={wallet}
              profile={profile}
              setRoute={setRoute}
              onDisconnect={wallet.disconnect}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setRoute({ name: 'landing' })} aria-label="Back to landing">
          <span className="brand-dot" aria-hidden="true" />
          <span>
            <b>Get Ransom</b>
            <span>bounty hub · nimiq</span>
          </span>
        </button>
        <nav className="top-nav" aria-label="Primary">
          <button
            className={route.name === 'browse' || route.name === 'detail' || route.name === 'create' ? 'nav-link active' : 'nav-link'}
            onClick={() => setRoute({ name: 'browse' })}
          >
            Explore
          </button>
          <button
            className={route.name === 'docs' ? 'nav-link active' : 'nav-link'}
            onClick={() => setRoute({ name: 'docs' })}
          >
            Docs
          </button>
        </nav>
        <span className="env-pill top-env">
          {wallet.inPay ? `nimiq pay · ${wallet.lang}` : 'browser preview'}
        </span>
        <ProfileMenu
          wallet={wallet}
          profile={profile}
          setRoute={setRoute}
          onDisconnect={wallet.disconnect}
        />
      </header>

      <main className="main">
        {busy && <div className="notice busy">{busy}</div>}
        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        {actionModal && (
          <div className="modal-backdrop" onClick={() => setActionModal(null)}>
            <div
              className="modal"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={actionModal.title}
            >
              <h3>{actionModal.title}</h3>
              <p className="muted" style={{ marginTop: 0 }}>
                {actionModal.body}
              </p>
              <div className="row">
                <button
                  className="btn primary"
                  onClick={() => {
                    setActionModal(null);
                    setRoute({ name: 'settings' });
                  }}
                >
                  Go to Settings
                </button>
                <button className="btn ghost" onClick={() => setActionModal(null)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {route.name === 'browse' && (
          <>
            <div className="toolbar">
              <div className="search">
                <span aria-hidden="true" style={{ color: 'var(--muted)' }}>
                  ⌕
                </span>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search bounties, repos, tags…"
                  aria-label="Search bounties"
                />
              </div>
              <div className="chip-row" role="group" aria-label="Kind filter">
                {[['all', 'All'], ['github', 'GitHub'], ['task', 'Tasks']].map(([v, l]) => (
                  <button key={v} className="chip" aria-pressed={kindFilter === v} onClick={() => setKindFilter(v)}>
                    {l}
                  </button>
                ))}
              </div>
              <div className="chip-row" role="group" aria-label="Status filter">
                {[['all', 'Any state'], ['open', 'Open'], ['review', 'In review'], ['paid', 'Paid']].map(([v, l]) => (
                  <button
                    key={v}
                    className="chip"
                    aria-pressed={statusFilter === v}
                    onClick={() => setStatusFilter(v)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid">
              {filtered.map((b) => (
                <article key={b.id} className="card">
                  <div className="meta">
                    <StatusBadge status={b.status} />
                    <ModeBadge mode={b.paymentMode} />
                    <span className="badge type">{b.kind === 'github' ? '⌥ github' : '✦ task'}</span>
                    {b.repo && <span>{b.repo}</span>}
                    {b.issueNumber != null && <span>issue #{b.issueNumber}</span>}
                  </div>
                  <h3>{b.title}</h3>
                  <p>
                    {b.body.slice(0, 140)}
                    {b.body.length > 140 ? '…' : ''}
                  </p>
                  <div className="amount">
                    {bountyTotal(b).toLocaleString()}
                    <i>NIM</i>
                  </div>
                  <div className="meta">
                    <span>{b.claims.length} claims</span>
                    <span>·</span>
                    <span>{b.topups.length} top-ups</span>
                    {b.requireAssignment && (
                      <>
                        <span>·</span>
                        <span>assignment required</span>
                      </>
                    )}
                  </div>
                  <div className="card-foot">
                    <button className="btn small primary" onClick={() => setRoute({ name: 'detail', id: b.id })}>
                      Open
                    </button>
                    {b.issueUrl && (
                      <a className="btn small" href={b.issueUrl} target="_blank" rel="noreferrer">
                        issue ↗
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {filtered.length === 0 && (
              <p style={{ color: 'var(--muted)', marginTop: 24 }}>No bounties match.</p>
            )}
          </>
        )}

        {route.name === 'create' && (
          <CreateForm
            inPay={wallet.inPay}
            walletAddress={wallet.address}
            onCreate={createBounty}
            busy={!!busy}
            onNeedWallet={() => {
              try {
                wallet.connectReal();
              } catch {
                wallet.connectMock();
              }
            }}
          />
        )}

        {route.name === 'detail' && active && (
          <DetailView
            bounty={active}
            me={wallet.address || 'anon'}
            profile={profile}
            inPay={wallet.inPay}
            busy={!!busy}
            onBack={() => setRoute({ name: 'browse' })}
            onTopup={(amt) => addTopup(active.id, amt)}
            onClaim={(ref) => addClaim(active.id, ref)}
            onDecide={(cid, ok) => decideClaim(active.id, cid, ok)}
            onRetract={() => retractBounty(active.id)}
            onOpenPayouts={() => setRoute({ name: 'dashboard' })}
          />
        )}

        {route.name === 'docs' && (
          <DocsPage
            onNavigate={(name) => setRoute({ name })}
          />
        )}

        {(route.name === 'dashboard' ||
          route.name === 'my-bounties' ||
          route.name === 'my-claims' ||
          route.name === 'payouts' ||
          route.name === 'settings') && (
          <Dashboard
            bounties={bounties}
            me={wallet.address || 'anon'}
            profile={profile}
            earnedNim={earnedNim}
            focus={
              route.name === 'my-bounties'
                ? 'bounties'
                : route.name === 'my-claims'
                  ? 'claims'
                  : route.name === 'payouts'
                    ? 'payouts'
                    : route.name === 'settings'
                      ? 'settings'
                      : 'overview'
            }
            onSection={(name) => setRoute({ name })}
            onOpen={(id) => setRoute({ name: 'detail', id })}
            onProfileSave={handleProfileSave}
          />
        )}
      </main>
    </div>
  );
}

function CreateForm({ inPay, walletAddress, onCreate, busy, onNeedWallet }) {
  const [mode, setMode] = useState('github'); // github | task
  const [issueUrl, setIssueUrl] = useState('');
  const [imported, setImported] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [repo, setRepo] = useState('');
  const [tags, setTags] = useState('');
  const [issueNumber, setIssueNumber] = useState(null);
  const [issueAssignees, setIssueAssignees] = useState([]);
  const [base, setBase] = useState('250');
  const [paymentMode, setPaymentMode] = useState('on-solve');

  const isGithub = mode === 'github';
  const valid =
    title.trim().length >= 8 &&
    body.trim().length >= 20 &&
    Number(base) >= 1 &&
    (isGithub ? !!imported && repo.trim().length > 2 : true);

  async function handleImport() {
    setImporting(true);
    setImportMsg('');
    try {
      const data = await importGitHubIssue(issueUrl);
      setImported(data);
      setTitle(data.title);
      setBody(data.body.slice(0, 4000));
      setRepo(data.repo);
      setTags(data.tags.join(', '));
      setIssueNumber(data.issueNumber);
      setIssueAssignees(data.assignees);
      setImportMsg(`Imported ${data.repo}#${data.issueNumber}`);
    } catch (err) {
      setImported(null);
      setImportMsg(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  }

  return (
    <form
      className="form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!walletAddress) {
          onNeedWallet();
          return;
        }
        if (valid && !busy) {
          onCreate({
            kind: isGithub ? 'github' : 'task',
            title,
            body,
            repo,
            issueUrl: imported?.issueUrl || issueUrl,
            issueNumber,
            issueAssignees,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 5),
            base,
            paymentMode,
          });
        }
      }}
    >
      <h2 style={{ margin: '4px 0 0', fontWeight: 400 }}>New bounty</h2>

      <div className="chip-row" role="group" aria-label="Bounty kind">
        <button type="button" className="chip" aria-pressed={mode === 'github'} onClick={() => { setMode('github'); setImported(null); setImportMsg(''); }}>
          ⌥ GitHub issue
        </button>
        <button type="button" className="chip" aria-pressed={mode === 'task'} onClick={() => { setMode('task'); setImported(null); setImportMsg(''); }}>
          ✦ Open task
        </button>
      </div>

      {isGithub && (
        <div className="field">
          <label htmlFor="f-issue">GitHub issue URL</label>
          <div className="row" style={{ marginTop: 0 }}>
            <input
              id="f-issue"
              value={issueUrl}
              onChange={(e) => setIssueUrl(e.target.value)}
              placeholder="https://github.com/owner/repo/issues/123"
              inputMode="url"
              style={{ flex: 1, minWidth: 200 }}
            />
            <button type="button" className="btn small primary" disabled={importing || !issueUrl.trim()} onClick={handleImport}>
              {importing ? 'Importing…' : 'Import'}
            </button>
          </div>
          {importMsg && <small style={{ color: imported ? 'var(--open)' : 'var(--lamp)' }}>{importMsg}</small>}
        </div>
      )}

      {mode === 'task' && (
        <>
          <div className="field">
            <label htmlFor="t-title">Title</label>
            <input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="t-body">The work</label>
            <textarea id="t-body" value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="t-tags">Tags</label>
            <input id="t-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="docs, video" />
          </div>
        </>
      )}

      {isGithub && imported && (
        <div className="panel-box">
          <div className="meta">
            <span>{imported.repo}</span>
            <span>·</span>
            <span>#{imported.issueNumber}</span>
            {imported.assignees.length > 0 && (
              <>
                <span>·</span>
                <span>{imported.assignees.join(', ')}</span>
              </>
            )}
          </div>
          <h3 style={{ margin: '8px 0 0', fontWeight: 400, fontSize: 20 }}>{imported.title}</h3>
        </div>
      )}

      <div className="chip-row" role="group" aria-label="Payment mode">
        <button type="button" className="chip" aria-pressed={paymentMode === 'on-solve'} onClick={() => setPaymentMode('on-solve')}>
          ◷ Pay on solve
        </button>
        <button type="button" className="chip" aria-pressed={paymentMode === 'prepaid'} onClick={() => setPaymentMode('prepaid')}>
          ◈ Prepaid
        </button>
      </div>

      <div className="field">
        <label htmlFor="f-base">Amount (NIM)</label>
        <input id="f-base" value={base} onChange={(e) => setBase(e.target.value)} type="number" min="1" inputMode="numeric" />
      </div>

      <button className="btn primary" disabled={!valid || busy || !walletAddress} type="submit">
        {paymentMode === 'prepaid' ? `Fund & publish · ${base || 0} NIM` : 'Publish'}
      </button>
      {!walletAddress && (
        <button type="button" className="btn" onClick={onNeedWallet}>
          Connect wallet
        </button>
      )}
    </form>
  );
}

function DetailView({ bounty: b, me, profile, inPay, busy, onBack, onTopup, onClaim, onDecide, onRetract, onOpenPayouts }) {
  const [topAmt, setTopAmt] = useState('50');
  const [prUrl, setPrUrl] = useState('');
  const isCreator = b.creator === me;
  const pot = bountyTotal(b);
  const canClaim = b.status === 'open' || b.status === 'review';
  const canTopup = canClaim;

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>
        ← back
      </button>
      <div className="detail-head">
        <div className="meta">
          <StatusBadge status={b.status} />
          <ModeBadge mode={b.paymentMode} />
          <span className="badge type">{b.kind}</span>
          {b.repo && <span>{b.repo}</span>}
          {b.issueNumber != null && <span>issue #{b.issueNumber}</span>}
          {b.issueAssignees?.length > 0 && <span className="badge review">assignee only</span>}
        </div>
        <h2>{b.title}</h2>
        <p>{b.body}</p>
        <div className="row" style={{ marginTop: 12 }}>
          {b.issueUrl && (
            <a className="btn small primary" href={b.issueUrl} target="_blank" rel="noreferrer">
              View issue ↗
            </a>
          )}
          <span className="meta">
            <span>keeper {shortAddr(b.creator)}</span>
            <span>·</span>
            <span>{b.createdAt}</span>
            {b.issueAssignees?.length > 0 && (
              <>
                <span>·</span>
                <span>{b.issueAssignees.join(', ')}</span>
              </>
            )}
          </span>
        </div>
        <div className="kv">
          <div>
            <span>In the pot</span>
            <b>{pot.toLocaleString()} NIM</b>
          </div>
          <div>
            <span>Mode</span>
            <b>{b.paymentMode === 'prepaid' ? 'Prepaid' : 'On solve'}</b>
          </div>
          <div>
            <span>Claims</span>
            <b>{b.claims.length}</b>
          </div>
          <div>
            <span>Pay on</span>
            <b>Merge</b>
          </div>
        </div>

        {canTopup && (
          <div className="row">
            <input
              value={topAmt}
              onChange={(e) => setTopAmt(e.target.value)}
              type="number"
              min="1"
              aria-label="Top-up amount"
              className="num-input"
            />
            <button className="btn small" disabled={busy} onClick={() => onTopup(topAmt)}>
              Crowdfund +{topAmt || 0} NIM
            </button>
          </div>
        )}
        {isCreator && b.status !== 'paid' && b.status !== 'retracted' && b.claims.length === 0 && (
          <div className="row">
            <button className="btn small ghost" disabled={busy} onClick={onRetract}>
              Retract bounty
            </button>
          </div>
        )}
      </div>

      <div className="panel-box">
        <h4>Claims</h4>
        {b.claims.length === 0 && (
          <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No claims yet.</p>
        )}
        {b.claims.map((c) => {
          const merged = c.prMerged || c.state === 'merged' || c.state === 'accepted';
          const canPay = isCreator && (c.state === 'in-review' || c.state === 'merged') && b.status !== 'paid';
          return (
            <div key={c.id} className="claim">
              <div className="meta">
                {c.githubUser && <span>@{c.githubUser}</span>}
                <span>{c.at}</span>
                <span className={c.state === 'accepted' && !c.payoutHeld ? 'ok' : c.state === 'rejected' ? 'bad' : c.payoutHeld || !merged ? 'warn' : 'ok'}>
                  {c.payoutHeld ? 'payout held' : merged && c.state !== 'accepted' && c.state !== 'rejected' ? 'merged' : c.state}
                </span>
              </div>
              <a href={c.ref} target="_blank" rel="noreferrer" className="pr-link">
                {c.ref}
              </a>
              {c.relayer && (
                <div className="meta">
                  <span>relayer → {shortAddr(c.relayer.to)}</span>
                  <span>·</span>
                  <span style={{ overflowWrap: 'anywhere' }}>{c.relayer.txHash}</span>
                </div>
              )}
              {canPay && (
                <div className="row">
                  <button
                    className="btn small primary"
                    disabled={busy || !merged}
                    onClick={() => onDecide(c.id, true)}
                    title={merged ? undefined : 'PR must be merged first'}
                  >
                    {merged ? `Pay · relayer ${pot} NIM` : 'Wait for merge'}
                  </button>
                  {merged && (
                    <button className="btn small ghost" disabled={busy} onClick={() => onDecide(c.id, false)}>
                      Reject
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {canClaim && (
          <div className="form" style={{ marginTop: 12 }}>
            <div className="field">
              <label htmlFor="c-pr">GitHub pull request URL</label>
              <div className="row" style={{ marginTop: 0 }}>
                <input
                  id="c-pr"
                  value={prUrl}
                  onChange={(e) => setPrUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo/pull/…"
                  inputMode="url"
                  style={{ flex: 1, minWidth: 180 }}
                />
                <button
                  className="btn small primary"
                  disabled={!prUrl.trim() || busy}
                  onClick={() => {
                    onClaim(prUrl);
                    setPrUrl('');
                  }}
                >
                  Claim
                </button>
              </div>
            </div>
          </div>
        )}
        {b.status === 'paid' && (
          <div className="notice" style={{ marginTop: 12 }}>
            Complete · relayer paid.
          </div>
        )}
        {b.status === 'retracted' && (
          <div className="notice" style={{ marginTop: 12 }}>
            Retracted.
          </div>
        )}
      </div>
    </div>
  );
}

function Dashboard({ bounties, me, profile, earnedNim, focus, onSection, onOpen, onProfileSave }) {
  const mine = bounties.filter((b) => b.creator === me);
  const myClaims = bounties.flatMap((b) =>
    b.claims
      .filter((c) => c.by === me || (profile.githubUser && c.githubUser === profile.githubUser))
      .map((c) => ({ ...c, bounty: b })),
  );
  const [payoutWallet, setPayoutWallet] = useState(profile.payoutWallet);

  useEffect(() => setPayoutWallet(profile.payoutWallet), [profile.payoutWallet]);

  const nav = [
    { id: 'overview', label: 'Overview' },
    { id: 'bounties', label: 'My bounties' },
    { id: 'claims', label: 'My claims' },
    { id: 'payouts', label: 'Payouts' },
    { id: 'settings', label: 'Settings' },
  ];

  const routeFor = (id) =>
    id === 'bounties'
      ? 'my-bounties'
      : id === 'claims'
        ? 'my-claims'
        : id === 'payouts'
          ? 'payouts'
          : id === 'settings'
            ? 'settings'
            : 'dashboard';

  return (
    <div className="dash">
      <aside className="dash-side" aria-label="Dashboard">
        <p className="dash-side-title">Dashboard</p>
        {nav.map((item) => (
          <button
            key={item.id}
            className={focus === item.id ? 'dash-link active' : 'dash-link'}
            onClick={() => onSection(routeFor(item.id))}
          >
            {item.label}
          </button>
        ))}
      </aside>

      <div className="dash-body">
        {focus === 'overview' && (
          <>
            <div className="kv">
              <div>
                <span>Posted</span>
                <b>{mine.length}</b>
              </div>
              <div>
                <span>Claims</span>
                <b>{myClaims.length}</b>
              </div>
              <div>
                <span>Earned</span>
                <b>{Number(earnedNim || 0).toLocaleString()} NIM</b>
              </div>
            </div>
            <div className="panel-box">
              <h4>Recent</h4>
              {mine.slice(0, 3).map((b) => (
                <div key={b.id} className="claim">
                  <div className="meta">
                    <StatusBadge status={b.status} />
                    <span>{bountyTotal(b).toLocaleString()} NIM</span>
                  </div>
                  <button className="link-btn" onClick={() => onOpen(b.id)}>
                    {b.title}
                  </button>
                </div>
              ))}
              {myClaims.slice(0, 3).map((c) => (
                <div key={c.id} className="claim">
                  <div className="meta">
                    <span>{c.payoutHeld ? 'payout held' : c.state}</span>
                    <span>·</span>
                    <span>@{c.githubUser || 'anon'}</span>
                  </div>
                  <button className="link-btn" onClick={() => onOpen(c.bounty.id)}>
                    {c.bounty.title}
                  </button>
                </div>
              ))}
              {!mine.length && !myClaims.length && (
                <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Nothing yet.</p>
              )}
            </div>
          </>
        )}

        {focus === 'bounties' && (
          <div className="panel-box">
            <h4>My bounties</h4>
            {mine.length === 0 && (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>Nothing posted yet.</p>
            )}
            {mine.map((b) => (
              <div key={b.id} className="claim">
                <div className="meta">
                  <StatusBadge status={b.status} />
                  <ModeBadge mode={b.paymentMode} />
                  <span>{bountyTotal(b).toLocaleString()} NIM</span>
                </div>
                <button className="link-btn" onClick={() => onOpen(b.id)}>
                  {b.title}
                </button>
              </div>
            ))}
          </div>
        )}

        {focus === 'claims' && (
          <div className="panel-box">
            <h4>My claims</h4>
            {myClaims.length === 0 && (
              <p style={{ margin: 0, color: 'var(--muted)', fontSize: 14 }}>No claims yet.</p>
            )}
            {myClaims.map((c) => (
              <div key={c.id} className="claim">
                <div className="meta">
                  <span>{c.payoutHeld ? 'payout held' : c.state}</span>
                  <span>·</span>
                  <span>@{c.githubUser || 'anon'}</span>
                </div>
                <button className="link-btn" onClick={() => onOpen(c.bounty.id)}>
                  {c.bounty.title}
                </button>
              </div>
            ))}
          </div>
        )}

        {focus === 'payouts' && (
          <div className="panel-box">
            <h4>Payouts</h4>
            <div className="kv">
              <div>
                <span>Amount earned</span>
                <b>{Number(earnedNim || 0).toLocaleString()} NIM</b>
              </div>
              <div>
                <span>Paid claims</span>
                <b>{myClaims.filter((c) => c.state === 'accepted' && !c.payoutHeld).length}</b>
              </div>
            </div>
            {myClaims.filter((c) => c.state === 'accepted' || c.payoutHeld).length === 0 && (
              <p style={{ margin: '12px 0 0', color: 'var(--muted)', fontSize: 14 }}>No payouts yet.</p>
            )}
            {myClaims
              .filter((c) => c.state === 'accepted' || c.payoutHeld)
              .map((c) => (
                <div key={c.id} className="claim">
                  <div className="meta">
                    <span>{c.payoutHeld ? 'held' : 'paid'}</span>
                    <span>·</span>
                    <span>{bountyTotal(c.bounty).toLocaleString()} NIM</span>
                    {c.relayer && (
                      <>
                        <span>·</span>
                        <span style={{ overflowWrap: 'anywhere' }}>{c.relayer.txHash}</span>
                      </>
                    )}
                  </div>
                  <button className="link-btn" onClick={() => onOpen(c.bounty.id)}>
                    {c.bounty.title}
                  </button>
                </div>
              ))}
          </div>
        )}

        {focus === 'settings' && (
          <div className="panel-box">
            <h4>Settings</h4>
            <GitHubConnect profile={profile} onProfileSave={onProfileSave} />
            <div className="field" style={{ marginTop: 14 }}>
              <label htmlFor="d-nim">Payout wallet (NIM)</label>
              <input
                id="d-nim"
                value={payoutWallet}
                onChange={(e) => setPayoutWallet(e.target.value)}
                placeholder="NQ…"
                disabled={!profile.githubConnected}
              />
            </div>
            <button
              className="btn primary"
              disabled={!profile.githubConnected || !payoutWallet.trim()}
              onClick={() => onProfileSave({ ...profile, payoutWallet: payoutWallet.trim() })}
            >
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
