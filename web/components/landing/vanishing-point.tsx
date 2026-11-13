import Image from 'next/image'
import Link from 'next/link'
import { VanishingLines } from './vanishing-lines'

// Direction A — The Vanishing Point. The public landing page.
// Every "Sign in" / "Start coaching" control routes to /home, where the
// existing AuthGate (Google + emailed link) takes over; nothing here
// re-implements authentication.

const LEDGER = [
  { label: 'Extended the dropped turn cleanly', value: 0.62 },
  { label: 'Weighed magnitude against timeframe', value: 0.41 },
  { label: "Preempted the opponent's likely 2NR collapse", value: 0.35 },
  { label: 'New argument in the final speech', value: -0.28 },
  { label: 'No judge-specific framing (the paradigm asks for it)', value: -0.19 },
]
const MAX = 0.62

const BAYS = [
  {
    title: 'Prep',
    body: 'Bring a case, a block, or a half-formed idea. Cross names the missing warrant and describes the card that would fill it.',
    icon: <path d="M6 30V10a8 8 0 0 1 16 0v20M6 30h16M10 16h8M10 22h8" />,
  },
  {
    title: 'Drill',
    body: 'A generated round, an opponent with a tendency, a judge with a quirk. Write or speak the next speech, then get graded.',
    icon: <path d="M14 6v9l6 4M14 27a11 11 0 1 1 0-22 11 11 0 0 1 0 22Z" />,
  },
  {
    title: 'Judges',
    body: 'The paradigm for the judge you actually drew, read into what it changes about speed, theory and how the ballot gets written.',
    icon: <path d="M14 5v22M6 12h16M8 12l-4 8h8l-4-8Zm12 0-4 8h8l-4-8Z" />,
  },
  {
    title: 'Coach',
    body: 'Ask anything mid-prep. Pre-Round mode adds the opponent’s disclosed positions from your own linked Tabroom account.',
    icon: <path d="M4 8h20v14H12l-6 5v-5H4V8Z" />,
  },
]

