// Splits a disclosed-case markdown file (training-data/cases/pf-archive/**,
// written by the ingest pipeline / scripts/ingest-opencaselist.mjs) into
// individual evidence cards.
//
// The docx → text extraction (extract.mjs) keeps one paragraph per line and
// marks highlighted runs with <mark>. A card in that output looks like:
//
//   Speed is key.                                  ← tag (the claim)
//   Osborn 21 [Kris Osborn is a journalist, ...]   ← cite (author + year first)
//   The tactical advantages of AI-enabled <mark>warfare</mark> ...   ← body
//   ...more body paragraphs until the next tag
//
// So the anchor is the CITE line: it starts with an author-ish name followed
// by a 2- or 4-digit year. The tag is the nearest non-empty line above it;
// the body runs until the next card's tag. Short unmarked lines sitting
// directly above a tag (e.g. "1NC", "Contention 1: Gridlock") are section
// headings, kept as context rather than glued onto the previous card's body.

// "Osborn 21", "Woodruff and Feaver 17", "Bendix & Jeong '23", "NYT 24",
// "U.S. Dept. of State 2022", "Smith et al. 19", "de Vries 20".
const NAME = String.raw`(?:[A-Z][\w'’.\-]*|de|van|von|da|del|al|la|le|di)`;
const CITE_RE = new RegExp(
  String.raw`^\s*${NAME}(?:[ ,]+(?:and|&|et al\.?|${NAME}))*[ ,]+['’]?(?:\d{2}|(?:19|20)\d{2})(?![\d%])\b`
);
const MARK_TAG_RE = /<\/?mark>/g;
const MAX_BODY_CHARS = 12000;

export function stripMarks(s) {
  return s.replace(MARK_TAG_RE, "");
}

function hasRealMark(s) {
  return /<mark>[^<]*\S[^<]*<\/mark>/.test(s);
}

