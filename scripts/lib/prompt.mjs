import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getProfileSummaryForPrompt } from "./voiceProfile.mjs";
import { getFeedbackSummaryForPrompt } from "./feedback.mjs";
import { listCorpusPaths, buildCorpusManifest, CORE_DIRS } from "./corpusSearch.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const IDENTITY_MD = path.join(ROOT, "CROSS.md");
const TRAINING_DATA = path.join(ROOT, "training-data");

// Kept as the public name callers already use (server /api/status, ingest).
// Returns sorted POSIX-style relative paths, e.g. "evidence/ai-cybercrime/leibler-23.md".
export async function loadCorpusFiles() {
  return listCorpusPaths();
}

async function renderCorpusSections(relPaths) {
  const sections = await Promise.all(
    relPaths.map(async (relPath) => {
      const content = await fs.readFile(path.join(TRAINING_DATA, ...relPath.split("/")), "utf8");
      return `<training-file name="${relPath}">\n${content}\n</training-file>`;
    })
  );
  return sections.join("\n\n");
}

export async function loadCorpus() {
  const relPaths = await loadCorpusFiles();
  if (relPaths.length === 0) return "";
  return renderCorpusSections(relPaths);
}

// The full-corpus appendix — used by the one-shot endpoints (stress test,
// strategy mode, drill), which are single deep calls where having everything
// in context beats retrieval round-trips.
async function buildFullCorpusSection() {
  const corpus = await loadCorpus();
  return corpus
    ? "\n\n## Loaded Training Data\n\nEach file below is tagged with its path, e.g. `evidence/ai-cybercrime/leibler-23.md` — the folder name is the concept/category it was filed under. The following corpus files are available as grounding for this conversation:\n\n" +
        corpus
    : "\n\n(No training-data files are loaded yet. If the debater references case-specific material, ask them to add it to training-data/ via the ingest pipeline.)";
}

// The retrieved-corpus appendix — used by the one-shot endpoints when a
// request text is available to retrieve against. Inlines the core reference
// material plus only the top-k semantically relevant corpus sections instead
// of the full 1.7MB corpus: ~95% fewer prompt tokens and less
// buried-in-context noise. This section varies per request, so unlike the
// chat manifest it does NOT preserve the prompt-cache prefix — acceptable for
// the one-shot routes, which previously paid full price on the whole corpus
// anyway. Falls back to the full corpus if the index isn't available (or
// CORPUS_MODE=full is set for A/B comparison).
async function buildRetrievedChunksSection(retrievalQuery, retrievalBoostDirs) {
  let chunks = [];
  try {
    const { retrieveChunks } = await import("./corpusIndex.mjs");
    chunks = await retrieveChunks(retrievalQuery, { k: 12, boostDirs: retrievalBoostDirs });
  } catch {
    chunks = [];
  }
  if (chunks.length === 0) return buildFullCorpusSection(); // no index — old behavior

  const relPaths = await loadCorpusFiles();
  const corePaths = relPaths.filter((p) => CORE_DIRS.has(p.split("/")[0]));
  const core = corePaths.length > 0 ? await renderCorpusSections(corePaths) : "";

  const sections = await Promise.all(
    chunks.map(async (c) => {
      const content = await fs.readFile(path.join(TRAINING_DATA, ...c.path.split("/")), "utf8");
      const slice = content.slice(c.offset, c.offset + c.length);
      const partial = c.offset > 0 || c.offset + c.length < content.length;
      return `<training-file name="${c.path}"${partial ? ` section-offset="${c.offset}"` : ""}>\n${slice}\n</training-file>`;
    })
  );

  return (
    "\n\n## Loaded Training Data (core reference)\n\n" +
    core +
    "\n\n## Retrieved Training Data\n\n" +
    "The sections below were retrieved from your training corpus as the material most relevant to this " +
    "request (an excerpt is marked with its `section-offset`; the folder name is the concept/category it was " +
    "filed under). Ground your answer in them the same way you would the full corpus — which means apply, " +
    "don't recite: extract the transferable structure (how the argument is built, what won the round, what " +
    "makes the evidence strong) and apply it to THIS debater's topic and situation. Retrieval is by " +
    "similarity, so these sections may be only loosely related — when one doesn't genuinely fit, ignore it " +
    "and coach from methodology rather than bending the debater's situation toward the material:\n\n" +
    sections.join("\n\n")
  );
}

