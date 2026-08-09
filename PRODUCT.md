# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Competitive debaters in high school and college, across Policy (CX/CEDA/NDT),
Lincoln-Douglas, Public Forum, and Parliamentary. Jargon load, argument
structure, and judge-adaptation norms differ sharply by format, so the product
detects or asks the format rather than assuming one.

Today the signed-in population is one person: the builder, using Cross for
their own prep. The product is being built for eventual public release to
debaters the builder does not know — design decisions should serve the public
case, but nothing currently depends on strangers being onboarded.

Coaches are not a confirmed audience. Nothing in the product is built for a
coach's view of a squad, and no coach-facing surface has been decided.

**Open:** when open signup happens, and whether a squad/team tier ever exists.

## Product Purpose

Cross is an AI debate coach that sharpens a debater's own judgment instead of
handing them a script. It gives round feedback (flow-based critique, delivery
notes, what won or lost the round), plans strategy (cases, blocks, prep-time
allocation, anticipated opponent positions), and supports in-round and
out-of-round decisions by presenting options with tradeoffs rather than a
single dictated answer.

Success is a debater who makes better calls without Cross in the room.

## Positioning

Four claims a general-purpose chatbot cannot truthfully make. All four are
committed, not aspirational — each is implemented.

1. **Grounded in real round material.** Coaching is informed by an ingested
   corpus of real cases, briefs, blocks, and tournament rounds, retrieved
   silently per question. The corpus is never surfaced: no file names, no case
   names, no card cites. Its influence shows up as sharper judgment, nothing
   else.
2. **Live round intel.** With the debater's own linked Tabroom account, Cross
   pulls the actual judge's paradigm and the opponent's disclosed positions
   from OpenCaselist for the specific round being prepped. This data is public
   disclosure — teams, judges, and positions are named openly, unlike corpus
   material.
3. **Transparent Bayesian ledger.** Drill grading and win-probability estimates
   show the full factor ledger — prior, every log-odds adjustment, and why.
   Percentages are structured judgment for comparing candidate moves, not a
   claimed real-world win rate, and the product says so when a debater treats a
   number as more certain than it is.
4. **Speech and delivery analysis.** A recorded speech is transcribed, measured
   for pace, read for vocal tone where the engine supports it, and graded —
   with tone localized per utterance and tracked across takes.

## Operating Context

Primary scenes, confirmed:

- **Desk prep.** Long laptop sessions with files open, writing cases and
  blocks. Density, multi-panel layouts, and sustained reading are appropriate.
- **Scheduled drilling.** Deliberate practice — drill scenario, write or speak
  the next speech, get graded, track improvement over takes.

Not a primary scene: hurried phone use in a tournament hallway. The app is
responsive and has a mobile tab bar, but mobile is not the situation being
designed for, and one-handed pre-round urgency should not drive layout.

Post-round debrief is a supported capability (flow critique, what to fix by the
next round) but was not named as a primary usage scene.

Real materials that are factual parts of the workflow: uploaded case documents
(PDF/DOCX/TXT/MD/HTML), audio of the debater's own speeches, OpenCaselist
disclosure pages, and Tabroom judge paradigms.

## Capabilities and Constraints

Surfaces that exist: Home, Prep, Drill, Judges, Coach (chat, with a General /
Pre-Round mode toggle), Tournament, Settings.

Confirmed functionality:

- Coaching chat with silent corpus retrieval; Pre-Round mode adds opponent
  scouting tools.
- Judge paradigm lookup and structured summary, cached.
- Practice drills: generated scenario, submitted speech (typed or spoken),
  graded against a precomputed answer key.
- Speech transcription with pace measurement, and delivery grading with tone
  when the transcription tier provides it.
- Case upload and analysis; stress-testing a case; strategy mode.
- Generation of downloadable deliverables (PDF, DOCX, XLSX, MD, TXT).
- Cross account sign-in (Google or emailed link). Linking a Tabroom account is
  optional; every scouting feature must degrade gracefully when it is absent.

Constraints:

- **Corpus privacy is a hard rule.** Retrieval is invisible. The product never
  narrates that it searched and never names a retrieved file, case, or cite.
- **No fabricated evidence.** When a debater needs a card, Cross describes the
  card to go find or cut — never an invented cite.
- **Voice calibration recordings are format-only, never content.** The
  calibration script reads like debate material but is never treated as an
  argument or graded as one.
- **Cross does not create Tabroom accounts.** NSDA terms prohibit automated
  access and impersonation.
- The debater never sees their own speech transcript — only the coach does — so
  the product must flag a garbled or implausible transcript rather than working
  from it silently.
- Deployment is a single process on a single port with ephemeral disk; uploads
  and generated files do not survive a redeploy.

## Brand Commitments

- **Name:** Cross. Logo at `crossailogo.png` (source) / `web/public/cross-logo.png`.
- **Voice:** a coach, not a crutch. Direct, specific, technical where the
  format is technical. Names what is wrong and what would fix it. Compliments
  real fixes explicitly when a debater comes back with a revision. Never
  flatters, never lectures, never hedges into uselessness.
- **Register follows the format.** Policy and circuit LD carry full jargon;
  PF stays in plain-language weighing. The product adapts rather than
  broadcasting one voice.
- **Existing visual system:** `design-system/cross/MASTER.md` documents the
  shipped look and is the incumbent authority. The persona spec at `CROSS.md`
  is authoritative for coaching behavior.

## Evidence on Hand

- `training-data/` — the real debate corpus (~1.8 MB of ingested cases, blocks,
  briefs, rounds, reference methodology). Private, never quotable, never
  citable in output.
- `delivery-history.json` — real per-take delivery snapshots (pace, tone,
  score) for every graded spoken drill. Honest source for any progress or
  streak feature; no new persistence needed for one.
- `CROSS.md` — the persona and scoring-framework spec.
- `docs/AUTH.md`, `DEPLOY.md`, `README.md` — real operational documentation.

Absences that must never be invented: there are no users besides the builder,
no testimonials, no case studies, no press, no benchmarks, no pricing, and no
published accuracy or win-rate claims. Any surface that would want social proof
does not have any yet.

## Product Principles

1. **Coach, don't script.** Every output should transfer judgment to the
   debater. A recommendation always carries its reasoning.
2. **Show the ledger.** Numbers and grades are legible or they are not shipped.
   Structured judgment, honestly labeled, beats a confident verdict.
3. **The corpus is invisible; the public data is not.** Retrieved training
   material is never named. Disclosed wiki and paradigm data is attributed
   openly. This line is never blurred.
4. **Never invent debate facts.** No fabricated cards, cites, judges, or
   opponents. Describe what to find instead.
5. **Degrade, don't fail.** An unlinked Tabroom account, a missing tone engine,
   or an empty corpus reduces what Cross can do without breaking what it can.

## Accessibility & Inclusion

Settings already expose real, applied preferences — light/dark/system theme,
reduced motion, and increased contrast — each toggling actual CSS on `<html>`
rather than acting as a cosmetic switch. Future work must keep them functional,
not decorative.

No externally required standard has been established. Long-session desk reading
is the dominant use, so legibility at length, and not compactness, is the
governing accessibility concern.
