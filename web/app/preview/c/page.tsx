import Image from 'next/image'
import Link from 'next/link'

const CONTRACT = `
THESIS: One continuous ink field from first pixel to footer, the fresco emerging
out of it like a lit stage; it refuses the light centred marketing page that
stacks white cards under a hero.
OWN-WORLD: Ink (#080A0E) and slate (#141922) with bone text and gilt (#C9A227) as
the only accent, lifted from the fresco's own gold. Boska display with real
italics, Satoshi body, Spline Sans Mono for the ledger. Sections fade through one
another; no white slabs anywhere.
STORY: A debater recognises the night before a tournament, sees the scoring
opened up honestly, and starts coaching.
FIRST VIEWPORT: Full-bleed graded fresco, the far archway the only light source
and breathing; thin uppercase nav; centred display headline with one italic word;
a single gilt-outlined action; formats set as a tracked mono strip at the fade.
FORM: Nocturne chiaroscuro, candidate 3 of the grounded list.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`

const LEDGER = [
  { label: 'Extended the dropped turn cleanly', value: 0.62 },
  { label: 'Weighed magnitude against timeframe', value: 0.41 },
  { label: "Preempted the opponent's likely 2NR collapse", value: 0.35 },
  { label: 'New argument in the final speech', value: -0.28 },
  { label: 'No judge-specific framing', value: -0.19 },
]
const MAX = 0.62

const CARDS = [
  {
    title: 'Prep',
    body: 'Bring a case or a block. Cross names the missing warrant and describes the card that would fill it.',
    plate: [
      ['case', 'aff-neolib-v3'],
      ['flagged', 'C2: no baseline'],
      ['suggested', 'quantified magnitude'],
    ],
  },
  {
    title: 'Drill',
    body: 'A generated round, one dropped argument, one live turn. Write or speak the next speech and get graded against a key computed first.',
    plate: [
      ['format', 'PF: Summary'],
      ['speech', '1:42 · 214 wpm'],
      ['tone', 'flattened at weighing'],
    ],
  },
  {
    title: 'Judges',
    body: 'The paradigm for the judge you drew, read into what it changes about speed, theory and how the ballot gets written.',
    plate: [
      ['judge', 'A. Reyes'],
      ['speed', '8 / 10'],
      ['theory', 'reluctant'],
    ],
  },
  {
    title: 'Coach',
    body: 'Ask anything mid-prep. Pre-Round mode adds the opponent’s disclosed positions from your own linked account.',
    plate: [
      ['mode', 'pre-round'],
      ['scouting', '14 rounds'],
      ['backhalf', 'CP 71%'],
    ],
  },
]

const PEOPLE = [
  { name: 'First Last', role: 'Product & engineering', bio: 'The coaching loop, the corpus pipeline, the Tabroom integration.' },
  { name: 'First Last', role: 'Debate lead', bio: 'What good feedback sounds like, format by format.' },
  { name: 'First Last', role: 'Evidence & corpus', bio: 'Cuts and tags what Cross reasons from.' },
  { name: 'First Last', role: 'Design', bio: 'Keeps the room quiet enough to think in.' },
]

