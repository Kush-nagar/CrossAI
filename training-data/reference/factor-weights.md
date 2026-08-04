# Drill Factor Weights — Bayesian Ledger Reference

This table grounds win-probability estimates for practice drills and live-round
move comparison. The framework is a **transparent heuristic Bayesian ledger**:
start from a prior (default 0.5 — an even round), add a log-odds adjustment for
each factor that genuinely applies, and convert back to a probability. The full
ledger is always shown so the debater can see exactly why a number came out the
way it did.

**These percentages are structured judgment, not statistics.** There is no
trained model or real-outcome dataset behind them. They are most useful for
comparing candidate moves against each other in the same round — not for
claiming a precise real-world win rate.

**Grounding:** the weights synthesize the round-vision lecture's framework,
the judge paradigms in this corpus, and the full breadth of judge paradigms
known beyond it — the corpus paradigms are a representative sample of how
judges evaluate, not the boundary of it. When applying a weight, reason from
how the whole judging population would treat the behavior; use the corpus
paradigms for depth, deviations, and direct quotes.

**Calibration:** when a debater reports a real outcome ("we ran this and won,"
"the judge hated the turn"), update the relevant weight here — this file is the
closest thing to calibration available, and it compounds usefully over time.
Observed-round analysis counts too: several factors below are grounded in the
coach's TOC 2026 R1 round analysis (see the TOC 2026 R1 feedback lessons
reference for the full reasoning behind them), several in actual judge
RFDs from observed elimination rounds (see the elim-round RFD lessons
reference), and several in the 41 circuit-round RFDs of the Emerald AG
dataset (see the Emerald AG RFD lessons reference) — the RFD-grounded rows
are the closest thing here to direct evidence of how judges actually decide,
and the Emerald rows recur across many independent judges rather than one.

## How to apply weights

- Only add a factor's adjustment when it is **genuinely true in this round** —
  never run down the list applying everything.
- Most factors are **degrees, not binary**. Interpolate between the listed
  midpoints rather than rounding to the nearest pole. When the specific
  evidence is stronger or weaker than the table's default case, scale the
  weight up or down — and say so when deviating, with the reason.
- If a judgment call is genuinely ambiguous from the round description (was
  that a real rebuttal or a one-line assertion?), or depends on the debater's
  own comfort with a tactic (theory, speed, kritiks), **ask instead of
  silently guessing** — a wrong guess quietly poisons every downstream number.