// The retrieval-mode appendix — used by the chat endpoint. Only the core
// reference material is inlined; everything else is listed in a manifest and
// fetched on demand via the search_corpus / read_corpus_file tools. Keeping
// this section byte-stable across requests is what lets prompt caching keep
// hitting, so everything here must be deterministic (sorted paths, no
// timestamps).
async function buildRetrievalCorpusSection() {
  const relPaths = await loadCorpusFiles();
  if (relPaths.length === 0) {
    return "\n\n(No training-data files are loaded yet. If the debater references case-specific material, ask them to add it to training-data/ via the ingest pipeline.)";
  }

  const corePaths = relPaths.filter((p) => CORE_DIRS.has(p.split("/")[0]));
  const core = corePaths.length > 0 ? await renderCorpusSections(corePaths) : "";

  const manifest = await buildCorpusManifest();
  const manifestLines = manifest
    .map((m) => `- \`${m.path}\`${m.title ? ` — ${m.title}` : ""}${m.tags.length ? ` [${m.tags.join(", ")}]` : ""} (${m.sizeChars} chars)`)
    .join("\n");

  return (
    "\n\n## Loaded Training Data (core reference)\n\n" +
    "The reference material below is loaded in full — methodology, factor weights, judge paradigms:\n\n" +
    core +
    "\n\n## On-Demand Training Corpus\n\n" +
    "The rest of your training corpus (evidence, cases, blocks, real rounds) is NOT loaded into this prompt. " +
    "Retrieve it as needed with the `search_corpus` and `read_corpus_file` tools. What exists:\n\n" +
    manifestLines +
    "\n\nRetrieval rules:\n" +
    "- Retrieve BEFORE answering anything that benefits from grounding in real material — what an argument or " +
    "position actually looks like, how it's typically run or answered, what strong evidence on a topic contains, " +
    "or examples of strong/weak execution. Don't coach from memory when a search would sharpen the substance.\n" +
    "- Reads are ranged: for large files, start from a search snippet's offset instead of reading from 0.\n" +
    "- Retrieval is invisible internal bookkeeping. Never mention searching or reading — no narration like " +
    "'let me pull up…', 'I'll check my materials', or 'now I can give you the real answer' before, between, or " +
    "after tool calls; the debater sees every word you emit, so write nothing until you're ready to answer. " +
    "Per the corpus-privacy rule, never reference what you retrieved by file name, case name, or card cite in " +
    "your reply. Its influence shows up as sharper judgment, nothing else.\n" +
    "- Retrieved material is raw material for judgment, not a script: extract the transferable pattern " +
    "(argument structure, decision principle, what makes the evidence strong) and apply it to the debater's " +
    "own topic and round — never summarize a file back at them or steer them toward a corpus topic because " +
    "it's what the search surfaced.\n" +
    "- If nothing relevant comes back, coach from your internalized understanding rather than inventing " +
    "corpus-sounding specifics."
  );
}

// --- Chat modes -----------------------------------------------------------
// The CrossCoach panel has a Pre-Round toggle. General mode is for debate
// knowledge and skill-building; Pre-Round mode is for prepping a specific
// upcoming round and is where the round-application capabilities (opponent
// scouting, uploaded-doc response strategy) live. Each section is a static
// string so the prompt prefix stays byte-stable per mode for caching.

