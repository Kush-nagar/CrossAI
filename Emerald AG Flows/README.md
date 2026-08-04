# Emerald AG — Public Forum Debate Training Dataset

Flows and judge RFDs from 43 national-circuit Public Forum rounds (2025–2026 seasons) across 10 tournaments: Berkeley, Blake, Bronx, Emory, Milpitas, Stanford, Sunvite, TOC, UKSO, and Yale.

**Important context for the agent:** circuit PF is increasingly technical, so LD and Policy jargon is ubiquitous in these flows and RFDs. This is normal and intentional — do not treat kritiks, theory shells, or counter-interpretations as out of place in PF.

## Files

- `emerald_ag_pf_dataset.jsonl` — the training dataset, one JSON record per round (43 records).
- `<Round Name>.xlsx` — original flow spreadsheets (45, unmodified).
- `<Round Name> RFD.docx` — the judge's RFD per round with a context header (43).

Two rounds are in the xlsx set but **excluded from the dataset and docx set** because they have no usable RFD: `Blake R2 2025` (no RFD tab) and `UKSO R1 2025` (RFD tab empty).

## JSONL record schema

| Field | Meaning |
|---|---|
| `id` | slug, e.g. `sunvite-finals-2026` |
| `round_name`, `tournament`, `round`, `year` | round metadata parsed from the filename |
| `event` | always "Public Forum (technical/circuit style)" |
| `context` | standing context paragraph (jargon glossary, formatting conventions) — suitable for a system prompt |
| `flow_tabs` | list of sheet names flowed for this round (e.g. AFF, NEG, Weighing, or per-position tabs like "Cap K", "T CI") |
| `flows` | per-tab structured data: `columns` (speech/column labels), `has_speech_headers`, `lines` |
| `flow_text` | the whole flow rendered as one plain-text block — ready to paste into a prompt |
| `rfd` | the judge's Reason For Decision, verbatim |
| `source_file` | originating xlsx |

## Reading the flows

- Each flow line is one argument thread. `[label] text >> [label] text` means the later speech (right) is responding to the earlier one (left) on that line of the flow.
- Speech labels follow speaker-number + side + speech-type convention: **A**/**N** = Aff (Pro) / Neg (Con); **C** = constructive/rebuttal-stage speech, **S** = summary, **FF** = final focus (e.g. `1AC`, `2NC`, `1NS`, `2AFF`). Tabs without explicit headers use positional labels `col1`, `col2`, … in chronological speech order, left to right.
- Text is live-flowing shorthand: typos, fragments, and ALL-CAPS emphasis are original and preserved deliberately.

## Jargon quick reference

K = kritik · T = topicality/theory · interp = interpretation · CI = counter-interpretation · alt = alternative · non-rez = non-resolutional · OS = an off-case/kritik position · drop = concede by silence · extend = carry an argument forward · frontline = answers to rebuttal · weighing = comparative impact analysis · RVI = reverse voting issue · ROTB = role of the ballot · fiat = assumed implementation · RFD = reason for decision.

## Suggested use with the Claude API

The dataset supports several agent behaviors: put `context` in the system prompt; use `flow_text` → `rfd` pairs as few-shot examples for judge-style decision writing; retrieve similar rounds (by tournament, position types in `flow_tabs`, or content) for grounding preround strategy advice and speech feedback. RFDs reflect real judge preferences — how this judging pool evaluates theory vs. substance, weighing, extensions, and cross-application — which is the signal to learn for forward-looking feedback.
