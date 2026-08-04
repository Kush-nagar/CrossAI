# delivery-data/

Coach-curated material for the drill grader's **delivery** scoring (loaded by
`scripts/lib/delivery.mjs` on every grading request — no restart needed).

- `rubrics/` — scoring rubrics the grader must apply (override its defaults).
- `reference/` — benchmarks, exemplar descriptions, judge-preference notes.

Drop `.md`, `.txt`, or `.json` files in either folder; they are injected
verbatim into the grading prompt as authoritative scoring material. Contents
are gitignored (personal coaching material) — only this README is tracked.
