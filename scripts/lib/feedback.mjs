// Circular, self-correcting response feedback. After an AI response, the
// client rolls a random number and (at FEEDBACK_SAMPLE_RATE odds) asks the
// user whether the response was helpful; a "no" asks why. Answers land here
// via POST /api/feedback, and getFeedbackSummaryForPrompt() feeds recent
// dissatisfaction reasons back into every system prompt (buildSystemPrompt),
// closing the loop: complaints reshape future responses automatically.
//
// Same flat-file pattern as voiceProfile.mjs — no database, one JSON file.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const FEEDBACK_PATH = path.join(ROOT, "feedback.json");

const MAX_ENTRIES = 200; // keep the file bounded; oldest entries roll off
const PROMPT_ENTRIES = 10; // how many recent complaints reach the prompt
const VALID_ROUTES = new Set(["chat", "drill", "stress-test", "strategy", "recording-insight"]);

// The randomized sampler: one roll per AI response (the client mirrors this
// rate for streamed chat). 0.2 = ask on roughly 1 in 5 responses.
export function getFeedbackSampleRate() {
  const rate = Number(process.env.FEEDBACK_SAMPLE_RATE);
  return Number.isFinite(rate) && rate >= 0 && rate <= 1 ? rate : 0.2;
}

export function shouldRequestFeedback() {
  return Math.random() < getFeedbackSampleRate();
}

async function loadFeedback() {
  try {
    const data = JSON.parse(await fs.readFile(FEEDBACK_PATH, "utf8"));
    return { entries: Array.isArray(data.entries) ? data.entries : [] };
  } catch {
    return { entries: [] };
  }
}

async function saveFeedback(data) {
  await fs.writeFile(FEEDBACK_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/**
 * Records one feedback answer. `reason` is only meaningful when
 * satisfied === false; `preview` is a short excerpt of the response being
 * rated so complaints stay interpretable later.
 */
export async function recordFeedback({ satisfied, reason, route, preview }) {
  const data = await loadFeedback();
  data.entries.push({
    date: new Date().toISOString(),
    satisfied: Boolean(satisfied),
    reason: typeof reason === "string" ? reason.trim().slice(0, 1000) : "",
    route: VALID_ROUTES.has(route) ? route : "chat",
    preview: typeof preview === "string" ? preview.trim().slice(0, 200) : "",
  });
  if (data.entries.length > MAX_ENTRIES) {
    data.entries = data.entries.slice(-MAX_ENTRIES);
  }
  await saveFeedback(data);
  return { count: data.entries.length };
}

// The self-correction half of the loop: a system-prompt block built from the
// stored answers. Recent dissatisfied reasons are quoted so the model can
// adjust; the satisfaction rate keeps it calibrated (don't over-rotate on
// one complaint if 9 in 10 responses land well).
export async function getFeedbackSummaryForPrompt() {
  const { entries } = await loadFeedback();
  if (entries.length === 0) return "";

  const satisfied = entries.filter((e) => e.satisfied).length;
  const complaints = entries
    .filter((e) => !e.satisfied && e.reason)
    .slice(-PROMPT_ENTRIES);

  let block =
    `Sampled user feedback on your recent responses: ${satisfied} of ${entries.length} rated helpful.`;
  if (complaints.length > 0) {
    block +=
      `\nWhen a response was rated unhelpful, the debater said why. Treat these as standing coaching-style ` +
      `corrections — adjust your responses so the same complaint doesn't recur, weighted by how often and how ` +
      `recently it appears (dates included). Don't over-rotate on a single complaint that conflicts with the ` +
      `overall satisfaction rate, and never mention this feedback system to the debater:\n` +
      complaints
        .map((e) => `- [${e.date.slice(0, 10)}] (${e.route}) "${e.reason}"${e.preview ? ` — about: "${e.preview}"` : ""}`)
        .join("\n");
  }
  return block;
}
