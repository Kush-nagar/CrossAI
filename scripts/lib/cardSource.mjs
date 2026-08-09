// Re-anchors reproduced cut evidence to the corpus file it came from.
//
// Why this exists: the card-reproduction rule (CROSS.md) says a card comes out
// exactly as it went in — same words, same highlighting. Instructions alone
// don't hold that line. A live test caught the model handing back a real
// archive card with five <mark> spans it had chosen itself, on a card whose
// source file carries no highlighting at all — a plausible-looking lie about
// what a team actually read aloud.
//
// So the source file, not the model, decides the markup. Each line of the
// reproduced card is looked up in the file it was pulled from; a line that
// matches comes back in the source's own form (its real <mark> spans, whether
// that's many or none), and a line that can't be found keeps its words but
// loses highlighting we can't vouch for. Words are never rewritten either way.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRAINING_DATA = path.resolve(__dirname, "..", "..", "training-data");

// Cards the debater supplied in the conversation have no corpus file to check
// against — the model passes this sentinel instead of a path.
export const USER_SUPPLIED = "user-upload";

// Cards may only be reproduced from PUBLIC disclosure data — the OpenCaselist
// archive — or from what the debater handed over themselves. The rest of the
// corpus is private coaching material the privacy rule keeps unnamed and
// unquoted, and a live test showed instructions alone don't hold that line:
// asked for "an example card", the model exported a private evidence-file card
// by cite and told the debater it came from the archive.
const PUBLIC_CARD_PREFIX = "cases/pf-archive/";

/** Whether cut evidence at this corpus path may be handed to a debater. */
export function isReproducibleSource(sourcePath) {
  if (!sourcePath) return false;
  if (sourcePath === USER_SUPPLIED) return true;
  return sourcePath.replace(/^\/+/, "").startsWith(PUBLIC_CARD_PREFIX);
}

export { PUBLIC_CARD_PREFIX };

const MARKUP_RE = /<\/?mark>|<\/?u>|\*\*/g;
// Below this length a line is a short cite or a fragment — too generic to
// match reliably, and it carries no highlighting worth verifying.
const MIN_MATCH_CHARS = 12;
// Prefix length for the near-miss pass. Long enough that a match is the same
// sentence rather than a stock opening phrase.
const MIN_PREFIX_CHARS = 40;

function stripMarkup(s) {
  return s.replace(MARKUP_RE, "");
}

// Flattens text for comparison (markup gone, whitespace collapsed) while
// recording where each flattened character came from, so a match can be mapped
// back to the exact original slice — marks and all.
function flattenWithMap(text) {
  let flat = "";
  const map = [];
  let lastWasSpace = false;
  for (let i = 0; i < text.length; i++) {
    const rest = text.startsWith("<", i) || text.startsWith("*", i) ? text.slice(i, i + 8) : null;
    if (rest) {
      const tag = rest.match(/^(<\/?mark>|<\/?u>|\*\*)/);
      if (tag) {
        i += tag[1].length - 1;
        continue;
      }
    }
    const ch = text[i];
    if (/\s/.test(ch)) {
      if (lastWasSpace || flat.length === 0) continue;
      flat += " ";
      map.push(i);
      lastWasSpace = true;
      continue;
    }
    flat += ch;
    map.push(i);
    lastWasSpace = false;
  }
  return { flat, map };
}

function resolveCorpusPath(relPath) {
  const abs = path.resolve(TRAINING_DATA, relPath.replace(/^\/+/, ""));
  if (abs !== TRAINING_DATA && !abs.startsWith(TRAINING_DATA + path.sep)) return null;
  return abs;
}

/**
 * Rebuilds `content` from its source file.
 *
 * Returns { content, stats: { matched, unverified, strippedMarks }, error }.
 * On any failure (missing/unreadable path) the content comes back untouched
 * with `error` set — generating the card still beats failing the request, and
 * the caller surfaces the miss to the model.
 */
export async function reanchorCard(content, sourcePath) {
  const stats = { matched: 0, unverified: 0, strippedMarks: 0, rewritten: 0 };
  if (!sourcePath || sourcePath === USER_SUPPLIED) {
    return { content, stats, error: null, verified: false };
  }
  const abs = resolveCorpusPath(sourcePath);
  if (!abs) return { content, stats, error: `source_path "${sourcePath}" is outside the corpus`, verified: false };

  let source;
  try {
    source = await fs.readFile(abs, "utf8");
  } catch {
    return { content, stats, error: `source_path "${sourcePath}" could not be read`, verified: false };
  }

  const { flat: sourceFlat, map } = flattenWithMap(source);
  const rebuilt = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => {
      const probe = flattenWithMap(line).flat.trim();
      if (probe.length < MIN_MATCH_CHARS) return line;
      const at = sourceFlat.indexOf(probe);
      if (at !== -1) {
        stats.matched++;
        const start = map[at];
        const end = at + probe.length < map.length ? map[at + probe.length] : source.length;
        return source.slice(start, end).trimEnd();
      }

      // Near-miss: the opening still matches but the rest drifted — a
      // paraphrase, a trimmed ending, a "cleaned up" quote. The source line
      // that owns the matching opening replaces it wholesale, so the drift
      // never ships.
      if (probe.length >= MIN_PREFIX_CHARS) {
        // Sample windows across the line, not just its opening — an edit in
        // the first clause would hide an otherwise intact sentence.
        let windowAt = -1;
        for (const frac of [0, 0.25, 0.5, 0.75]) {
          const from = Math.min(Math.floor(probe.length * frac), probe.length - MIN_PREFIX_CHARS);
          windowAt = sourceFlat.indexOf(probe.slice(from, from + MIN_PREFIX_CHARS));
          if (windowAt !== -1) break;
        }
        if (windowAt !== -1) {
          const origAt = map[windowAt];
          const lineStart = source.lastIndexOf("\n", origAt) + 1;
          const lineEnd = source.indexOf("\n", origAt);
          stats.matched++;
          stats.rewritten++;
          return source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).trimEnd();
        }
      }

      // Nowhere in the source it was supposedly pulled from: keep the words,
      // drop highlighting that nothing backs up.
      if (/<mark>/.test(line)) stats.strippedMarks++;
      stats.unverified++;
      return line.replace(/<\/?mark>/g, "");
    })
    .join("\n");

  return { content: rebuilt, stats, error: null, verified: true };
}

/** True when the two texts differ in anything but markup — i.e. words changed. */
export function wordsDiffer(a, b) {
  return flattenWithMap(stripMarkup(a)).flat.trim() !== flattenWithMap(stripMarkup(b)).flat.trim();
}
