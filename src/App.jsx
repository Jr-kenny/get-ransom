import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import LighthouseScene from './components/LighthouseScene.jsx';
import DocsPage from './Docs.jsx';
import MarkdownBody from './components/MarkdownBody.jsx';
import {
  bountyTotal,
  uid,
  shortAddr,
  loadBountiesCache,
  fetchBounties,
  createBountyRemote,
  pledgeRemote,
  claimRemote,
  decideRemote,
  cacheBounties,
  patchBounty,
} from './store.js';
import {
  connectNimiq,
  payLanguage,
  inNimiqPay,
  sendNim,
  listNimiqAccounts,
  getNimiqNetworkStatus,
  isValidNimiqAddress,
  nimiqPayAppLink,
  importGitHubIssue,
  importGitHubPull,
  isAssignedTo,
  mockTxHash,
  loadProfileCache,
  loadProfileFromServer,
  persistPayoutWallet,
  relayerPayout,
  beginGitHubOAuth,
  readGitHubOAuthReturn,
  githubClientId,
  exchangeGitHubCode,
  signNimiqMessage,
  disconnectGitHub,
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

function ModeBadge() {
  return <span className="badge type">◷ pay on solve</span>;
}

function buildPromiseMessage({ action, bountyId, repo, issueNumber, issueUrl, amount, githubUser, wallet }) {
  const lines = [
    'get-ransom:promise:v1',
    `action:${action}`,
    bountyId ? `bounty:${bountyId}` : null,
    repo ? `repo:${repo}` : null,
    issueNumber != null ? `issue:${issueNumber}` : null,
    issueUrl ? `issue_url:${issueUrl}` : null,
    `amount:${amount}NIM`,
    'mode:on-solve',
    `github:${githubUser || 'anon'}`,
    `wallet:${wallet || 'anon'}`,
    `at:${new Date().toISOString()}`,
  ].filter(Boolean);
  return lines.join('\n');
}

function PromiseModal({ flow, wallet, profile, onCancel, onConfirm, busy }) {
  if (!flow) return null;
  const amount = flow.amount;
  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onCancel}>
      <div
        className="modal promise-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Sign bounty promise"
      >
        <h3>Sign promise</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          {flow.action === 'create'
            ? 'You promise to pay this pot from Nimiq Pay when a merged PR is accepted. No platform escrow.'
            : 'You promise this amount toward the pot. On accept, the creator pays the full reward from their wallet.'}
        </p>
        <div className="promise-amount">
          <span>{flow.action === 'create' ? 'Reward' : 'Your pledge'}</span>
          <b>
            {Number(amount).toLocaleString()}
            <i>NIM</i>
          </b>
        </div>
        <pre className="promise-message" aria-label="Promise message">
          {flow.message}
        </pre>
        <p className="muted" style={{ fontSize: 12, margin: '0 0 12px' }}>
          Signed as {profile.githubConnected ? `@${profile.githubUser}` : 'wallet'} ·{' '}
          {wallet?.inPay ? 'Nimiq Pay will ask you to confirm' : 'browser preview signature'}
        </p>
        <div className="row">
          <button type="button" className="btn primary" disabled={busy} onClick={onConfirm}>
            {busy ? 'Waiting for wallet…' : 'Sign & confirm'}
          </button>
          <button type="button" className="btn ghost" disabled={busy} onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
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
  const [network, setNetwork] = useState({ consensus: null, blockNumber: null });

  const persist = useCallback((addr) => {
    setAddress(addr || '');
    try {
      if (addr) localStorage.setItem('gr-wallet', addr);
      else localStorage.removeItem('gr-wallet');
    } catch { /* noop */ }
  }, []);

  // init() only — listAccounts() shows a native confirm, so wait for explicit Connect
  useEffect(() => {
    let cancelled = false;
    if (!inNimiqPay()) {
      setProviderState(address ? 'ready' : 'browser');
      return () => {};
    }
    (async () => {
      setProviderState('connecting');
      try {
        await connectNimiq(8000);
        if (cancelled) return;
        setProviderState(address ? 'ready' : 'ready');
        try {
          const status = await getNimiqNetworkStatus();
          if (!cancelled) setNetwork(status);
        } catch { /* optional */ }
      } catch {
        if (!cancelled) setProviderState(address ? 'ready' : 'error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const connectReal = useCallback(async () => {
    setConnecting(true);
    try {
      if (!inNimiqPay()) throw new Error('Open inside Nimiq Pay for a real wallet');
      await connectNimiq(10_000);
      const accounts = await listNimiqAccounts();
      if (accounts[0]) {
        persist(accounts[0]);
        setProviderState('ready');
        try {
          setNetwork(await getNimiqNetworkStatus());
        } catch { /* optional */ }
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

  const openInPay = useCallback(() => {
    try {
      window.location.href = nimiqPayAppLink(window.location.pathname + window.location.search);
    } catch { /* noop */ }
  }, []);

  return {
    address,
    providerState,
    connecting,
    connectReal,
    connectMock,
    disconnect,
    openInPay,
    setAddress: persist,
    lang: payLanguage(),
    inPay: inNimiqPay(),
    network,
    hasRealAddress: address ? isValidNimiqAddress(address) : false,
  };
}

function GitHubConnect({ profile, compact }) {
  const clientId = githubClientId();

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
          {!compact && (
            <span className="muted">
              {profile.payoutWallet ? ' · account synced' : ' · save payout wallet'}
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="gh-connect">
      <button
        type="button"
        className="btn primary"
        onClick={() => {
          if (!clientId) return;
          const url = beginGitHubOAuth();
          if (url) window.location.href = url;
        }}
        disabled={!clientId}
        title={clientId ? undefined : 'VITE_GITHUB_CLIENT_ID is not set'}
      >
        Connect GitHub
      </button>
      <p className="muted" style={{ margin: '8px 0 0', fontSize: 12 }}>
        Sign in on any device. Your GitHub account and payout wallet follow you.
      </p>
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
          {!wallet.inPay && (
            <button
              role="menuitem"
              onClick={() => {
                setOpen(false);
                wallet.openInPay();
              }}
            >
              Open in Nimiq Pay
            </button>
          )}
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
  const [bounties, setBounties] = useState(() => loadBountiesCache());
  const [route, setRoute] = useState(() => loadRoute(bounties));
  const [profile, setProfile] = useState(() => loadProfileCache());
  const [apiReady, setApiReady] = useState(false);
  const [apiError, setApiError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const [actionModal, setActionModal] = useState(null);
  const [promiseFlow, setPromiseFlow] = useState(null);
  const wallet = useWallet();

  function openSettingsGate(title, body) {
    setActionModal({ title, body });
  }

  function replaceBounty(next) {
    setBounties((prev) => {
      const list = prev.some((b) => b.id === next.id)
        ? prev.map((b) => (b.id === next.id ? next : b))
        : [next, ...prev];
      cacheBounties(list);
      return list;
    });
  }

  useEffect(() => saveRoute(route), [route]);

  // Boot: session profile + shared bounties from API
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [me, list] = await Promise.all([
          loadProfileFromServer().catch((e) => {
            if (e?.status === 401) return loadProfileCache();
            throw e;
          }),
          fetchBounties(),
        ]);
        if (cancelled) return;
        setProfile(me);
        setBounties(list);
        setApiReady(true);
        setApiError('');
      } catch (err) {
        if (cancelled) return;
        setApiReady(false);
        setApiError(err?.message || 'API unavailable');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // GitHub OAuth return — session cookie set by /api/github/oauth
  useEffect(() => {
    let cancelled = false;
    const ret = readGitHubOAuthReturn();
    if (!ret?.code) return undefined;
    setBusy('Connecting GitHub…');
    (async () => {
      try {
        await exchangeGitHubCode(ret.code);
        const me = await loadProfileFromServer();
        const list = await fetchBounties();
        if (cancelled) return;
        setProfile(me);
        setBounties(list);
        setToast(
          me.payoutWallet
            ? `Signed in @${me.githubUser} · payout wallet restored`
            : `Signed in @${me.githubUser} · add a payout wallet in Settings`,
        );
      } catch (err) {
        if (!cancelled) setToast(err?.message || 'GitHub connect failed');
      } finally {
        if (!cancelled) setBusy('');
      }
    })();
    return () => {
      cancelled = true;
    };
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
    setBounties((prev) => {
      const list = prev.map((b) => (b.id === id ? fn(b) : b));
      cacheBounties(list);
      return list;
    });
  }

  async function createBounty(data, promise) {
    if (!profile.githubConnected) {
      openSettingsGate('Connect GitHub', 'Sign in with GitHub before publishing a bounty.');
      setBusy('');
      return;
    }
    setBusy('Publishing…');
    try {
      const bounty = await createBountyRemote({
        title: data.title,
        body: data.body,
        repo: data.repo,
        issueUrl: data.issueUrl,
        issueNumber: data.issueNumber,
        issueAssignees: data.issueAssignees,
        requireAssignment: data.requireAssignment,
        tags: data.tags,
        base: data.base,
        promise: {
          signature: promise.signature,
          publicKey: promise.publicKey,
          method: promise.method,
          message: promise.message || '',
        },
      });
      replaceBounty(bounty);
      setBusy('');
      setToast('Bounty live · signed promise');
      setRoute({ name: 'detail', id: bounty.id });
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Could not publish bounty');
    }
  }

  async function addTopup(id, amount, promise) {
    const amt = Math.round(Number(amount));
    if (!amt || amt < 1) return;
    if (!profile.githubConnected) {
      openSettingsGate('Connect GitHub', 'Sign in with GitHub to promise NIM.');
      return;
    }
    setBusy('Saving promise…');
    try {
      const bounty = await pledgeRemote(id, {
        amount: amt,
        promise: {
          signature: promise.signature,
          publicKey: promise.publicKey,
          method: promise.method,
          message: promise.message || '',
        },
      });
      replaceBounty(bounty);
      setBusy('');
      setToast(`Promised +${amt} NIM · pot ${bountyTotal(bounty)} NIM`);
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Could not save promise');
    }
  }

  async function confirmPromiseFlow() {
    if (!promiseFlow) return;
    const { action, data, bountyId, amount, message } = promiseFlow;
    setBusy('Waiting for signature…');
    try {
      const signed = await signNimiqMessage(message);
      setPromiseFlow(null);
      setBusy('');
      if (action === 'create') {
        await createBounty(data, { ...signed, message });
      } else {
        await addTopup(bountyId, amount, { ...signed, message });
      }
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Promise signing cancelled');
    }
  }

  function requestCreate(data) {
    const message = buildPromiseMessage({
      action: 'create',
      repo: data.repo,
      issueNumber: data.issueNumber,
      issueUrl: data.issueUrl,
      amount: data.base,
      githubUser: profile.githubUser,
      wallet: wallet.address,
    });
    setPromiseFlow({ action: 'create', data, amount: data.base, message });
  }

  function requestPledge(bountyId, amount) {
    const bounty = bounties.find((b) => b.id === bountyId);
    if (!bounty) return;
    const amt = Math.round(Number(amount));
    if (!amt || amt < 1) return;
    const message = buildPromiseMessage({
      action: 'pledge',
      bountyId,
      repo: bounty.repo,
      issueNumber: bounty.issueNumber,
      issueUrl: bounty.issueUrl,
      amount: amt,
      githubUser: profile.githubUser,
      wallet: wallet.address,
    });
    setPromiseFlow({ action: 'pledge', bountyId, amount: amt, message });
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
        'Save a NIM payout wallet in Settings so you can be paid on accept.',
      );
      return;
    }

    setBusy('Importing PR…');
    let prMeta = null;
    try {
      prMeta = await importGitHubPull(prUrl);
    } catch (err) {
      setToast(err?.message || 'Could not import that PR');
      setBusy('');
      return;
    }

    const ghUser = profile.githubUser;
    const prAuthor = (prMeta?.author || '').trim();
    const assigned = bounty.issueAssignees || [];

    if (prAuthor && prAuthor.toLowerCase() !== ghUser.toLowerCase()) {
      setToast(`PR author @${prAuthor} must match your connected GitHub @${ghUser}.`);
      setBusy('');
      return;
    }

    if (
      bounty.requireAssignment &&
      assigned.length > 0 &&
      !isAssignedTo(assigned, ghUser)
    ) {
      setToast(`Issue is assigned to ${assigned.join(', ')} — only they can claim.`);
      setBusy('');
      return;
    }

    setBusy('Saving claim…');
    try {
      const next = await claimRemote(id, {
        prUrl: prUrl.trim(),
        prMerged: !!(prMeta && prMeta.merged),
        prState: prMeta?.state || '',
      });
      replaceBounty(next);
      setBusy('');
      setToast(prMeta?.merged ? 'PR already merged — ready to pay' : 'Claim submitted · pay on merge');
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Could not save claim');
    }
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

      setBusy(wallet.inPay ? `Sending ${pot} NIM to hunter…` : `Recording pay ${pot} NIM…`);
      try {
        if (wallet.inPay) {
          if (!isValidNimiqAddress(to)) {
            throw new Error('Hunter payout wallet is not a valid NIM address');
          }
          const txHash = await sendNim({
            recipient: to,
            nim: pot,
            memo: `bounty:pay:${bountyId}`,
          });
          relayer = {
            method: 'direct',
            txHash,
            to,
            nim: pot,
            memo: `bounty:pay:${bountyId}`,
            at: new Date().toISOString(),
          };
          payoutTx = txHash;
          setToast(`Paid ${shortAddr(to)} · ${String(txHash).slice(0, 14)}…`);
        } else {
          throw new Error('Open Nimiq Pay to send the reward on-chain');
        }
      } catch (err) {
        setToast(err?.message || 'Payout failed');
        setBusy('');
        return;
      }
    }

    setBusy('Saving…');
    try {
      const next = await decideRemote(bountyId, {
        claimId,
        accept,
        payoutTx,
        relayer,
      });
      replaceBounty(next);
      setBusy('');
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Could not save decision');
    }
  }

  async function handleProfileSave(next) {
    if (!profile.githubConnected) {
      openSettingsGate('Connect GitHub', 'Sign in with GitHub to save your payout wallet.');
      return;
    }
    setBusy('Saving wallet…');
    try {
      const saved = await persistPayoutWallet(next.payoutWallet || '');
      setProfile(saved);
      setBusy('');
      setToast('Payout wallet saved');
    } catch (err) {
      setBusy('');
      setToast(err?.message || 'Could not save wallet');
    }
  }

  async function handleDisconnectAll() {
    wallet.disconnect();
    try {
      await disconnectGitHub();
    } catch {
      /* ignore */
    }
    setProfile(loadProfileCache());
    setToast('Signed out');
  }

  function retractBounty(id) {
    setBusy('Retracting…');
    patchBounty(id, { action: 'retract' })
      .then(({ bounty }) => {
        replaceBounty(bounty);
        setBusy('');
        if (bounty.status !== 'retracted') {
          setToast('Resolve open claims before retracting');
        } else {
          setToast('Bounty retracted');
        }
      })
      .catch((err) => {
        setBusy('');
        setToast(err?.message || 'Could not retract');
      });
  }

  const filtered = bounties.filter((b) => {
    if (b.kind !== 'github') return false;
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return `${b.title} ${b.body} ${b.repo} ${b.tags.join(' ')}`.toLowerCase().includes(q);
  });

  const active = route.name === 'detail' ? bounties.find((b) => b.id === route.id) : null;
  const myBounties = bounties.filter(
    (b) =>
      (profile.githubUser && b.creatorGithub === profile.githubUser) ||
      b.creator === wallet.address ||
      b.creatorGithubId === profile.githubId,
  );
  const myClaims = bounties.flatMap((b) =>
    b.claims
      .filter(
        (c) =>
          c.by === wallet.address ||
          (profile.githubUser && c.githubUser === profile.githubUser) ||
          c.githubId === profile.githubId ||
          c.payoutWallet === profile.payoutWallet,
      )
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
                if (!wallet.address && wallet.inPay) {
                  wallet.connectReal().catch(() => wallet.connectMock());
                } else if (!wallet.address) {
                  wallet.connectMock();
                }
                setRoute({ name: 'create' });
              }}
            >
              Create a bounty
            </button>
            <button className="btn ghost" onClick={() => setRoute({ name: 'docs' })}>
              Docs
            </button>
            {!wallet.inPay && (
              <button className="btn ghost" onClick={wallet.openInPay}>
                Open in Nimiq Pay
              </button>
            )}
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
              onDisconnect={handleDisconnectAll}
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
          onDisconnect={handleDisconnectAll}
        />
      </header>

      <main className="main">
        {apiError && (
          <div className="notice" role="status">
            Backend unavailable — {apiError}. Set UPSTASH_REDIS_REST_URL / TOKEN and SESSION_SECRET on Vercel.
          </div>
        )}
        {!apiReady && !apiError && (
          <div className="notice busy">Loading shared bounties…</div>
        )}
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

        <PromiseModal
          flow={promiseFlow}
          wallet={wallet}
          profile={profile}
          busy={!!busy}
          onCancel={() => {
            if (!busy) setPromiseFlow(null);
          }}
          onConfirm={confirmPromiseFlow}
        />

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
                    <ModeBadge />
                    <span className="badge type">⌥ github</span>
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
            onCreate={requestCreate}
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
            onTopup={(amt) => requestPledge(active.id, amt)}
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
            wallet={wallet}
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
  const [requireAssignment, setRequireAssignment] = useState(false);
  const [base, setBase] = useState('250');

  const valid =
    title.trim().length >= 8 &&
    body.trim().length >= 20 &&
    Number(base) >= 1 &&
    !!imported &&
    repo.trim().length > 2 &&
    (!requireAssignment || issueAssignees.length > 0);

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
      setRequireAssignment(data.assignees.length > 0);
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
            kind: 'github',
            title,
            body,
            repo,
            issueUrl: imported?.issueUrl || issueUrl,
            issueNumber,
            issueAssignees,
            requireAssignment: requireAssignment && issueAssignees.length > 0,
            tags: tags
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
              .slice(0, 5),
            base,
            paymentMode: 'on-solve',
          });
        }
      }}
    >
      <h2 style={{ margin: '4px 0 0', fontWeight: 400 }}>New bounty</h2>
      <p className="muted" style={{ margin: '4px 0 12px', fontSize: 14 }}>
        GitHub issue only · pay on solve
      </p>

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

      {imported && (
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

      {imported && (
        <label className="check-row" style={{ marginBottom: 12 }}>
          <input
            type="checkbox"
            checked={requireAssignment}
            onChange={(e) => setRequireAssignment(e.target.checked)}
            disabled={imported.assignees.length === 0}
          />
          <span>
            <b style={{ fontWeight: 500 }}>Only GitHub assignees can claim</b>
            <span className="muted" style={{ display: 'block', marginTop: 2, fontSize: 12 }}>
              {imported.assignees.length > 0
                ? `Locked to ${imported.assignees.join(', ')}. Assign the issue on GitHub to change this.`
                : 'This issue has no assignees yet. Assign someone on GitHub, then re-import.'}
            </span>
          </span>
        </label>
      )}

      <div className="field">
        <label htmlFor="f-base">Amount (NIM)</label>
        <input id="f-base" value={base} onChange={(e) => setBase(e.target.value)} type="number" min="1" inputMode="numeric" />
        <small style={{ display: 'block', marginTop: 6, color: 'var(--muted)' }}>
          Pay on solve — you send NIM from Nimiq Pay when you accept a merged PR. No platform escrow.
        </small>
      </div>

      <button className="btn primary" disabled={!valid || busy || !walletAddress} type="submit">
        Sign promise & publish
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
  const [claimOpen, setClaimOpen] = useState(false);
  const isCreator =
    b.creator === me ||
    (profile.githubUser && b.creatorGithub === profile.githubUser) ||
    (profile.githubId != null && b.creatorGithubId === profile.githubId);
  const pot = bountyTotal(b);
  const canClaim = b.status === 'open' || b.status === 'review';
  const canTopup = canClaim;

  function submitClaim() {
    const url = prUrl.trim();
    if (!url) return;
    onClaim(url);
    setPrUrl('');
    setClaimOpen(false);
  }

  return (
    <div className="detail">
      <button className="back" onClick={onBack}>
        ← back
      </button>
      <div className="detail-head">
        <div className="meta">
          <StatusBadge status={b.status} />
          <ModeBadge />
          <span className="badge type">⌥ github</span>
          {b.repo && <span>{b.repo}</span>}
          {b.issueNumber != null && <span>issue #{b.issueNumber}</span>}
          {b.issueAssignees?.length > 0 && <span className="badge review">assignee only</span>}
        </div>
        <h2>{b.title}</h2>
        <MarkdownBody source={b.body} />
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
      </div>

      <div className="panel-box reward-panel">
        <p className="reward-label">Reward</p>
        <p className="reward-total">
          {pot.toLocaleString()}
          <i>NIM</i>
        </p>
        <p className="reward-label" style={{ marginTop: 14 }}>
          Contributions
        </p>
        <ul className="contrib-list">
          {(b.promises || []).map((p) => (
            <li key={p.id} className="contrib-row">
              <span className="contrib-avatar" aria-hidden="true">
                {(p.githubUser || p.by || '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="contrib-who">
                {p.githubUser ? `@${p.githubUser}` : shortAddr(p.by)}
                {p.role === 'creator' && <span className="contrib-role">creator</span>}
                <span className="badge promised">Promised</span>
                {p.signature ? null : <span className="badge review">unsigned</span>}
              </span>
              <span className="contrib-amt">
                {Number(p.amount).toLocaleString()}
                <i>NIM</i>
              </span>
            </li>
          ))}
          {(!b.promises || b.promises.length === 0) && (
            <li className="contrib-row muted" style={{ fontSize: 14 }}>
              No promises yet
            </li>
          )}
        </ul>

        {canTopup && (
          <div className="row" style={{ marginTop: 12 }}>
            <input
              value={topAmt}
              onChange={(e) => setTopAmt(e.target.value)}
              type="number"
              min="1"
              aria-label="Promise amount"
              className="num-input"
            />
            <button className="btn small" disabled={busy} onClick={() => onTopup(topAmt)}>
              Promise +{topAmt || 0} NIM
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
        {canClaim && (
          <button
            type="button"
            className="btn primary claim-bounty-btn"
            disabled={busy}
            onClick={() => setClaimOpen(true)}
          >
            Claim bounty
          </button>
        )}
      </div>

      {claimOpen && (
        <div className="modal-backdrop" onClick={() => !busy && setClaimOpen(false)}>
          <div
            className="modal claim-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Claim bounty"
          >
            <h3>Claim bounty</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Paste your pull request URL. Multiple hunters can claim. Only the merged PR is paid.
            </p>
            {b.requireAssignment && (b.issueAssignees || []).length > 0 && (
              <p className="muted" style={{ margin: '0 0 10px', fontSize: 13 }}>
                Assignee lock: {(b.issueAssignees || []).join(', ')}
              </p>
            )}
            <div className="field">
              <label htmlFor="claim-pr">GitHub pull request URL</label>
              <input
                id="claim-pr"
                value={prUrl}
                onChange={(e) => setPrUrl(e.target.value)}
                placeholder="https://github.com/owner/repo/pull/12"
                inputMode="url"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    submitClaim();
                  }
                }}
              />
            </div>
            <div className="row">
              <button
                type="button"
                className="btn primary"
                disabled={!prUrl.trim() || busy}
                onClick={submitClaim}
              >
                {busy ? 'Saving…' : 'Submit claim'}
              </button>
              <button type="button" className="btn ghost" disabled={busy} onClick={() => setClaimOpen(false)}>
                Cancel
              </button>
            </div>

            <div className="claim-modal-list">
              <p className="reward-label" style={{ margin: '16px 0 8px' }}>
                PRs already submitted
              </p>
              {b.claims.length === 0 && (
                <p className="muted" style={{ margin: 0, fontSize: 13 }}>
                  None yet. Yours would be the first.
                </p>
              )}
              {b.claims.map((c) => {
                const merged = c.prMerged || c.state === 'merged' || c.state === 'accepted';
                return (
                  <div key={c.id} className="claim">
                    <div className="meta">
                      {c.githubUser && <span>@{c.githubUser}</span>}
                      <span>{c.at}</span>
                      <span className={c.state === 'accepted' ? 'ok' : merged ? 'ok' : c.state === 'rejected' ? 'bad' : 'warn'}>
                        {c.state === 'accepted' ? 'paid' : merged ? 'merged' : c.state}
                      </span>
                    </div>
                    <a href={c.ref} target="_blank" rel="noreferrer" className="pr-link">
                      {c.ref}
                    </a>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
                    {merged ? `Pay ${pot} NIM` : 'Wait for merge'}
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
        {b.status === 'paid' && (
          <div className="notice" style={{ marginTop: 12 }}>
            Complete · paid.
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

function Dashboard({
  bounties,
  me,
  profile,
  earnedNim,
  focus,
  onSection,
  onOpen,
  onProfileSave,
  wallet,
}) {
  const mine = bounties.filter(
    (b) =>
      b.creator === me ||
      (profile.githubUser && b.creatorGithub === profile.githubUser) ||
      (profile.githubId != null && b.creatorGithubId === profile.githubId),
  );
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
                  <ModeBadge />
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
              {payoutWallet.trim() && (
                <p style={{ margin: '6px 0 0', fontSize: 12, color: isValidNimiqAddress(payoutWallet) ? 'var(--ok, #3d9a6a)' : 'var(--warn, #b7791f)' }}>
                  {isValidNimiqAddress(payoutWallet)
                    ? 'Valid NIM address'
                    : 'Not a valid user-friendly NIM address (36 chars, starts with NQ)'}
                </p>
              )}
            </div>

            {wallet?.inPay && wallet.address && (
              <button
                type="button"
                className="btn"
                style={{ marginTop: 8 }}
                onClick={() => setPayoutWallet(wallet.address)}
              >
                Use connected wallet
              </button>
            )}

            <button
              className="btn primary"
              style={{ marginTop: 8 }}
              disabled={!profile.githubConnected || !payoutWallet.trim()}
              onClick={() => onProfileSave({ ...profile, payoutWallet: payoutWallet.trim() })}
            >
              Save
            </button>

            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line, #2a2f3a)' }}>
              <h4>Nimiq Pay</h4>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--muted)' }}>
                {wallet?.inPay
                  ? `Connected · ${wallet.lang}${wallet.network?.blockNumber != null ? ` · block ${wallet.network.blockNumber}` : ''}${wallet.network?.consensus === false ? ' · waiting for consensus' : ''}`
                  : 'Browser preview — mock wallet only. Open in Nimiq Pay for real NIM.'}
              </p>
              {wallet?.address && (
                <p style={{ margin: '0 0 8px', fontSize: 12, overflowWrap: 'anywhere', color: 'var(--muted)' }}>
                  Wallet: {wallet.address}
                  {wallet.hasRealAddress ? '' : ' (preview address)'}
                </p>
              )}
              <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--muted)' }}>
                Payments: on-solve only. Creator sends from Nimiq Pay on accept. No platform custody.
              </p>
              {!wallet?.inPay && (
                <button type="button" className="btn" onClick={() => wallet?.openInPay?.()}>
                  Open in Nimiq Pay
                </button>
              )}
              {wallet?.inPay && !wallet.address && (
                <button
                  type="button"
                  className="btn primary"
                  disabled={wallet.connecting}
                  onClick={() => wallet.connectReal()}
                >
                  {wallet.connecting ? 'Connecting…' : 'Connect wallet'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