/** Whether a line looks like a card citation. */
export function isCiteLine(line) {
  const plain = stripMarks(line).trim();
  if (plain.length < 6 || plain.length > 1500) return false;
  if (!CITE_RE.test(plain)) return false;
  // A bare "Smith 21" is still a cite; but sentence-like body lines that
  // happen to start "In 2018 ..." are not — require the year to come within
  // the first ~60 chars and the line not to be mostly highlighted prose.
  const yearAt = plain.search(/['’]?(?:\d{2}|(?:19|20)\d{2})(?![\d%])\b/);
  if (yearAt > 60) return false;
  // Datelines ("HOUSTON, March 10", "May 2023") open article text, not cites.
  if (/^(Jan(uary)?|Feb(ruary)?|Mar(ch)?|Apr(il)?|May|June?|July?|Aug(ust)?|Sep(t(ember)?)?|Oct(ober)?|Nov(ember)?|Dec(ember)?)\b/i.test(plain)) return false;
  if (/^[A-Z][A-Z .'-]{2,},\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/.test(plain)) return false;
  if (/^(In|By|Since|From|Before|After|Until|On|At|As of|During|Over|Under|About|Around|Nearly|Only|Some|Of|The|A|An|Every|Each|This|That|These|Those|It|We|They|He|She|Our|Their|His|Her)\b/.test(plain)) return false;
  return true;
}

// Speech/section labels that sit above a card but aren't its claim.
const LABEL_RE = /^(\d?(AC|NC|AR|NR)|[12]?(AC|NC)|C\d+|Contention\s*\d*|Sub ?point\s*\w?|Framework|Overview|Off|On case|Case|Rebuttal|Summary|Final focus|Frontlines?|Blocks?|Responses?|AT:?.{0,40}|A2:?.{0,40})[\s.:—-]*$/i;

function isTagLine(line) {
  const plain = stripMarks(line).trim();
  return plain.length >= 4 && plain.length <= 400 && !hasRealMark(line) && !LABEL_RE.test(plain);
}

function isHeadingLine(line) {
  const plain = stripMarks(line).trim();
  return plain.length > 0 && plain.length <= 80 && !hasRealMark(line) && !/[.!?]["”’)]?$/.test(plain);
}

/**
 * Parses a case body (frontmatter already removed) into cards.
 * Returns [{ tag, cite, body, section }] — body keeps <mark> highlighting and
 * one paragraph per line.
 */
export function parseCards(body) {
  const lines = body.split("\n");
  const plainAt = (i) => stripMarks(lines[i]).trim();

  // Pass 1: anchors — a cite line with a tag-looking line above it.
  const anchors = []; // { tagStart, tagIdx, citeIdx }
  for (let i = 1; i < lines.length; i++) {
    if (!isCiteLine(lines[i])) continue;
    let j = i - 1;
    while (j >= 0 && !lines[j].trim()) j--;
    if (j < 0 || !isTagLine(lines[j])) continue;
    // Two cite-looking lines in a row: the upper one is a cite, not a tag.
    if (anchors.length && anchors[anchors.length - 1].citeIdx === j) continue;
    // Tags that wrap in the source doc arrive as several lines: pull earlier
    // lines in while the line above doesn't end a sentence (at most 2 more),
    // so "…generates" + "the right of self-preservation…" stays one tag.
    const floor = anchors.length ? anchors[anchors.length - 1].citeIdx + 2 : 0;
    // Only a true continuation (the lower line starts lowercase) is joined;
    // a capitalized line above is a heading or a separate label, not part of
    // the tag ("Contention 1: Grid strain" / "Data centers spike prices.").
    let tagStart = j;
    while (
      /^[a-z]/.test(plainAt(tagStart)) &&
      tagStart - 1 >= floor &&
      j - tagStart < 2 &&
      lines[tagStart - 1].trim() &&
      isTagLine(lines[tagStart - 1]) &&
      plainAt(tagStart - 1).length <= 300 &&
      !/[.!?:;"”’)\]]$/.test(plainAt(tagStart - 1))
    ) {
      tagStart--;
    }
    anchors.push({ tagStart, tagIdx: j, citeIdx: i });
  }

  // Pass 2: cut each card from its cite to the next card's tag.
  const cards = [];
  let section = "";
  for (let k = 0; k < anchors.length; k++) {
    const { tagStart, tagIdx, citeIdx } = anchors[k];
    if (k === 0) {
      for (let h = 0; h < tagStart; h++) if (isHeadingLine(lines[h])) section = plainAt(h);
    }
    const end = k + 1 < anchors.length ? anchors[k + 1].tagStart : lines.length;

    // Cites that wrap: an unclosed ( or [ — or a URL split mid-way — means the
    // next short line is still the citation, not the card text.
    let cite = plainAt(citeIdx);
    const unbalanced = (t) => (t.match(/[([]/g) || []).length > (t.match(/[)\]]/g) || []).length;
    let bodyStart = citeIdx + 1;
    while (bodyStart < end && bodyStart - citeIdx <= 3) {
      const next = plainAt(bodyStart);
      if (!next || hasRealMark(lines[bodyStart]) || next.length > 400) break;
      const citeTail =
        /^(%[0-9A-F]{2}|\/|https?:)/i.test(next) ||
        (next.length <= 250 && /(https?:\/\/|www\.|archive\.ph|accessed|\/\/\s?[A-Za-z]{1,6}\s*$|\]\s*$)/i.test(next));
      if (!unbalanced(cite) && !citeTail) break;
      cite = `${cite} ${next}`;
      bodyStart++;
    }

    // Peel trailing heading lines: they title the NEXT card's section.
    const bodyLines = lines.slice(bodyStart, end);
    let nextSection = null;
    while (bodyLines.length) {
      const last = bodyLines[bodyLines.length - 1];
      if (!last.trim()) {
        bodyLines.pop();
        continue;
      }
      if (k + 1 < anchors.length && isHeadingLine(last) && bodyLines.length > 1) {
        nextSection = stripMarks(last).trim();
        bodyLines.pop();
        continue;
      }
      break;
    }
    // A card with no next cite after it can swallow the rest of the doc
    // (analytics, other speeches). Real cards are far shorter: cut at a
    // paragraph boundary past MAX_BODY_CHARS.
    let kept = 0;
    let cutAt = bodyLines.length;
    for (let b = 0; b < bodyLines.length; b++) {
      kept += bodyLines[b].length + 1;
      if (kept > MAX_BODY_CHARS) {
        cutAt = Math.max(1, b);
        break;
      }
    }
    bodyLines.length = cutAt;
    const cardBody = bodyLines
      .map((l) => l.replace(/<mark>\s*<\/mark>/g, "").trimEnd())
      .filter((l, idx, arr) => l.trim() || (idx > 0 && arr[idx - 1].trim()))
      .join("\n")
      .trim();
    const tag = lines
      .slice(tagStart, tagIdx + 1)
      .map((l) => stripMarks(l).trim())
      .join(" ");
    if (cardBody.length >= 40) cards.push({ tag, cite, body: cardBody, section });
    if (nextSection) section = nextSection;
  }
  return cards;
}

/** "Osborn 21" — author + year from the start of a cite, for compact display. */
export function shortCite(cite) {
  const m = CITE_RE.exec(stripMarks(cite));
  return m ? m[0].trim() : stripMarks(cite).slice(0, 40);
}