export function VanishingPoint() {
  return (
    <main className="pv pv-a">
      <nav className="pv-a-nav" aria-label="Primary">
        <Link href="/" className="pv-a-mark">
          Cross
        </Link>
        <div className="pv-a-nav-links">
          <a href="#product">Product</a>
          <a href="#how">How it works</a>
          <a href="#ledger">The ledger</a>
        </div>
        <Link className="pv-btn" href="/home">
          Sign in
        </Link>
      </nav>

      <header className="pv-a-hero">
        <div className="pv-a-hero-img">
          <Image
            src="/landing/hero.jpg"
            alt="The central bay of Raphael's The School of Athens"
            fill
            priority
            sizes="100vw"
          />
        </div>
        <VanishingLines />

        <div className="pv-a-hero-inner pv-wrap">
          <h1>Argue like the room is watching.</h1>
          <p className="pv-a-sub">
            An AI debate coach that hands back your own judgment, sharper, not a script to read.
          </p>
          <div className="pv-a-cta">
            <Link className="pv-btn pv-primary" href="/home">
              Start coaching
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M2 7h10M8 3l4 4-4 4" />
              </svg>
            </Link>
            <a className="pv-btn pv-quiet" href="#ledger">
              See a graded drill
            </a>
          </div>
        </div>
        <div className="pv-a-scroll" aria-hidden="true">
          SCROLL
        </div>
      </header>

      <section id="product">
        <div className="pv-wrap pv-a-thesis pv-rise">
          <div>
            <h2>Built for the round you are actually about to debate.</h2>
            <p>
              Cross reads your case, your flow and your judge, then coaches from what it has
              internalised about real rounds. It argues with you about strategy instead of handing
              you a paragraph to read aloud. Every recommendation carries its reasoning, because
              the reasoning is the part that transfers to the next round.
            </p>
          </div>
          <ul className="pv-a-formats">
            <li>
              <span>Policy</span>
              <span>CX · CEDA · NDT</span>
            </li>
            <li>
              <span>Lincoln-Douglas</span>
              <span>TRAD · CIRCUIT</span>
            </li>
            <li>
              <span>Public Forum</span>
              <span>LAY-ADJACENT</span>
            </li>
            <li>
              <span>Parliamentary</span>
              <span>IMPROMPTU</span>
            </li>
          </ul>
        </div>
      </section>

      <section>
        <div className="pv-wrap pv-rise">
          <h2>What Cross does.</h2>
          <div className="pv-a-bays">
            {BAYS.map((bay) => (
              <article className="pv-a-bay" key={bay.title}>
                <svg
                  width="28"
                  height="32"
                  viewBox="0 0 28 32"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  {bay.icon}
                </svg>
                <h3>{bay.title}</h3>
                <p>{bay.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how">
        <div className="pv-wrap pv-rise">
          <h2>Three steps, one sightline.</h2>
          <div className="pv-a-steps">
            <div className="pv-a-step">
              <b>1</b>
              <h3>Bring your round</h3>
              <p>
                Upload the case, paste the flow, record the speech, or just describe the pairing you
                were handed.
              </p>
            </div>
            <div className="pv-a-step">
              <b>2</b>
              <h3>Cross reads it</h3>
              <p>
                Your material, your judge’s paradigm, and what real rounds on this kind of argument
                tend to do.
              </p>
            </div>
            <div className="pv-a-step">
              <b>3</b>
              <h3>You get the ledger</h3>
              <p>Options with tradeoffs and a visible score, never a verdict you are asked to trust blind.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="pv-a-ledger" id="ledger">
        <div className="pv-wrap pv-a-ledger-grid">
          <div className="pv-rise">
            <h2>Every number shows its work.</h2>
            <p style={{ marginTop: '1.25rem', maxWidth: '46ch', color: '#4a5058' }}>
              Drill grading starts from an even round and adjusts in log-odds, one factor at a time.
              You see the whole ledger, so you can disagree with a weight instead of arguing with a
              black box.
            </p>
            <p className="pv-synthetic" style={{ marginTop: '1.5rem' }}>
              Synthetic example
            </p>
          </div>
          <div className="pv-ledger">
            <div className="pv-ledger-row">
              <div>
                <span>Prior: an even round</span>
              </div>
              <span>50%</span>
            </div>
            {LEDGER.map((row, i) => (
              <div className={`pv-ledger-row${row.value < 0 ? ' pv-ledger-neg' : ''}`} key={row.label}>
                <div>
                  <span>{row.label}</span>
                  <div
                    className="pv-ledger-bar"
                    style={{
                      width: `${Math.round((Math.abs(row.value) / MAX) * 100)}%`,
                      transitionDelay: `${0.1 + i * 0.09}s`,
                      marginTop: '0.4rem',
                    }}
                  />
                </div>
                <span>
                  {row.value > 0 ? '+' : '−'}
                  {Math.abs(row.value).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="pv-ledger-out">
              <strong>71%</strong>
              <span style={{ maxWidth: '30ch', fontSize: '0.75rem', lineHeight: 1.5 }}>
                Structured judgment for comparing moves, not a claimed win rate.
              </span>
            </div>
          </div>
        </div>
      </section>


      <section>
        <div className="pv-wrap pv-rise">
          <h2>Built for competitive debate.</h2>
          <div className="pv-a-claims">
            <div>
              <h3>Coaching, not copying</h3>
              <p>
                Cross is built to coach from patterns in real rounds, not to read someone else&apos;s
                case back to you.
              </p>
            </div>
            <div>
              <h3>Your Tabroom, your account</h3>
              <p>
                Disclosed positions are looked up only through your own linked Tabroom account.
                Public judge paradigms work without linking anything.
              </p>
            </div>
            <div>
              <h3>Describes cards, doesn&apos;t invent them</h3>
              <p>
                Cross is designed to describe the card you should go cut rather than make one up. It
                is still an AI and can be wrong, so check every cite before you read it in a round.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="pv-a-close">
        <div className="pv-wrap pv-rise">
          <div className="pv-a-close-arch">
            <Image
              src="/landing/arch.jpg"
              alt="Detail of the archway at the centre of the fresco"
              width={880}
              height={550}
            />
          </div>
          <h2>Your next round is already on the board.</h2>
          <div className="pv-a-cta">
            <Link className="pv-btn pv-primary" href="/home">
              Start coaching
            </Link>
          </div>
        </div>
      </section>

      <footer className="pv-a-foot">
        <div className="pv-wrap pv-a-foot-inner">
          <span className="pv-a-mark">Cross</span>
          <p>An AI debate coach for Policy, Lincoln-Douglas, Public Forum and Parliamentary.</p>
          <nav aria-label="Legal" className="pv-a-foot-links">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/cookies">Cookies</Link>
            <a href="mailto:support@cross-ai.dev">support@cross-ai.dev</a>
            <Link href="/home">Sign in</Link>
          </nav>
          <p className="pv-a-foot-legal">© 2026 Cross AI. Not affiliated with the NSDA, Tabroom.com or OpenCaselist.</p>
        </div>
      </footer>
    </main>
  )
}
