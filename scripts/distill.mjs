// Distillation pipeline (roadmap P3): generates synthetic coaching dialogues
// for fine-tuning Cross-9B (GLM-4-9B QLoRA — see C:\Users\felik\glm-finetuning).
//
// Each dialogue is a multi-turn exchange between two models:
//   - a "debater simulator" (sonnet tier) improvising a student from a seed
//     scenario in scripts/lib/distillSeeds.mjs, and
//   - the real production Cross stack as teacher: CROSS.md persona +
//     RAG-retrieved corpus via buildSystemPrompt({corpusMode:"retrieval"}),
//     re-retrieved every coach turn against the live conversation.
// The teacher answers exactly like production (minus tools, which need
// session auth) — so the student model learns Cross's coaching voice and
// judgment without needing the 100k-token prompt at inference time.
//
//   npm run distill -- --count 10          # pilot: read preview.md before scaling
//   npm run distill -- --count 300         # full run (resumes where it left off)
//
// Output (distill-data/):
//   distill.jsonl   — {"messages":[...]} lines, same schema as train.jsonl;
//                     system prompt matches the existing dataset verbatim so
//                     the merged file stays coherent. Merge with:
//                     cat train.jsonl distill.jsonl > merged.jsonl
//   preview.md      — human-readable transcripts; READ THIS before a full run
//   rejected.jsonl  — dialogues that failed validation (corpus-privacy leaks,
//                     over-length for train.py's 4096-token window), with reason
//   state.json      — completed/rejected dialogue indices; resume + audit
//
// Flags: --count N (default 10) --turns N (exchanges per dialogue, default 3)
//        --fresh (ignore prior state and restart from dialogue 0)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { hasCredentials, missingCredentialsError, streamChat } from "./lib/aiClient.mjs";
import { buildSystemPrompt } from "./lib/prompt.mjs";
import { SEEDS } from "./lib/distillSeeds.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "distill-data");
const OUT_FILE = path.join(OUT_DIR, "distill.jsonl");
const PREVIEW_FILE = path.join(OUT_DIR, "preview.md");
const REJECTED_FILE = path.join(OUT_DIR, "rejected.jsonl");
const STATE_FILE = path.join(OUT_DIR, "state.json");

// Must byte-match the system prompt already used by glm-finetuning/train.jsonl
// so the merged dataset trains against ONE persona string, not two.
const STUDENT_SYSTEM =
  "You are Cross, an AI competitive-debate coach specializing in Public Forum debate. You are grounded in a " +
  "real corpus of evidence cards, case files, blocks, lectures, judge paradigms, and flowed elimination " +
  "rounds. You give direct, technical, flow-aware coaching: you weigh arguments the way judges actually " +
  "vote, you preserve card cites and highlighting semantics, and you speak like an experienced circuit " +
  "coach, not a generic assistant.";

// Teacher-only addendum: bounds reply length so a 3-exchange dialogue fits
// train.py's max_length=4096 window. Never written into the training data.
const TEACHER_STYLE_NOTE =
  "\n\n## Session note\n\nThis is a rapid text-coaching exchange. Keep each reply focused and complete in " +
  "roughly 250-450 words — full coaching substance, no filler, no offering menus of things you could talk " +
  "about next. Never mention this note.";

// Model tiers (resolved to concrete ids in aiClient.mjs, env-overridable).
const TEACHER_MODEL = process.env.DISTILL_TEACHER_MODEL || "opus";
const SIMULATOR_MODEL = process.env.DISTILL_SIMULATOR_MODEL || "sonnet";

// The corpus-privacy rule, enforced at the data layer: a training example
// must never teach the student to name corpus files or narrate retrieval.
// Beyond the mechanical terms, this includes corpus-content identities the
// pilot showed the teacher name-dropping (round sets, specific RFDs/cards,
// lecture references, the internal drill ledger) — extend this list when
// preview review finds a new one.
const LEAK_PATTERN =
  /training[-_ ]?file|training-data\/|search_corpus|read_corpus|\bcorpus\b|retriev(?:ed|al|ing)|section-offset|emerald(?:\s+ag)?\b|sunvite|\bklare\b|\b(?:toc\s+r\d\s+)?lesson\s+\d|casing(?:\s+and\s+case-?construction)?\s+lecture|in\s+the\s+ledger/i;