## Clash & flow factors

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Collapsing to an argument the opponent fully dropped last speech | +1.4 | Answered with only a one-line assertion: +0.9 · Answered weakly but responsively: +0.5 |
| Extending a live turn the opponent hasn't answered | +1.2 | Turn partially answered: +0.6 · Turn answered but poorly warranted: +0.3 |
| Filling an open weighing gap first (magnitude/probability/timeframe) | +1.0 | Weighing present but shallow ("we outweigh" with no mechanism): +0.4 |
| Collapsing to one clean voter instead of going for everything | +0.8 | Collapsing to two arguments: +0.4 · Spreading effort across the whole flow: −0.6 |
| Going for an argument the opponent has answered well and extended | −0.9 | Their answer is present but unwarranted: −0.4 |
| Dropping your own previously-winning argument | −1.0 | Under-extending it (tag only, no warrant or impact): −0.5 |
| Introducing brand-new arguments in a speech where judges discount them (Summary/2NR onward, format-dependent) | −1.1 | New weighing (usually allowed) framed as new offense: −0.3 |
| Unwarranted assertion doing load-bearing work ("that's true because X" with no X) | −0.7 per major instance | Warrant gestured at but not explained: −0.3 |
| Weighs a property that belongs to the link chain, not the collapsed impact (e.g. fiat-immediacy claimed as impact timeframe) | −0.6 | Property partially transfers to the impact: −0.3 |
| Even-if reframe that resolves a live evidence-credibility dispute ("even if our link is analytic, it's warranted and undefended, so the concession makes it true") | +0.5 | Reframe made but the warrant behind the analytic never explained: +0.2 |
| Collapses to an argument whose central evidence-credibility dispute was left unresolved (pivoted to a different consideration instead of answering it) | −0.6 | Dispute partially resolved (credibility contested but never closed): −0.3 |
| Makes a meta evidence comparison on the round's central clash ("our ev cites experts holistically and is inclusive of theirs") that the opponent never answers before finals | +0.7 | Comparison made but answered in time (source parity, dates): +0.2 |
| Leaves an opponent's clash-breaking evidence comparison unanswered until final focus or later (judges treat it as conceded and resolve the whole clash on it) | −0.8 | Answered in summary but shallowly: −0.3 |
| Summary answers a collapsed argument only with "we explained this on case" — cross-application never re-executed on the flow being decided | −0.6 | Cross-app named and partially restated where it matters: −0.2 |
| Leaves the opponent's top-shelf filter/overview (e.g. "only sudden shocks trigger the impact") conceded through the back half, letting it become the judge's lens | −0.8 | Contested for the first time in finals: −0.4 |
| Collapses in finals to a turn whose uniqueness/ev-preference setup was never done in summary ("hidden" turns get no judge charity) | −0.7 | Setup gestured at in summary but incomplete: −0.3 |
| Warrants timeframe through the entire link chain (trigger AND escalation), not just the first link | +0.6 | Claims immediacy from the first link only, chain speed unwarranted: −0.5 |
| Competing weighing claims that never interact — both sides repeat their own mechanism, neither compares — judge washes the issue and decides elsewhere | −0.5 | Comparison finally made in the last speech: −0.2 |
| Extends a try-or-die / risk framing the opponent never answers through the back half | +0.8 | Introduced new in finals with thin articulation (judges give it zero): 0 |
| Wins the comparative link into a framing both teams have agreed controls (fairness first, probability, an agreed terminal impact) — the round becomes a link race | +0.7 | Links in but never compares links ("we access fairness too"): +0.2 |
| Reads stacked non-unique defense the opponent can concede to kick out of your turns on the same flow | −0.4 | One non-unique alongside offense-relevant responses: −0.1 |

## Evidence-integrity factors

Grounded in the Emerald AG RFD lessons: this judge pool reads cards — in
elims, sometimes the full article — and treats card text as the ceiling on an
argument. Apply these whenever a drill or round description reveals what the
evidence actually says.

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Collapses to an argument whose central card doesn't say what the tag claims (miscut/mis-contextualized) — judges verify and zero the impact | −0.9 | Card supports the direction but not the specific claim: −0.4 |
| Executes an evidence indict on the opponent's central card with the actual text quoted/recut | +0.7 | Indict asserted but never quoted or fleshed out (judges won't do the work): 0 |
| On an otherwise-even dispute, holds the carded position against an opponent's analytic (judges break ties toward cards) | +0.4 | Both carded or both analytic: 0 |

