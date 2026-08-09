import Image from 'next/image'
import Link from 'next/link'
import { JudgeDock } from './judge-dock'

const CONTRACT = `
THESIS: The page is drawn in the two graphic systems debaters already read under
pressure — the postings board and the flow sheet; it refuses the centred
cinematic hero with a stock product screenshot.
OWN-WORLD: Paper white and board grey (#F4F2ED) on ink (#101114) with highlighter
yellow (#FFE24B) owning whole regions. Clash Display, Supreme body, Martian Mono
for anything tabular. Square 4-6px radii for chrome, one 48px curved image plate.
STORY: A debater recognises their own working documents, sees the product read a
judge and a flow, and starts coaching.
FIRST VIEWPORT: Split — left, uppercase three-line headline, two actions and a
four-cell fact strip; right, a tall curved plate of the geometers with a judge
paradigm panel docked flush to its left edge.
FORM: Postings board and flow sheet, candidate 2 of the grounded list.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md
`

const ROWS = [
  {
    title: 'Prep',
    body: 'Drop in a case, a block or a contention and get the missing warrant named — plus what to cut to fill it. Not "add more evidence": what the source has to establish.',
    art: [
      ['case', 'aff-neolib-v3.docx'],
      ['flagged', 'C2 impact — no baseline'],
      ['flagged', 'solvency card carries 2 claims'],
      ['suggested', 'quantified magnitude, post-2023'],
    ],
  },
  {
    title: 'Drill',
    body: 'A generated round with one clearly dropped argument, one live turn and an opponent who has a tendency. Write or speak the next speech; get graded against a key computed before you started.',
    art: [
      ['format', 'PF — Summary'],
      ['opponent', 'collapses to framework'],
      ['judge', 'wants explicit weighing'],
      ['your speech', '1:42 · 214 wpm'],
    ],
  },
  {
    title: 'Judges',
    body: 'The paradigm for the judge you actually drew, summarised into what it changes: speed ceiling, theory defaults, what they will and will not evaluate.',
    art: [
      ['judge', 'A. Reyes'],
      ['speed', '8 / 10'],
      ['theory', 'reluctant'],
      ['ballot', 'write it in the last two minutes'],
    ],
  },
  {
    title: 'Coach',
    body: 'Ask mid-prep. In Pre-Round mode it also reads the opponent’s disclosed positions from your own linked account and turns the rounds data into collapse advice.',
    art: [
      ['mode', 'pre-round'],
      ['scouting', '14 disclosed rounds'],
      ['side split', 'aff 8 / neg 6'],
      ['backhalf', 'collapses to CP 71% of rounds'],
    ],
  },
]

const PEOPLE = [
  { name: 'First Last', role: 'Product & engineering', bio: 'Owns the coaching loop, the ingest pipeline and the Tabroom integration.' },
  { name: 'First Last', role: 'Debate lead', bio: 'Decides what good feedback sounds like in each format.' },
  { name: 'First Last', role: 'Evidence & corpus', bio: 'Cuts and tags the material Cross reasons from.' },
  { name: 'First Last', role: 'Design', bio: 'Keeps the tool quiet enough to use ten minutes before a round.' },
]