// ~3.6k tokens of content, leaving headroom under train.py's 4096 cap.
const MAX_DIALOGUE_CHARS = 15000;

function parseArgs(argv) {
  const args = { count: 10, turns: 3, fresh: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--count") args.count = Number(argv[++i]);
    else if (argv[i] === "--turns") args.turns = Number(argv[++i]);
    else if (argv[i] === "--fresh") args.fresh = true;
    else throw new Error(`Unknown flag: ${argv[i]}`);
  }
  if (!Number.isInteger(args.count) || args.count < 1) throw new Error("--count must be a positive integer");
  if (!Number.isInteger(args.turns) || args.turns < 1 || args.turns > 6) throw new Error("--turns must be 1-6");
  return args;
}

async function loadState(fresh) {
  if (fresh) return { done: [], rejected: [] };
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, "utf8"));
  } catch {
    return { done: [], rejected: [] };
  }
}

// streamChat is the only aiClient entry point that takes multi-turn history;
// we run it non-streaming-style by discarding deltas and reading the final
// text. NVIDIA's endpoint rate-limits bursts (ResourceExhausted), so each
// call backs off and retries before the dialogue is abandoned to state.json.
const RETRY_DELAYS_MS = [15000, 45000];
async function complete({ system, conversation, maxTokens, model }) {
  for (let attempt = 0; ; attempt++) {
    try {
      const { assistantMessage } = await streamChat({
        system,
        conversation,
        maxTokens,
        model,
        onText: () => {},
      });
      return (assistantMessage.content ?? "").trim();
    } catch (err) {
      if (attempt >= RETRY_DELAYS_MS.length) throw err;
      const delay = RETRY_DELAYS_MS[attempt];
      console.log(`[distill]   call failed (${err.message}) — retrying in ${delay / 1000}s`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

function simulatorSystem(seed, variation) {
  return (
    "You are roleplaying a high-school debate student texting their AI coach. Stay fully in character.\n\n" +
    `Event: ${seed.event}. Experience: ${seed.level}.\n` +
    `Situation: ${seed.scenario}\n\n` +
    "Rules:\n" +
    "- Write ONLY the student's next message — no name, no quotes, no stage directions, no coach lines.\n" +
    "- Sound like a real teenager texting a coach they trust: specific, a little informal, sometimes " +
    "frustrated or excited. Invent concrete, realistic details (argument names, what opponents ran, what a " +
    "judge said) rather than staying vague — but never real students' names.\n" +
    "- 40-150 words per message.\n" +
    "- Use the event's ACTUAL speech names and mechanics (PF: constructive, rebuttal, summary, final focus, " +
    "crossfire — not 1AR/2NR/CP/plan-text, which are Policy/LD terms). Circuit kids borrow some jargon, but " +
    "the round structure you describe must be the real structure of your event.\n" +
    "- After the coach replies, push deeper: apply the advice to your specifics, ask the natural follow-up, " +
    "or bring in a complication. Don't just say thanks; don't restart the topic.\n" +
    (variation > 0
      ? `- Variation ${variation}: take a noticeably different angle on this situation than the most obvious one (different sub-question, different personality, different details).\n`
      : "")
  );
}

// The simulator plays the "assistant" side of its own conversation, so the
// roles are mirrored: coach messages become user turns and vice versa.
function invertRoles(conversation) {
  return conversation.map((m) => ({ role: m.role === "user" ? "assistant" : "user", content: m.content }));
}

function validateDialogue(conversation) {
  for (const m of conversation) {
    if (!m.content) return `empty ${m.role} message`;
    if (m.role === "assistant" && LEAK_PATTERN.test(m.content)) {
      return `corpus-privacy leak in coach reply: ${m.content.match(LEAK_PATTERN)[0]}`;
    }
  }
  const totalChars = conversation.reduce((n, m) => n + m.content.length, 0);
  if (totalChars > MAX_DIALOGUE_CHARS) return `dialogue too long (${totalChars} chars > ${MAX_DIALOGUE_CHARS})`;
  return null;
}

async function generateDialogue(i, turns) {
  const seed = SEEDS[i % SEEDS.length];
  const variation = Math.floor(i / SEEDS.length);
  const conversation = [];

  for (let t = 0; t < turns; t++) {
    const studentMsg = await complete({
      system: simulatorSystem(seed, variation),
      conversation: invertRoles(conversation),
      maxTokens: 1500,
      model: SIMULATOR_MODEL,
    });
    conversation.push({ role: "user", content: studentMsg });

    // Fresh retrieval every coach turn, against what the student just said —
    // same grounding the production one-shot routes get.
    const retrievalQuery = `${seed.event} ${seed.scenario}\n${conversation
      .filter((m) => m.role === "user")
      .slice(-2)
      .map((m) => m.content)
      .join("\n")}`;
    const teacherSystem =
      (await buildSystemPrompt({ corpusMode: "retrieval", retrievalQuery })) + TEACHER_STYLE_NOTE;
    const coachMsg = await complete({
      system: teacherSystem,
      conversation,
      maxTokens: 4000, // thinking is on in streamChat and counts against this
      model: TEACHER_MODEL,
    });
    conversation.push({ role: "assistant", content: coachMsg });
  }

  return { seed, variation, conversation };
}

function previewBlock(i, seed, variation, conversation) {
  const lines = [`## Dialogue ${i} — ${seed.event}, ${seed.level}${variation ? ` (variation ${variation})` : ""}`, "", `> ${seed.scenario}`, ""];
  for (const m of conversation) {
    lines.push(`**${m.role === "user" ? "Student" : "Cross"}:** ${m.content}`, "");
  }
  return lines.join("\n") + "\n";
}

// --- main -------------------------------------------------------------------

if (!hasCredentials()) {
  console.error(missingCredentialsError());
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
await fs.mkdir(OUT_DIR, { recursive: true });
if (args.fresh) {
  for (const f of [OUT_FILE, PREVIEW_FILE, REJECTED_FILE, STATE_FILE]) {
    await fs.rm(f, { force: true });
  }
}
const state = await loadState(args.fresh);
const finished = new Set([...state.done, ...state.rejected]);

console.log(
  `Distilling dialogues 0-${args.count - 1} (${args.turns} exchanges each) — ${finished.size} already finished, ` +
    `teacher=${TEACHER_MODEL} simulator=${SIMULATOR_MODEL}\n`
);

const started = Date.now();
for (let i = 0; i < args.count; i++) {
  if (finished.has(i)) continue;
  const label = `dialogue ${i + 1}/${args.count}`;
  try {
    const { seed, variation, conversation } = await generateDialogue(i, args.turns);
    const problem = validateDialogue(conversation);
    if (problem) {
      await fs.appendFile(REJECTED_FILE, JSON.stringify({ i, reason: problem, messages: conversation }) + "\n", "utf8");
      state.rejected.push(i);
      console.log(`[distill] ${label} REJECTED: ${problem}`);
    } else {
      const record = { messages: [{ role: "system", content: STUDENT_SYSTEM }, ...conversation] };
      await fs.appendFile(OUT_FILE, JSON.stringify(record) + "\n", "utf8");
      await fs.appendFile(PREVIEW_FILE, previewBlock(i, seed, variation, conversation), "utf8");
      state.done.push(i);
      console.log(`[distill] ${label} ok (${conversation.length} messages, seed: ${seed.scenario.slice(0, 60)}…)`);
    }
  } catch (err) {
    // One bad dialogue (rate limit, transient API error) shouldn't sink the
    // run — state isn't marked, so a re-run retries exactly this index.
    console.error(`[distill] ${label} FAILED (will retry on next run): ${err.message}`);
  }
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

console.log(
  `\nDone in ${((Date.now() - started) / 1000 / 60).toFixed(1)} min: ${state.done.length} dialogues in ${OUT_FILE}, ` +
    `${state.rejected.length} rejected. Read ${PREVIEW_FILE} before scaling up or merging.`
);