## Judge-adaptation factors

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Strategy matches the judge's stated paradigm (e.g. collapsing + weighing in front of a flow judge who rewards it) | +0.8 | Neutral fit: 0 |
| Jargon-heavy or speed-dependent strategy in front of a lay/parent judge | −1.1 | Moderate technicality, signposted plainly: −0.4 |
| Violating a stated pet peeve (e.g. reading theory in front of a judge who won't vote on it) | −1.3 | Judge merely "dislikes" rather than refuses: −0.6 |
| Leveraging a judge quirk directly (e.g. explicit ballot-directing language for a judge who asks for it) | +0.6 | — |

## Judge-consensus factors (cross-judge back-half evaluation)

Derived from the cross-judge consensus reference: how tech/flow judges
actually evaluate the back half. When a speech's organization or warranting
is hard to identify, that feedback is mandatory — under consensus judging an
unflowable line was never said, and an unwarranted claim is not an argument.

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Collapsed offense extended completely (link + internal link + impact) through every back-half speech | +0.6 | Extended in both speeches but tag-only in one: +0.2 |
| Offense that skips a back-half speech (in final focus but not summary, or equivalent) | −1.0 | Present in both but visibly thinner in one: −0.4 |
| Relies on defense as "sticky" — answered defense never re-extended | −0.6 | Re-extended but only by reference ("extend our defense"): −0.3 |
| Extensions and responses are explicitly warranted (the why, not just the claim + cite) | +0.5 | Warrant gestured at via author name only: −0.3 |
| Warranting or organization hard to identify — judge couldn't reconstruct what answers what | −0.8 | Identifiable with effort (buried warrants, loose signposting): −0.4 |
| Comparative weighing that engages the opponent's weighing (meta-weighing when impacts are unlike) | +0.7 | Weighs only own impact, ignores theirs: −0.4 |
| Turn extended with link and impact implicated | +0.5 | Turn dumped/extended without implication: −0.5 |
| "Docbot" responses — blocks read without implicating against the opponent's specific warrants | −0.5 | Some implication but generic: −0.2 |
| Overinvests in consensus-disliked material (IVIs, frivolous theory, underdeveloped K) expecting the ballot | −0.6 | Reads it cheaply as a time-suck without relying on it: 0 |
| Builds the theory strategy around drop-the-debater when drop-the-argument solves the articulated abuse (judges default to DTA) | −0.6 | DTD backed by a specific unanswered warrant why DTA can't rectify the skew: +0.3 |
| Answers a load-bearing factual claim only with a prefiat objection (ableist/exclusionary), leaving it postfiat-conceded while own offense depends on it being false | −0.7 | Prefiat push paired with a thin but real postfiat answer: −0.3 |
| Impact-framework push rests on a generic ethical appeal (racism/sexism analogy) without contesting the opponent's criterion (agency, consciousness) | −0.6 | Analogy plus direct contestation of the criterion: +0.3 |
| New implication or penalty framing for a dropped argument introduced only in final focus (judges discount it as "too new" even on conceded material) | −0.6 | Introduced in the last summary instead: −0.2 |
| Frontlines own collapsed offense line-by-line against each specific response | +0.5 | LBL on most responses but skips one live answer: +0.2 |
| Frontlines own offense via buzzwords or truth-level hand-waving, leaving specific responses unanswered | −0.6 | Answers most responses but hand-waves the "silly" ones: −0.3 |
| Invests the back half in a layer whose subordination was conceded (theory-first / ROTB / prior-question ordering left unanswered) — judges start and often end at the winning layer | −0.8 | Ordering contested, but late and thinly: −0.4 |
| Frontlines a procedural (T/theory) using the very position the procedural indicts — judges treat it as circular and score it a non-answer | −0.6 | — |
| Advances a CI or we-meet contradicted by the team's own conduct or another of its arguments (own wiki violates the interp, partner's framing forbids the we-meet) | −0.7 | Contradiction exists but the opponent never exposes it: −0.2 |
| Performative contradiction — in-round conduct does what the team's own framework/K indicts (reads data against a quantification K, decries extinction calculus after leading with it; kicking the material late doesn't clean it) | −0.7 | Exists but unexploited by the opponent: −0.2 |

## Round-vision factors