export default function DirectionB() {
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: `<!--${CONTRACT}-->` }} />
      <main className="pv pv-b">
        <div className="pv-wrap">
          <nav className="pv-b-nav" aria-label="Primary">
            <Link href="/preview/b" className="pv-b-mark">
              Cross
            </Link>
            <ul>
              <li>
                <a href="#product">Product</a>
              </li>
              <li>
                <a href="#how">How it works</a>
              </li>
              <li>
                <a href="#card">Evidence</a>
              </li>
              <li>
                <a href="#people">People</a>
              </li>
            </ul>
            <button className="pv-btn" type="button">
              Sign in
            </button>
          </nav>

          <header className="pv-b-hero">
            <div>
              <h1>
                Prep the round.
                <br />
                Read the judge.
                <br />
                Win the flow.
              </h1>
              <p className="pv-b-sub">
                Cross coaches Policy, LD, PF and Parli from real round material — and pulls the
                paradigm and disclosure for the pairing in front of you.
              </p>
              <div className="pv-b-actions">
                <button className="pv-btn pv-primary" type="button">
                  Start coaching
                </button>
                <button className="pv-btn pv-ghost" type="button">
                  Sign in
                </button>
              </div>
              <dl className="pv-b-tiles">
                <div>
                  <dt>Formats</dt>
                  <dd>Policy · LD · PF · Parli</dd>
                </div>
                <div>
                  <dt>Judges</dt>
                  <dd>Paradigms pulled live</dd>
                </div>
                <div>
                  <dt>Corpus</dt>
                  <dd>Private, never quoted</dd>
                </div>
                <div>
                  <dt>Scoring</dt>
                  <dd>Every grade shows its ledger</dd>
                </div>
              </dl>
            </div>

            <div className="pv-b-plate">
              <Image
                src="/preview/hero-b.jpg"
                alt="Detail of Raphael's The School of Athens: geometers working on the marble steps"
                width={1240}
                height={1550}
                priority
                sizes="(max-width: 1000px) 100vw, 45vw"
              />
              <JudgeDock />
            </div>
          </header>
        </div>

        <section className="pv-b-white" id="product">
          <div className="pv-wrap pv-b-story pv-rise">
            <div>
              <h2>A coach, not a crutch.</h2>
              <p className="pv-b-pull">
                Cross exists to make you better at deciding, not better at reading out what an AI
                wrote.
              </p>
              <p>
                It gives flow-based critique — what was dropped, what got extended cleanly, whether
                you answered the judge’s actual instructions. It plans strategy against the
                positions the other side is likely to run. And for in-round calls it lays out the
                options with their tradeoffs, because you are the one making the call.
              </p>
            </div>
            <ul className="pv-b-who">
              <li>
                <span>01</span>
                <span>High school and college debaters across four formats</span>
              </li>
              <li>
                <span>02</span>
                <span>Circuit and traditional — the register follows your format</span>
              </li>
              <li>
                <span>03</span>
                <span>Prep at a desk; drills on a schedule</span>
              </li>
              <li>
                <span>04</span>
                <span>Anyone who wants the reasoning, not the verdict</span>
              </li>
            </ul>
          </div>
        </section>

        <section>
          <div className="pv-wrap">
            <h2 className="pv-rise">What you get.</h2>
            <div>
              {ROWS.map((row) => (
                <div className="pv-b-row pv-rise" key={row.title}>
                  <div>
                    <h3>{row.title}</h3>
                    <p>{row.body}</p>
                  </div>
                  <div className="pv-b-row-art">
                    {row.art.map(([k, v]) => (
                      <div className="pv-b-artline" key={k + v}>
                        <span>{k}</span>
                        <b>{v}</b>
                      </div>
                    ))}
                    <span className="pv-synthetic" style={{ color: '#8a9099' }}>
                      Synthetic
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="pv-b-white" id="how">
          <div className="pv-wrap">
            <h2 className="pv-rise">How it works — read it like a flow.</h2>
            <div className="pv-b-flow">
              <svg className="pv-b-arrows" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <path pathLength={1} d="M23 26 H27" style={{ animationDelay: '0.05s' }} />
                <path pathLength={1} d="M23 40 H27" style={{ animationDelay: '0.11s' }} />
                <path pathLength={1} d="M48 26 H52" style={{ animationDelay: '0.17s' }} />
                <path pathLength={1} d="M48 52 H52" style={{ animationDelay: '0.23s' }} />
                <path pathLength={1} d="M73 40 H77" style={{ animationDelay: '0.29s' }} />
                <path pathLength={1} d="M73 52 H77" style={{ animationDelay: '0.35s' }} />
              </svg>
              <div className="pv-b-col">
                <h4>1 · Bring the round</h4>
                <div className="pv-b-chip">Case doc uploaded</div>
                <div className="pv-b-chip">Judge: A. Reyes</div>
                <div className="pv-b-chip">Opponent disclosed 14 rounds</div>
              </div>
              <div className="pv-b-col">
                <h4>2 · Cross reads it</h4>
                <div className="pv-b-chip">C2 has no baseline</div>
                <div className="pv-b-chip">Their CP is live 71% of rounds</div>
                <div className="pv-b-chip pv-drop">Framework turn — dropped</div>
              </div>
              <div className="pv-b-col">
                <h4>3 · You get options</h4>
                <div className="pv-b-chip">Collapse to the turn</div>
                <div className="pv-b-chip">Hold both, weigh timeframe</div>
                <div className="pv-b-chip pv-drop">Go for theory</div>
              </div>
              <div className="pv-b-col">
                <h4>Your rebuttal</h4>
                <div className="pv-b-chip pv-keep">Extend the dropped turn</div>
                <div className="pv-b-chip pv-keep">Weigh magnitude → timeframe</div>
                <div className="pv-b-chip">Preempt the CP collapse</div>
              </div>
            </div>
            <p className="pv-synthetic" style={{ marginTop: '1rem', color: '#3a4a5c' }}>
              Synthetic round
            </p>
          </div>
        </section>

        <section id="card">
          <div className="pv-wrap pv-rise">
            <h2>It reads evidence the way you cut it.</h2>
            <div className="pv-b-card">
              <p className="pv-tag">Warming causes grid failure — magnitude is quantified</p>
              <p className="pv-cite">Placeholder, A. (2026). Journal of Placeholder Studies 14(2), 118–140.</p>
              <p className="pv-body">
                Increased ambient load during peak demand periods has been observed across multiple
                interconnections, and{' '}
                <mark>
                  regional operators reported a 34% rise in emergency curtailment events over the
                  study window
                </mark>
                , a figure consistent with earlier modelling. While the mechanism is contested in
                the literature,{' '}
                <mark>the direction of the effect is not seriously disputed by any of the reviewed
                sources</mark>
                , which matters for how much weight the claim can carry in a rebuttal that has
                thirty seconds for it.
              </p>
              <p className="pv-synthetic" style={{ marginTop: '1.25rem', color: '#3a4a5c' }}>
                Synthetic card — placeholder citation
              </p>
            </div>
          </div>
        </section>

        <section className="pv-b-white" id="people">
          <div className="pv-wrap pv-rise">
            <h2>People behind it.</h2>
            <div className="pv-b-people">
              {PEOPLE.map((p, i) => (
                <div className="pv-b-people-row" key={i}>
                  <div className="pv-b-avatar">PHOTO</div>
                  <div>
                    <strong>{p.name}</strong>
                    <em>{p.role}</em>
                  </div>
                  <p>{p.bio}</p>
                </div>
              ))}
            </div>
            <p className="pv-synthetic" style={{ marginTop: '1rem', color: '#3a4a5c' }}>
              Placeholder names, roles and photos
            </p>
          </div>
        </section>

        <section>
          <div className="pv-wrap pv-rise">
            <h2>Built for competitive debate.</h2>
            <div className="pv-b-claims">
              <div>
                <h3>Your corpus stays private</h3>
                <p>Ingested material informs the coaching and is never named, quoted or cited back.</p>
              </div>
              <div>
                <h3>Your account, your data</h3>
                <p>
                  Paradigms and disclosure come through your own linked Tabroom account. Unlinked,
                  the scouting tools simply stay off.
                </p>
              </div>
              <div>
                <h3>No invented cards</h3>
                <p>Cross describes the evidence to go find. It does not manufacture a cite.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="pv-b-close">
          <div className="pv-wrap-narrow">
            <h2>Postings are up.</h2>
            <p>Bring the pairing you just drew and start working the flow.</p>
            <button className="pv-btn pv-primary" type="button">
              Start coaching
            </button>
          </div>
        </section>
      </main>
    </>
  )
}
