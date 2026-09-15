import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'hunter', label: 'Bounty hunters' },
  { id: 'creator', label: 'Bounty creators' },
  { id: 'promises', label: 'Promises & pay' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'nimiq', label: 'Nimiq Pay' },
  { id: 'roadmap', label: 'Upcoming' },
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
            Put a NIM pot on a GitHub issue. Anyone can promise more. Hunters ship PRs. When the
            keeper accepts a merged PR, they pay from their own Nimiq Pay wallet. No platform
            custody.
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
          You are paid in NIM for a merged pull request. Your identity is the GitHub account you
          connect (it must match the PR author). Your payout wallet is a NIM address saved on your
          account — it follows you on every device.
        </P>

        <H level={3}>1 · Get set</H>
        <Ol>
          <li>
            Open the app in <b>Nimiq Pay</b> (or a desktop browser for browsing only).
          </li>
          <li>
            <b>Connect GitHub</b> in Settings. That login is you everywhere. Sign in again on
            another phone and the same account comes back.
          </li>
          <li>
            Save a <b>payout wallet</b> (NQ…). Claims without one are blocked until you add it.
          </li>
        </Ol>

        <H level={3}>2 · Find work</H>
        <Ol>
          <li>Explore → search title, repo, or tags.</li>
          <li>Open a bounty. Read the reward total and who has promised.</li>
          <li>
            If <b>assignee only</b> is on, only those GitHub logins can claim. Otherwise anyone
            connected can.
          </li>
        </Ol>

        <H level={3}>3 · Ship and claim</H>
        <Ol>
          <li>Fork the repo, fix the issue, open a PR from your GitHub account.</li>
          <li>
            <b>Claim bounty</b> → paste the PR URL in the modal. Other submitted PRs are listed
            under the form.
          </li>
          <li>
            Several hunters can claim. The keeper merges one PR and pays that claim. The rest stay
            unpaid.
          </li>
        </Ol>
        <Callout>
          The PR author must match your connected GitHub. A pasted handle that is not yours will
          not pay out.
        </Callout>

        <H level={3}>4 · Get paid</H>
        <P>
          After merge, the keeper opens the claim and taps pay inside Nimiq Pay. NIM moves from
          their wallet to your saved payout address on-chain. Get Ransom never holds the pot.
        </P>

        <H level={3}>Hunter workflow</H>
        <Flow
          steps={[
            { title: 'Connect GitHub + payout wallet', body: 'Settings, any device' },
            { title: 'Open a bounty', body: 'Explore' },
            { title: 'PR on GitHub', body: 'author = connected login' },
            { title: 'Claim', body: 'modal → paste PR URL' },
            { title: 'Keeper merges & pays', body: 'real NIM send from their wallet' },
          ]}
        />

        <hr className="doc-rule" />

        <H id="creator" level={2}>
          Bounty creator guide
        </H>
        <P>
          You post a pot on a public GitHub issue and sign a promise for that amount. When a PR is
          merged and you accept it, you send the full reward from Nimiq Pay.
        </P>

        <H level={3}>1 · Create</H>
        <Ol>
          <li>Connect GitHub. Connect your Nimiq wallet (for signing and paying).</li>
          <li>
            <b>Create a bounty</b> → paste a public issue URL → <b>Import</b>.
          </li>
          <li>
            Optional: <b>Only GitHub assignees can claim</b> if the issue is already assigned.
          </li>
          <li>Set the NIM amount → <b>Sign promise &amp; publish</b> (modal + wallet sign).</li>
        </Ol>
        <Callout>
          Pay on solve only. There is no prepaid escrow. Nimiq has no merge-conditioned contract
          that would let a platform hold funds without custody risk.
        </Callout>

        <H level={3}>2 · Grow the pot</H>
        <P>
          Anyone can <b>Promise +N</b>. The total reward updates and their name joins
          Contributions under yours. Promises are signed statements, not locked coins.
        </P>

        <H level={3}>3 · Review claims</H>
        <Ol>
          <li>Claims list every PR submitted. Open the link on GitHub.</li>
          <li>
            Merge the PR you want. Unmerged claims show <b>Wait for merge</b>.
          </li>
          <li>
            <b>Pay</b> → confirm the NIM send in Nimiq Pay to the hunter&apos;s payout wallet.
          </li>
          <li>Reject the rest if you want a clean board.</li>
        </Ol>

        <H level={3}>4 · Retract</H>
        <P>You can retract a bounty with no open in-review claims.</P>

        <H level={3}>Creator workflow</H>
        <Flow
          steps={[
            { title: 'Import issue', body: 'public GitHub URL' },
            { title: 'Sign promise', body: 'modal + Nimiq Pay sign' },
            { title: 'Optional pledges', body: 'others add to the pot' },
            { title: 'Claims arrive', body: 'PR URLs' },
            { title: 'Merge one PR', body: 'on GitHub' },
            { title: 'Pay from your wallet', body: 'on-chain NIM to hunter' },
          ]}
        />

        <hr className="doc-rule" />

        <H id="promises" level={2}>
          Promises and how money moves
        </H>
        <P>
          A <b>promise</b> is a signed message: who, which issue, how much NIM, pay-on-solve. It
          shows on the bounty under Contributions. It is not escrow.
        </P>
        <Ul>
          <li>
            <b>Create</b> — creator signs the base pot.
          </li>
          <li>
            <b>Pledge</b> — anyone signs an add-on. Reward total = sum of promises.
          </li>
          <li>
            <b>Pay</b> — only the creator&apos;s wallet sends NIM, when they accept a merged claim.
          </li>
        </Ul>
        <Callout>
          Default risk is real: a creator can delay or refuse pay after merge. Mitigations are the
          public promise, the PR trail, and reputation — not a locked contract.
        </Callout>

        <hr className="doc-rule" />

        <H id="accounts" level={2}>
          Accounts across devices
        </H>
        <Ul>
          <li>
            <b>GitHub session</b> — Connect GitHub sets a cookie on that browser. Another device
            needs Connect GitHub once; your payout wallet and history load from the server.
          </li>
          <li>
            <b>Payout wallet</b> — stored on your account, not only on the phone.
          </li>
          <li>
            <b>Nimiq wallet</b> — keys stay in Nimiq Pay. Connect wallet is per device; that is
            intentional.
          </li>
          <li>
            <b>Bounties &amp; claims</b> — shared. Everyone sees the same pots.
          </li>
        </Ul>

        <hr className="doc-rule" />

        <H id="nimiq" level={2}>
          Nimiq Pay
        </H>
        <P>
          Get Ransom is a Nimiq Pay mini-app. Sign and send go through native wallet dialogs. A
          desktop browser can browse and connect GitHub; real NIM needs Pay.
        </P>
        <Ul>
          <li>
            <b>Units</b> — 1 NIM = 100,000 Luna. UI shows NIM.
          </li>
          <li>
            <b>Open in Pay</b> —{' '}
            <code>https://nimpay.app/miniapps/open/get-ransom.vercel.app</code>
          </li>
          <li>
            <b>Testnet</b> — in Pay, long-press settings for the dev menu, switch to testnet, claim
            free NIM, exercise sends.
          </li>
        </Ul>

        <hr className="doc-rule" />

        <H id="roadmap" level={2}>
          Upcoming
        </H>
        <P>
          Today money moves on <b>NIM</b> with signed promises and pay-on-merge from the
          creator&apos;s wallet. Next we want locked pots in stablecoins.
        </P>
        <Ul>
          <li>
            <b>EVM escrow (USDC / USDT)</b> — Nimiq L1 has no general contracts, but Nimiq Pay
            exposes <code>window.ethereum</code> for Base, Polygon, and other EVM chains. We plan a
            bounty escrow contract so funds lock on create and can only go to the hunter (or
            refund on timeout), not a platform hot wallet.
          </li>
          <li>
            <b>Why not live yet</b> — mini-app ERC-20 sends need the chain&apos;s native gas token
            (no Pay gas abstraction). We need the contract, a keeper/oracle call on merge, and a
            clean dual-currency UI before we ship it.
          </li>
          <li>
            <b>Until then</b> — use NIM. Promises are public and signed; they are not escrow.
          </li>
        </Ul>

        <hr className="doc-rule" />

        <H id="faq" level={2}>
          FAQs
        </H>

        <H level={3}>When is a bounty paid?</H>
        <P>
          When the keeper accepts a claim whose PR is merged and confirms the NIM send in Nimiq
          Pay. Merge alone does not pay.
        </P>

        <H level={3}>Can many people claim?</H>
        <P>
          Yes, unless assignee lock is on. One merged PR is paid. You can reject the others.
        </P>

        <H level={3}>Is the pot locked?</H>
        <P>
          No on NIM today. Promises are signed commitments. Coins move only when the creator pays
          on accept. Locked EVM escrow (USDC/USDT) is listed under Upcoming.
        </P>

        <H level={3}>Why connect GitHub?</H>
        <P>
          So claims and payouts bind to a real login. PR author must match the connected account.
        </P>

        <H level={3}>Can I change my payout wallet?</H>
        <P>
          Yes. Settings → payout wallet. It saves to your account and works on every device after
          you Connect GitHub.
        </P>

        <p className="doc-foot">Lamp true. Pots honest. Happy shipping.</p>
      </article>
    </div>
  );
}