Round vision means playing the round forward, not just reacting to the flow —
foreseeing how the round unfolds and choosing moves the way a chess player
calculates ahead. Score these in every evaluation — they are not an
afterthought. The full framework (path of least resistance, time trades,
door-closing, collapse criteria, salvage protocol) is in the round-vision
framework reference; these rows are its scored form.

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Speech preempts the opponent's single most likely next move (from their profile, tendencies, or — strongest signal — their time allocation last speech) | +0.9 | Partially preempts it (answers the link but not the impact framing): +0.4 |
| Speech walks into the predicted next move with no coverage | −0.8 | Coverage exists but is buried/unextendable: −0.4 |
| Takes the path of least resistance — collapses to the cheapest sufficient offense (dropped/least-inked with clean weighing) instead of a contested flow | +0.9 | Picks a moderately-contested flow when a cleaner one existed: −0.4 |
| Positive time trade — one move (weighing filter, grouped answer, strategic concession) neutralizes several of the opponent's arguments at once | +0.7 | Groups adequately but still line-by-lines what could be filtered: +0.2 |
| Brute-forces line-by-line against everything, spreading thin across the whole flow | −0.7 | Covers everything but with visible prioritization: −0.3 |
| Collapses decisively to one or two priority arguments | +0.6 | Muddled half-collapse — extends a "main" argument while still half-going for others: −0.5 |
| Closes the door — extends offense/defense that blocks the opponent's ballot path even if they win their primary argument | +0.8 | Gestures at it ("even if they win X…") without extending the blocking material: +0.3 |
| First back-half speech leaves the final speech safety nets (multiple weighing mechanisms, defense across different parts of their argument) | +0.6 | Hands the final speech exactly one frontline/one weighing mech to live on: −0.4 |
| Final speech mirrors and crystallizes the summary — delivers the judge's reason for decision in ballot-ready language | +0.6 | Extends the summary's material but never frames it as the decision: +0.2 |
| Final speech abandons the summary's investment for a new strategy (outside a genuine salvage) | −0.9 | Justified salvage — behind on the flow, collapses to one voter and wins the weighing overwhelmingly: +0.5 |
| Concedes or under-invests in a live weighing debate while ahead on defense only | −0.8 | Weighs but shallowly against developed opposing weighing: −0.4 |
| Defends own weighing with a single metaweighing filter while conceding the opponent's individual weighing claims (worst without the last speech) | −0.7 | Contests some individual claims, even blippily: −0.3 |
| Rebuttal coverage skewed by flow order — front arguments overcovered while a live squirrelly/high-threat argument goes undercovered | −0.7 | Slightly uneven but every argument gets a real answer: −0.3 |
| Extends a conceded response that advances no win condition (contests neither the link nor the weighing of the argument it answers) | −0.5 | Marginal relevance to a win condition: −0.2 |
| Goes for a response with no articulable ballot implication — includes "turns" that are actually defense (e.g. "their framework collapses to ours") | −0.5 | Implication exists but is never stated in the speech: −0.3 |
| Goes for presumption while the opponent still has cleanly extended offense (judges look to extended offense first; presumption is where they land, not where you aim) | −0.8 | Genuine no-offense round with terminal defense done and a warranted presumption direction: +0.4 |
| **Final speeches only:** preempts the judge's most likely point of confusion or the other side's closing objection | +0.8 | Acknowledges it without resolving it: +0.3 |
| **Progressive rounds:** wins or reframes the highest layer of the debate and uses it to filter lower layers | +0.8 | Engages the highest layer head-on when a cheaper cross-layer path existed (e.g. conceding framework for link turns): +0.3 |

## Cross-examination factors

When the drill or round description includes cross, score how it was spent.
Grounded in the TOC 2026 R1 feedback lessons: cross is a resource for making
back-half responses land, and gotcha value is ethos-only in a technical debate.

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Uses cross for clarification questions when behind on baseline knowledge of a technical position | +0.4 | Asks some clarification but spends most of cross elsewhere: +0.2 |
| Spends cross hunting gotcha technicalities in a debate they lack baseline knowledge of | −0.4 | A gotcha actually lands and gets leveraged into a flowed argument: 0 |

## Delivery & structure factors (transcript-based)

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Clear signposting throughout (flow-level and argument-level) | +0.4 | Partial ("first/next" but no flow naming): +0.2 |
| A listener would lose track of what's being answered | −0.6 | Occasionally unclear: −0.3 |
| Significant word-economy bloat (sections that repeat without adding) | −0.4 | One bloated section: −0.2 |
| Pace above ~200 WPM in front of a judge who can't flow it | −0.8 | Fast but signposted enough to follow: −0.3 |
| Condescending or rude in crossfire — judges note it, and it colors close calls, especially with lay panelists on elim panels | −0.3 | — |

## Execution-risk factors

| Factor | Full weight | Scaled midpoints |
|---|---|---|
| Move requires a tactic the debater executes well under pressure (confirmed, not assumed) | +0.5 | Unknown comfort — ask before applying either direction |
| Move requires a tactic the debater is uncomfortable running live (theory, speed, kritiks) | −0.9 | Some reps but inconsistent: −0.4 |
| Move is resilient — still viable if its central claim gets contested | +0.4 | — |
| Move is all-in — loses the round outright if its one claim falls | −0.5 | — |