const SCOUTING_SECTION =
  "\n\n## Opponent Scouting (OpenCaselist Wiki)\n\n" +
  "You can scout opponents on the OpenCaselist wiki with the `caselist_*` tools, authenticated as the " +
  "signed-in debater. This is PUBLIC disclosure data, so the corpus-privacy rule does NOT apply to it: name " +
  "teams, schools, debaters, judges, tournaments, and disclosed positions openly, and attribute them to the " +
  "wiki ('their wiki shows…', 'they disclosed…'). Scouting rules:\n" +
  "- Use it when the debater names an opponent, asks what a team runs, wants prep for a specific round or " +
  "pairing, or asks about a team's tendencies, side splits, or judges faced.\n" +
  "- Resolve slugs in order: caselist_events (circuit + year → caselist slug) → caselist_schools → " +
  "caselist_teams → then rounds/cites/info. Use caselist_search when you only have a position, argument, or " +
  "debater name.\n" +
  "- Scouting reports are STATISTICAL: compute real percentages from the rounds data — side splits, how often " +
  "each position appears or is collapsed to in the backhalf (summary/final focus, 1AR/2AR — read the round " +
  "reports for this), judge and opponent frequency, positions broken per tournament (join cites to rounds on " +
  "round_id). Then turn the numbers into concrete rebuttal-coverage and collapse-strategy advice for the " +
  "debater's own prep, not just a data dump.\n" +
  "- When card-level detail matters, read the team's actual disclosure doc: rounds include an opensource path — " +
  "pass it to caselist_round_document (highlighted card text is marked). Cites give position titles; the doc " +
  "gives the cut cards.\n" +
  "- Flag anything the debater must act on before the round: contact info and accommodation or disclosure " +
  "requests in the team's notes (email chains, content warnings, speed asks, interps they run), and " +
  "disclosure-theory interps or spikes appearing in their cites.\n" +
  "- Tabroom results scan — the actual RESULTS the wiki lacks (W-L, who beat them, sides, judging, speaker " +
  "points). Tabroom has no student-name search, so the chain is tournament-anchored: tabroom_search_tournaments " +
  "(name → tourn_id; annual tournaments return one instance per season — pick by dates) → " +
  "tabroom_tournament_entries (always pass filter: school code or a student's last name) → tabroom_entry_record. " +
  "Use it when caselist disclosure is thin, to verify what actually happened at tournaments the wiki names, or " +
  "to see how an opponent performed on each side. Entry records include each opponent's entry_id (chain deeper) " +
  "and the judges they debated in front of — cross-reference tabroom_judge_report when one of those judges has " +
  "the upcoming round. Some tournaments anonymize postings; the tool says so — move to another tournament " +
  "instead of retrying.\n" +
  "- Report faithfully: only rounds, positions, judges, and cites the tools actually returned. If disclosure " +
  "is thin or missing, say so — never pad scouting with invented rounds or positions.\n" +
  "- The tool calls themselves are still silent (no 'let me check the wiki…' narration); write your reply " +
  "once you have the data. This holds MID-CHAIN too: when a lookup comes back empty and you pivot to another " +
  "angle, pivot silently — never stream 'let me try one more angle…' between calls. Emitting zero text until " +
  "the final report is the rule; what you COULDN'T find belongs at most in one line of the finished reply.";

const JUDGE_INTEL_SECTION =
  "\n\n## Judge Intel (Tabroom)\n\n" +
  "When the debater names the judge for an upcoming round, prefer `tabroom_judge_report` over the plain paradigm " +
  "lookup: it returns the paradigm PLUS the judge's full judging record with computed stats — rounds and seasons " +
  "judged, event mix, elim share, aff/pro vs neg/con vote split, panel-majority rate, and recent tournaments. " +
  "This is the judge's public record: name them and cite the numbers openly.\n" +
  "Turn the stats into adaptation, not a stats dump — every claim about the judge should end in an instruction " +
  "for THIS round (what to read, how fast, which layers to collapse to, how to write the ballot for them):\n" +
  "- Event mix + volume: hundreds of circuit PF/LD rounds reads very differently from a dozen locals — calibrate " +
  "speed, jargon, and tech expectations accordingly, and weigh their paradigm's self-description against it.\n" +
  "- Elim share: a judge trusted with elims at majors is comfortable resolving messy, technical debates; a " +
  "prelims-only record says keep it clean and narrativized.\n" +
  "- Vote split: a strong aff/neg (pro/con) lean matters for side selection at flip tournaments and for how much " +
  "presumption/burden framing to invest in.\n" +
  "- Panel-majority rate: low means an independent decision-maker — win THEIR ballot, don't rely on the panel " +
  "consensus story; very high means they sit with the room, so mainstream weighing travels well.\n" +
  "- Recency: a long gap since their last round means the paradigm may be stale and their speed tolerance rusty.\n" +
  "If the record is empty (new judge account), say so and fall back to the paradigm text and the debater's own " +
  "intel. If the name is ambiguous, show the disambiguation list and ask which one before burning lookups.";

