import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'hunter', label: 'Bounty hunters' },
  { id: 'creator', label: 'Bounty creators' },
  { id: 'owner', label: 'Repository owners' },
  { id: 'github-app', label: 'GitHub App' },
  { id: 'nimiq', label: 'Nimiq & payouts' },
  { id: 'faq', label: 'FAQs' },
];

function H({ id, children, level = 2 }) {
  const Tag = `h${level}`;
  return (
    <Tag id={id} className={`doc-h doc-h${level}`}>
      {children}
    </Tag>
  );
}

function P({ children }) {
  return <p className="doc-p">{children}</p>;
}

function Ol({ children }) {
  return <ol className="doc-ol">{children}</ol>;
}

function Ul({ children }) {
  return <ul className="doc-ul">{children}</ul>;
}

function Callout({ children }) {
  return <div className="doc-callout">{children}</div>;
}

function Flow({ steps }) {
  return (
    <ol className="doc-flow">
      {steps.map((s, i) => (
        <li key={i}>
          <span className="doc-flow-n">{String(i + 1).padStart(2, '0')}</span>
          <div>
            <b>{s.title}</b>
            {s.body ? <span> — {s.body}</span> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export default function DocsPage({ onNavigate }) {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      {
        root: null,
        rootMargin: '-20% 0px -55% 0px',
        threshold: [0, 0.25, 0.5, 1],
      },
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="docs">
      <aside className="docs-side" aria-label="Documentation">
        <p className="dash-side-title">Docs</p>
        {SECTIONS.map((s) => {
          const on = activeId === s.id;
          return (
            <a
              key={s.id}
              className={on ? 'docs-toc-link active' : 'docs-toc-link'}
              href={`#${s.id}`}
              aria-current={on ? 'true' : undefined}
              onClick={() => setActiveId(s.id)}
            >
              <span className="docs-toc-dot" aria-hidden="true" />
              {s.label}
            </a>
          );
        })}
      </aside>

      <article className="docs-body">
        <header className="docs-hero">
          <p className="kicker">Get Ransom · field manual</p>
          <h1>Keep the light on for open work</h1>
          <p className="lede">
            Place a NIM bounty on any GitHub issue. Hunters ship a PR. The keeper marks it
            complete — the relayer pays the saved wallet. No Stripe. No paste-and-pray identity.
          </p>
          <div className="cta-row">
            <button className="btn primary" onClick={() => onNavigate('browse')}>
              Explore bounties
            </button>
            <button className="btn" onClick={() => onNavigate('settings')}>
              Settings
            </button>
          </div>
        </header>

        <H id="hunter" level={2}>
          Bounty hunter guide
        </H>
        <P>
          You sail out with a PR and come back with NIM. Identity is your connected GitHub
          account — the same login that authors the pull request. Wallet is a NIM address the
          relayer pays into. Nothing else gets you paid.
        </P>

        <H level={3}>1 · Getting started</H>
        <Ol>
          <li>
            Connect the Nimiq wallet (Nimiq Pay on mobile, or demo connect in a desktop browser
            preview).
          </li>
          <li>
            Open <b>Profile → Settings</b> and <b>Connect GitHub</b>. That handle is your username
            everywhere in the app. It stays bound to this wallet login.
          </li>
          <li>
            Save a <b>payout wallet</b> (NIM address). Claims without one are held until you add
            it.
          </li>
        </Ol>

        <H level={3}>2 · Find work</H>
        <Ol>
          <li>Open Explore. Search by title, repo, or tags.</li>
          <li>Filter by GitHub vs open task, or open / in review / paid.</li>
          <li>
            Open a bounty. Read the accept line. If the issue is assigned, only assignees can
            claim.
          </li>
        </Ol>

        <H level={3}>3 · Ship the PR</H>
        <Ol>
          <li>Fork the repository linked on the bounty.</li>
          <li>Solve the issue as described. Match the project&apos;s standards.</li>
          <li>Open a pull request from your fork into the original repo.</li>
          <li>
            The GitHub account on the PR <b>must</b> match the account you connected in Settings.
          </li>
        </Ol>

        <H level={3}>4 · Claim</H>
        <Ol>
          <li>On the bounty page, paste the pull request URL and hit Claim.</li>
          <li>We import the PR from GitHub — author, state, merge status.</li>
          <li>Pay-on-merge: if several hunters claim, the first merged PR wins the pot.</li>
        </Ol>
        <Callout>
          Assignment lock: when the issue already has assignees on GitHub, only those logins can
          claim. Unassigned issues stay open to any connected hunter.
        </Callout>

        <H level={3}>5 · Get paid</H>
        <P>
          The keeper reviews and, when the PR is merged (or they accept your fork), marks complete.
          The <b>relayer</b> sends NIM to your saved payout wallet. If you had not saved a wallet
          yet, the payout sits <b>held</b> until Settings is filled in — then it releases
          automatically.
        </P>

        <H level={3}>Hunter workflow</H>
        <Flow
          steps={[
            { title: 'Connect', body: 'wallet + GitHub + payout address in Settings' },
            { title: 'Pick a bounty', body: 'Explore → open the issue' },
            { title: 'PR on GitHub', body: 'fork, fix, open pull request' },
            { title: 'Claim', body: 'paste the PR URL in Get Ransom' },
            { title: 'Wait for merge', body: 'pay-on-merge picks the winner' },
            { title: 'Keeper decides', body: 'accept or reject' },
            { title: 'Relayer pays', body: 'NIM lands in your saved wallet' },
          ]}
        />

        <H level={3}>Disputes</H>
        <Ol>
          <li>
            If your claim is rejected but the PR is merged and clearly solves the issue, open a
            dispute from My Claims with a short rationale and links.
          </li>
          <li>
            Keepers can still use your fork even when the upstream merge is delayed — that is a
            valid accept path.
          </li>
          <li>
            Unresolved disputes go to human review. You get the outcome in-app (email ships with
            the hosted backend).
          </li>
        </Ol>

        <hr className="doc-rule" />

        <H id="creator" level={2}>
          Bounty creator guide
        </H>
        <P>
          You are the keeper. You import a real GitHub issue, set the NIM pot, and decide when a
          claim is good enough to light the lamp and pay out.
        </P>

        <H level={3}>1 · Getting started</H>
        <Ol>
          <li>Connect your Nimiq wallet.</li>
          <li>
            Settings → Connect GitHub + payout wallet (you may earn on other bounties too).
          </li>
        </Ol>

        <H level={3}>2 · Create a bounty</H>
        <Ol>
          <li>
            Profile → <b>Create new bounty</b> (not on Explore — create has its own door).
          </li>
          <li>
            Paste a public GitHub issue URL and <b>Import</b>. Title, body, repo, labels, and
            assignees come from GitHub. No free-typed “issue” for GitHub bounties.
          </li>
          <li>Choose payment mode:</li>
        </Ol>
        <Ul>
          <li>
            <b>Pay on solve</b> — nothing moves now. Relayer pays on accept.
          </li>
          <li>
            <b>Prepaid</b> — funds move to the platform escrow when you publish. Completing still
            routes through the relayer to the hunter&apos;s wallet.
          </li>
        </Ul>
        <Ol start={4}>
          <li>Set the amount in NIM and publish.</li>
          <li>
            After publish, <b>we</b> comment on the issue as the app. You do not need to tag us.
          </li>
        </Ol>
        <Callout>
          Escrow is platform-maintained. You never paste a treasury address. Crowdfund top-ups go
          to the same escrow; every pledge is logged on the bounty.
        </Callout>

        <H level={3}>3 · Crowdfund</H>
        <P>
          Anyone (including you) can top up an open bounty. Contributors add NIM to the same pot.
          When the claim is paid, the full pot goes to the accepted hunter.
        </P>

        <H level={3}>4 · Review claims</H>
        <Ol>
          <li>Hunters submit a PR URL. We show author, merge state, and notes.</li>
          <li>
            <b>Wait for merge</b> if multiple PRs are in flight — merge decides who can be paid.
          </li>
          <li>
            Accept → relayer pays the hunter&apos;s saved wallet. Reject → open the bounty again
            (or keep waiting on other claims).
          </li>
        </Ol>

        <H level={3}>5 · Retract</H>
        <P>
          You can retract a bounty with no open claims. Refunds follow the prepaid/escrow rules
          for that pot (platform fee may apply on the hosted product).
        </P>

        <H level={3}>Creator workflow</H>
        <Flow
          steps={[
            { title: 'Import issue', body: 'paste GitHub URL, load metadata' },
            { title: 'Set pot & mode', body: 'on-solve or prepaid' },
            { title: 'Publish', body: 'we comment on the issue' },
            { title: 'Crowdfund (optional)', body: 'others top up the pot' },
            { title: 'Claims arrive', body: 'PR URLs imported from GitHub' },
            { title: 'Pay on merge', body: 'accept merged winner' },
            { title: 'Relayer', body: 'NIM to hunter wallet' },
          ]}
        />

        <hr className="doc-rule" />

        <H id="owner" level={2}>
          Repository owners
        </H>
        <P>
          Get Ransom is built for open source. You do not need to own a repo for someone to
          bounty an issue on it — but as a maintainer you can steer the traffic.
        </P>
        <Ul>
          <li>
            <b>Earn on your own repo</b> — community bounties land on your issues; you (or your
            contributors) can solve and claim.
          </li>
          <li>
            <b>Attract PRs</b> — a visible NIM pot on a hard bug is a better recruiting signal
            than another “good first issue” label.
          </li>
          <li>
            <b>Assignee lock</b> — assign the issue on GitHub and only that hunter can claim.
            Use it when you already have a trusted solver.
          </li>
          <li>
            <b>Install the GitHub App</b> — optional. Lets the bot post a single bounty comment
            and keeps tracking in the issue thread without spam.
          </li>
        </Ul>
        <Callout>
          Prefer PRs from forks over drive-by commits. If upstream merge is blocked, you can still
          accept a claim that uses the hunter&apos;s fork — same payout path.
        </Callout>

        <hr className="doc-rule" />

        <H id="github-app" level={2}>
          GitHub App
        </H>
        <P>
          The Get Ransom GitHub App is the quiet layer between issues and the lamp. Install it on
          orgs or specific repos so bounties can announce themselves without you babysitting
          comments.
        </P>

        <H level={3}>What you can do with the App</H>
        <Ul>
          <li>
            <b>Create bounties on public repos</b> — import any public issue into Get Ransom.
          </li>
          <li>
            <b>Announce once</b> — the app comments when a bounty is funded and when it is paid.
            No drive-by spam.
          </li>
          <li>
            <b>Track in-thread</b> — keepers and hunters keep context on GitHub while settlement
            happens in the mini-app.
          </li>
          <li>
            <b>Assignee awareness</b> — we read assignees so claim rules stay honest.
          </li>
        </Ul>

        <H level={3}>Install</H>
        <Ol>
          <li>Open the Get Ransom App on GitHub Marketplace (or your org&apos;s app settings).</li>
          <li>
            <b>Install</b> → choose the account/org → pick <b>All repositories</b> or a selected
            list.
          </li>
          <li>
            Grant issue read/write (comments) and pull-request read. We never push code.
          </li>
          <li>
            Back in the mini-app, import an issue on an installed repo and publish. The bot handles
            the rest.
          </li>
        </Ol>
        <Callout>
          You can still place bounties on public repos without installing the App. Install when you
          want the bot comment and cleaner tracking.
        </Callout>

        <H level={3}>How it works</H>
        <Flow
          steps={[
            { title: 'Install App', body: 'connect GitHub, pick repos' },
            { title: 'Import issue', body: 'paste URL in Create' },
            { title: 'Fund the pot', body: 'on-solve or prepaid NIM' },
            { title: 'Bot comments', body: 'bounty live on the issue' },
            { title: 'Hunter PR + claim', body: 'imported from GitHub' },
            { title: 'Merge & accept', body: 'keeper lights the lamp' },
            { title: 'Relayer payout', body: 'bot notes paid on the issue' },
          ]}
        />

        <hr className="doc-rule" />

        <H id="nimiq" level={2}>
          Nimiq, escrow & the relayer
        </H>
        <P>
          Get Ransom is a <b>Nimiq Pay mini-app</b>. Wallet actions run through the Mini App SDK
          inside Pay (native confirmation dialogs). Desktop browser is a preview with mock chain
          receipts so you can walk the full UI.
        </P>
        <Ul>
          <li>
            <b>Identity</b> — GitHub OAuth (or PR-author verification). Bound to the wallet login.
          </li>
          <li>
            <b>Escrow</b> — platform treasury for prepaid pots and crowdfunds. Not a paste-in
            address.
          </li>
          <li>
            <b>Relayer</b> — on accept, sends NIM to the hunter&apos;s stored payout wallet.
            Hold-release if that wallet was missing at accept time.
          </li>
          <li>
            <b>Units</b> — 1 NIM = 100,000 Luna on chain. UI shows NIM.
          </li>
          <li>
            <b>Testnet</b> — in Nimiq Pay, long-press settings for the dev menu, switch to
            testnet, claim free NIM, exercise real sends.
          </li>
        </Ul>
        <P>
          Share the mini-app with <code>nimiqpay://miniapp?url=…</code> or{' '}
          <code>https://nimpay.app/miniapps/open/…</code> once you have an HTTPS host.
        </P>

        <hr className="doc-rule" />

        <H id="faq" level={2}>
          FAQs
        </H>

        <H level={3}>When is a bounty paid?</H>
        <P>
          When the keeper accepts a claim whose PR is merged (or whose fork they choose to use).
          Merge alone does not pay; accept + relayer does.
        </P>

        <H level={3}>What if my PR is not merged?</H>
        <P>
          Talk on the issue. The keeper can still accept if they take your fork. Pay-on-merge
          means unmerged PRs wait — that is intentional when several hunters compete.
        </P>

        <H level={3}>Can I claim several bounties at once?</H>
        <P>Yes. Each claim is a separate PR and a separate pot.</P>

        <H level={3}>Do I need to own the repository?</H>
        <P>
          No. Anyone can fund a bounty on a public issue. Maintainers can install the App for bot
          comments and assignee locks.
        </P>

        <H level={3}>Why do I need GitHub connect?</H>
        <P>
          Payouts and claims are tied to a real GitHub login so pasted handles cannot be spoofed.
          The PR author must match your connected account.
        </P>

        <H level={3}>Can I change my payout wallet?</H>
        <P>
          Yes — Settings. GitHub stays bound to the wallet login; the NIM payout address is
          editable.
        </P>

        <H level={3}>Support</H>
        <P>
          In-app toasts and claim states first. For production, wire support@yourdomain and the
          dispute queue to the same moderation desk you run for the App.
        </P>

        <p className="doc-foot">
          Lamp true. Pots honest. Happy shipping.
        </p>
      </article>
    </div>
  );
}