export default function DirectionC() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} />
      <main className="pv pv-c">
        <nav className="pv-c-nav" aria-label="Primary">
          <div className="pv-wrap pv-c-nav-inner">
            <Link href="/preview/c" className="pv-c-mark">
              Cross
            </Link>
            <ul>
              <li>
                <a href="#product">Product</a>
              </li>
              <li>
                <a href="#how">How</a>
              </li>
              <li>
                <a href="#ledger">Ledger</a>
              </li>
              <li>
                <a href="#people">People</a>
              </li>
            </ul>
            <a className="pv-signin" href="#close">
              Sign in
            </a>
          </div>
        </nav>

        <header className="pv-c-hero">
          <div className="pv-c-hero-img">
            <Image
              src="/preview/hero-c.jpg"
              alt="Raphael's The School of Athens graded to a nocturne, the far archway the only light"
              fill
              priority
              sizes="100vw"
            />
          </div>
          <div className="pv-c-glow" aria-hidden="true" />
          <div className="pv-c-hero-fade" aria-hidden="true" />
          <div className="pv-wrap">
            <h1>
              Every round is an <em>argument</em> you can rehearse.
            </h1>
            <p className="pv-c-sub">
              An AI debate coach that shows its reasoning, and grades your speech against a key it
              computed before you spoke.
            </p>
            <div className="pv-c-cta">
              <button className="pv-btn pv-primary" type="button">
                Start coaching
              </button>
            </div>
          </div>
          <div className="pv-c-formats" aria-hidden="true">
            <span>Policy</span>
            <span>Lincoln-Douglas</span>
            <span>Public Forum</span>
            <span>Parliamentary</span>
          </div>
        </header>

        <section id="product">
          <div className="pv-wrap-narrow pv-c-story pv-rise">
            <h2>The night before is where rounds are won.</h2>
            <p>
              Cross is built for the hours you spend with the case open and the pairing already
              known. It reads what you wrote, reads the judge you drew, and argues with you about
              what to collapse to.
            </p>
            <p>
              It is a coach, not a crutch: every recommendation carries the reasoning, because the
              reasoning is the part you take into the next round without it.
            </p>
          </div>
        </section>

        <section>
          <div className="pv-wrap pv-rise">
            <h2>What you get.</h2>
            <div className="pv-c-cards">
              {CARDS.map((card) => (
                <article className="pv-c-card" key={card.title}>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <div className="pv-c-plate">
                    {card.plate.map(([k, v]) => (
                      <span key={k + v}>
                        <span>{k}</span>
                        <b>{v}</b>
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
            <p className="pv-synthetic" style={{ marginTop: '1.25rem' }}>
              Synthetic data
            </p>
          </div>
        </section>

        <section id="how">
          <div className="pv-wrap pv-rise">
            <h2>Three steps.</h2>
            <div className="pv-c-strip">
              <div>
                <figure>
                  <Image src="/preview/card-c.jpg" alt="" width={880} height={550} />
                  <b>1</b>
                </figure>
                <h3>Bring your round</h3>
                <p>Case, flow, recording, or just the pairing you were handed.</p>
              </div>
              <div>
                <figure>
                  <Image src="/preview/card-a.jpg" alt="" width={880} height={550} />
                  <b>2</b>
                </figure>
                <h3>Cross reads it</h3>
                <p>Your material, your judge, and what real rounds on this argument tend to do.</p>
              </div>
              <div>
                <figure>
                  <Image src="/preview/card-b.jpg" alt="" width={880} height={550} />
                  <b>3</b>
                </figure>
                <h3>You get the ledger</h3>
                <p>Options with tradeoffs and a score you can audit line by line.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pv-c-ledger-sec" id="ledger">
          <div className="pv-wrap pv-c-ledger-grid">
            <div className="pv-rise">
              <h2>The number opens up.</h2>
              <p style={{ marginTop: '1.25rem', maxWidth: '42ch', color: 'rgba(232,228,220,0.72)' }}>
                Grading starts from an even round and moves in log-odds, one factor at a time. If
                you think a weight is wrong, you can say so, and reporting how the move actually
                went is how the weights get better.
              </p>
              <p className="pv-synthetic" style={{ marginTop: '1.5rem' }}>
                Synthetic example
              </p>
            </div>
            <div className="pv-ledger">
              <div className="pv-ledger-row">
                <span>Prior: an even round</span>
                <span />
                <span>50%</span>
              </div>
              {LEDGER.map((row, i) => (
                <div className={`pv-ledger-row${row.value < 0 ? ' pv-ledger-neg' : ''}`} key={row.label}>
                  <span>{row.label}</span>
                  <span className="pv-ledger-track">
                    <span
                      className="pv-ledger-bar"
                      style={{
                        width: `${Math.round((Math.abs(row.value) / MAX) * 100)}%`,
                        transitionDelay: `${0.12 + i * 0.09}s`,
                      }}
                    />
                  </span>
                  <span>
                    {row.value > 0 ? '+' : '−'}
                    {Math.abs(row.value).toFixed(2)}
                  </span>
                </div>
              ))}
              <div className="pv-ledger-out">
                <strong>71%</strong>
                <span style={{ maxWidth: '32ch', fontSize: '0.75rem', lineHeight: 1.5, color: 'rgba(232,228,220,0.6)' }}>
                  Structured judgment for comparing candidate moves, not a claimed win rate.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section id="people">
          <div className="pv-wrap pv-rise">
            <h2>People behind it.</h2>
            <div className="pv-c-people">
              {PEOPLE.map((p, i) => (
                <article className="pv-c-person" key={i}>
                  <figure>PORTRAIT</figure>
                  <h3>{p.name}</h3>
                  <em>{p.role}</em>
                  <p>{p.bio}</p>
                </article>
              ))}
            </div>
            <p className="pv-synthetic" style={{ marginTop: '1.5rem' }}>
              Placeholder names, roles and portraits
            </p>
          </div>
        </section>

        <section>
          <div className="pv-wrap pv-rise">
            <h2>Built for competitive debate.</h2>
            <div className="pv-c-claims">
              <div>
                <h3>The corpus stays private</h3>
                <p>What you ingest sharpens the coaching and is never named or quoted back at you.</p>
              </div>
              <div>
                <h3>Paradigms, through your account</h3>
                <p>Judge and disclosure data comes from your own linked Tabroom login, or not at all.</p>
              </div>
              <div>
                <h3>No invented evidence</h3>
                <p>Cross tells you what card to cut. It will not write you a citation that does not exist.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pv-c-close" id="close">
          <div className="pv-wrap-narrow">
            <h2>Open the room.</h2>
            <p>Bring tomorrow’s round and work it tonight.</p>
            <button className="pv-btn pv-primary" type="button">
              Start coaching
            </button>
          </div>
        </section>
      </main>
    </>
  )
}