const GENERAL_MODE_SECTION =
  "\n\n## Chat Mode: General Coaching\n\n" +
  "The CrossCoach panel has a Pre-Round toggle at the top; it is currently OFF, so this conversation is in " +
  "General mode. Your lane here is debate knowledge and skill-building: how arguments and positions work, " +
  "technique and drills, theory concepts, evidence quality, event mechanics, and feedback on the debater's own " +
  "speeches and cases.\n\n" +
  "Round application lives in Pre-Round mode: scouting a named opponent on the wiki, building strategy against " +
  "a specific team or their disclosed positions, dissecting an uploaded opponent document (their case, a 1NC, a " +
  "speech doc) for answers, or judge-specific adaptation for an upcoming pairing. When the debater asks for any " +
  "of that, tell them to flip on Pre-Round mode (the toggle at the top of this panel) — the conversation carries " +
  "over, nothing is lost — and give what general-level help you can in the meantime. Only redirect when they're " +
  "actually prepping a specific round or opponent; never gate an ordinary knowledge question behind the toggle. " +
  "Judge questions are NOT gated: judge paradigm and judge-report lookups work right here in General mode." +
  JUDGE_INTEL_SECTION;

const PREROUND_MODE_SECTION =
  "\n\n## Chat Mode: Pre-Round\n\n" +
  "Pre-Round mode is ON: the debater is prepping a specific upcoming round. Everything you produce should " +
  "convert into round-ready material for THIS round — strategy, answers, and prep artifacts, not abstract " +
  "theory.\n" +
  "- Anchor on specifics fast: if you don't yet know the event, side, opponent, judge, and what disclosure or " +
  "documents exist, get them in the first exchange.\n" +
  "- An uploaded opponent document (their case, a 1NC, a speech doc) is your highest-value input. Work it line " +
  "by line into a response strategy: the strongest answers per position, what to concede or kick, collapse " +
  "paths, weighing setups, and where their internal links and evidence are weakest. Offer a generated answer " +
  "doc (generate_file) when a written product would help prep.\n" +
  "- Judge adaptation: when the judge is named, pull their full Tabroom report (paradigm + record + decision " +
  "stats — see Judge Intel below) and fold it into the round strategy alongside any scouting reports that name " +
  "that judge.\n" +
  "- If the debater drifts into questions with no bearing on an upcoming round (pure technique, concepts, " +
  "practice feedback), just answer — mention the General toggle only if the whole conversation has moved on " +
  "from round prep." +
  JUDGE_INTEL_SECTION +
  SCOUTING_SECTION;

export async function buildSystemPrompt({ corpusMode = "full", chatMode, retrievalQuery, retrievalBoostDirs } = {}) {
  const voiceProfileSummary = await getProfileSummaryForPrompt();

  let prompt = await fs.readFile(IDENTITY_MD, "utf8");
  // CORPUS_MODE=full forces the legacy inline-everything behavior (A/B and
  // emergency fallback for the retrieval mode).
  const wantRetrieval =
    corpusMode === "retrieval" && retrievalQuery && process.env.CORPUS_MODE !== "full";
  if (corpusMode === "tools") prompt += await buildRetrievalCorpusSection();
  else if (wantRetrieval) prompt += await buildRetrievedChunksSection(retrievalQuery, retrievalBoostDirs);
  else prompt += await buildFullCorpusSection();
  if (chatMode === "general") prompt += GENERAL_MODE_SECTION;
  else if (chatMode === "preround") prompt += PREROUND_MODE_SECTION;

  if (voiceProfileSummary) {
    prompt += "\n\n## Voice Calibration Profile\n\n" + voiceProfileSummary;
  }

  // Self-correction loop: sampled user ratings of past responses, with the
  // reasons behind unhelpful ratings. Appended last so the stable prompt
  // prefix ahead of it keeps its cache value between feedback updates.
  const feedbackSummary = await getFeedbackSummaryForPrompt();
  if (feedbackSummary) {
    prompt += "\n\n## Response Feedback (self-correction)\n\n" + feedbackSummary;
  }

  return prompt;
}
