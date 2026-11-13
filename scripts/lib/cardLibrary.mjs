// The card library: every individual evidence card from the PUBLIC disclosed
// archive (training-data/cases/pf-archive + pf-rebuttals, i.e. openCaselist
// open-source docs), searchable and viewable one card at a time.
//
// Only individual cards are exposed — never whole case files or their paths.
// That is the boundary the product chose: disclosed evidence is public by
// design, but Cross shows it card by card, with tag and cite, the way
// debaters actually use it.
//
// Layout (built by scripts/build-card-index.mjs, gitignored, rebuilt at
// deploy like the lexical index):
//   scripts/card-index/catalog.json     one compact row per card (in memory)
//   scripts/card-index/terms/NNN.json   inverted index shards  (loaded per query)
//   scripts/card-index/cards/NNN.json   full card text shards  (loaded per view)
// Same memory discipline as corpusIndex.mjs: the whole thing is ~300MB of
// text, so nothing but the catalog is ever held in full.

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCards, shortCite, stripMarks } from "./cardParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const TRAINING_DATA = path.join(ROOT, "training-data");
export const CARD_INDEX_DIR = path.join(ROOT, "scripts", "card-index");
const WEB_DATA_DIR = path.join(ROOT, "web", "data");
const SOURCES = [
  { dir: "cases/pf-archive", kind: "case" },
  { dir: "cases/pf-rebuttals", kind: "rebuttal" },
];
const TERM_SHARDS = 256;
const CARD_SHARDS = 256;
const MAX_DOC_FREQ_RATIO = 0.45; // terms in >45% of cards don't discriminate (but "nuclear" or "AI" alone must still work)
const STOPWORDS = new Set(
  "the a an and or of to in on for with is are was were be been by from at as it its this that these those their there they them we our you your he she his her not no but if than then so such can could would should will may might also into over under about after before between more most less very just only other which who whom what when where why how all any each some".split(
    " "
  )
);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/<\/?mark>/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function fnv(term) {
  let h = 0x811c9dc5;
  for (let i = 0; i < term.length; i++) {
    h ^= term.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
const termShard = (term) => fnv(term) % TERM_SHARDS;
const cardShard = (id) => parseInt(id.slice(0, 4), 16) % CARD_SHARDS;
const pad = (n) => String(n).padStart(3, "0");

function parseFrontmatter(content) {
  const meta = {};
  if (!content.startsWith("---")) return { meta, body: content };
  const end = content.indexOf("\n---", 3);
  if (end === -1) return { meta, body: content };
  for (const line of content.slice(3, end).split("\n")) {
    const m = /^(\w+):\s*(.*)$/.exec(line);
    if (!m) continue;
    let v = m[2].trim();
    if (/^".*"$/.test(v)) v = v.slice(1, -1);
    meta[m[1]] = v;
  }
  return { meta, body: content.slice(end + 4) };
}

function parseTournaments(v) {
  try {
    const arr = JSON.parse(v || "[]");
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

async function listMarkdown(dir) {
  const out = [];
  async function walk(d) {
    let entries;
    try {
      entries = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else if (e.name.endsWith(".md")) out.push(p);
    }
  }
  await walk(dir);
  return out.sort();
}

// The visible "read" text: highlighted runs if the card has any, else the
// start of the body. Used for result previews.
function previewOf(body) {
  const marked = [...body.matchAll(/<mark>([^<]*)<\/mark>/g)].map((m) => m[1]).join(" ").replace(/\s+/g, " ").trim();
  const text = marked.length >= 40 ? marked : stripMarks(body).replace(/\s+/g, " ").trim();
  return text.length > 220 ? `${text.slice(0, 217)}…` : text;
}

// ------------------------------------------------------------ topic pages ---
// Aggregates for the public /topics pages: what was run on each resolution,
// computed from the disclosed cards. Counts are DISTINCT DISCLOSED DOCS (one
// team's case at one tournament), not cards, so one card-heavy case can't
// dominate. Team names are deliberately not included: public pages show
// aggregates only.

// Words too generic to be a "theme" of one side (debate filler).
const THEME_STOP = new Set(
  "aff neg pro con impact impacts link links turn turns key causes cause leads lead now status quo means solves solve solvency empirics empirically prove proves outweighs uniqueness unique non probability magnitude timeframe scope makes make makes more less every only even also still because would will could should can just already way thus means outweigh evidence card cards author warrant extinction".split(" ")
);

const GENERIC_ARGS = new Set(
  "cards card overview framework rebuttal rebuttals off case on case weighing numbers to note lay aff cards lay neg cards extensions extension frontlines frontline blocks block answers analytics definitions definition evidence aff neg pro con summary final focus 1ac 1nc 2ac 2nc misc other theory".split(
    /\s(?=[a-z0-9])/
  )
);
const JUNK_SECTION = /https?:|www\.|accessed|\/\/|%[0-9a-f]{2}|<<|\.com|\.org|\]|\[|\d{4}|[^\x20-\x7e’'–—]/i;
const ARG_PATTERNS = [
  /^(.{3,48}?)\s*[-—–]{1,3}\s*(?:1AC|1NC|2AC|2NC|AC|NC)\b/i, // "Deterrence---1NC"
  /^(?:1AC|1NC|2AC|2NC)\s*[-—–:]{1,3}\s*(.{3,48})$/i, // "1NC – Stability"
  /^(?:contention|c)\s*(?:\d+|#|one|two|three|four)\s*(?:[:\-–—.]\s*)?(?:is\s+)?(.{3,48})$/i, // "Contention 1 is X", "C2 Tradeoff"
  /^sub\s*-?point\s*[a-z0-9]\s*[:\-–—.]\s*(.{3,48})$/i, // "Subpoint A: Terrorism"
];

/** The argument a section heading names ("Deterrence"), or null. */
export function argumentFromSection(section) {
  const s = String(section || "").trim();
  if (!s || s.length > 70 || JUNK_SECTION.test(s)) return null;
  for (const re of ARG_PATTERNS) {
    const m = re.exec(s);
    if (!m) continue;
    const arg = m[1]
      .replace(/[\s:.;,\-–—]+$/, "")
      .replace(/^[\s\-–—#:*.]+/, "")
      .replace(/^(the|a|an)\s+/i, "")
      .trim();
    const key = arg.toLowerCase();
    if (arg.length < 3 || GENERIC_ARGS.has(key) || /^(contention|subpoint|c\d)/i.test(arg)) return null;
    return arg;
  }
  return null;
}

const MIN_TOPIC_DOCS = 20;

const titleCase = (s) =>
  s.length > 4 && s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s.charAt(0).toUpperCase() + s.slice(1);

function topN(map, n) {
  return [...map.values()].sort((a, b) => b.docs.size - a.docs.size || a.label.localeCompare(b.label)).slice(0, n);
}

function buildTopicSummaries(rows) {
  const topics = new Map();
  for (const r of rows) {
    if (!r.season || !r.cycle || r.cycle === "unsorted") continue;
    const key = `${r.season}|${r.cycle}`;
    if (!topics.has(key)) {
      topics.set(key, { season: r.season, cycle: r.cycle, docs: new Set(), teams: new Set(), cards: 0, sides: { Pro: newSide(), Con: newSide() } });
    }
    const t = topics.get(key);
    t.docs.add(r.doc);
    if (r.team) t.teams.add(r.team);
    t.cards++;
    const side = t.sides[r.side];
    if (!side) continue;
    side.cards++;
    side.docs.add(r.doc);
    const arg = argumentFromSection(r.section);
    if (arg) {
      const k = arg.toLowerCase();
      if (!side.args.has(k)) side.args.set(k, { label: titleCase(arg), docs: new Set(), cards: [] });
      const entry = side.args.get(k);
      entry.docs.add(r.doc);
      if (r.hl && entry.cards.length < 4) entry.cards.push(r);
    }
    // Tag vocabulary (words and two-word phrases), counted once per doc.
    const words = tokenize(r.tag).filter((w) => w.length > 2 && !/^\d+$/.test(w) && !THEME_STOP.has(w) && !/^(https?|www|com|org|html)$/.test(w));
    // Two-word phrases only: single words ("otherwise", "next") are noise.
    const grams = new Set();
    for (let i = 0; i + 1 < words.length; i++) grams.add(`${words[i]} ${words[i + 1]}`);
    // Counted per TEAM, so one team's case disclosed at several tournaments
    // can't make its own phrasing look like a trend.
    for (const g of grams) {
      if (!side.terms.has(g)) side.terms.set(g, new Set());
      side.terms.get(g).add(r.team || r.doc);
    }
    const author = r.cite.replace(/\s*['’]?\d{2,4}$/, "").trim();
    if (author && author.length <= 40 && /^[A-Z]/.test(author) && !/^(no author|na|n\/a|accessed|retrieved|cited|updated)\b/i.test(author)) {
      const ak = author.toLowerCase();
      if (!side.authors.has(ak)) side.authors.set(ak, { label: author, docs: new Set() });
      side.authors.get(ak).docs.add(r.doc);
    }
  }
  function newSide() {
    return { cards: 0, docs: new Set(), args: new Map(), authors: new Map(), terms: new Map() };
  }
  const out = [];
  for (const t of topics.values()) {
    // Too few disclosed cases to say anything real: no public page.
    if (t.docs.size < MIN_TOPIC_DOCS) continue;
    const sides = {};
    for (const [name, side] of Object.entries(t.sides)) {
      const args = topN(side.args, 8).filter((a) => a.docs.size >= 2);
      // Example cards: one or two per leading argument, highlighted only.
      const examples = [];
      for (const a of args.slice(0, 4)) {
        for (const c of a.cards.slice(0, 2)) examples.push({ id: c.id, tag: c.tag.slice(0, 220), cite: c.cite, argument: a.label });
      }
      sides[name] = {
        cards: side.cards,
        docs: side.docs.size,
        arguments: args.map((a) => ({ label: a.label, docs: a.docs.size })),
        authors: topN(side.authors, 10)
          .filter((a) => a.docs.size >= 2)
          .map((a) => ({ label: a.label, docs: a.docs.size })),
        examples: examples.slice(0, 6),
      };
    }
    // Themes: phrases far more common in this side's tags than the other's.
    for (const [name, other] of [["Pro", "Con"], ["Con", "Pro"]]) {
      const mine = t.sides[name].terms;
      const theirs = t.sides[other].terms;
      const nMine = Math.max(1, t.teams.size);
      const nTheirs = Math.max(1, t.teams.size);
      const scored = [];
      for (const [g, docs] of mine) {
        if (docs.size < 3) continue;
        const a = docs.size / nMine;
        const b = (theirs.get(g)?.size || 0) / nTheirs;
        if (a < 1.6 * b) continue;
        scored.push({ label: g, docs: docs.size, score: a - b });
      }
      scored.sort((x, y) => y.score - x.score);
      const picked = [];
      for (const c of scored) {
        // Skip a word already covered by a chosen phrase (and vice versa).
        if (picked.some((p) => p.label.includes(c.label) || c.label.includes(p.label))) continue;
        picked.push(c);
        if (picked.length === 8) break;
      }
      sides[name].themes = picked.map(({ label, docs }) => ({ label, docs }));
    }
    out.push({ season: t.season, cycle: t.cycle, docs: t.docs.size, teams: t.teams.size, cards: t.cards, sides });
  }
  return out;
}

// ---------------------------------------------------------------- build ---

/** Parses every source file and writes catalog + term shards + card shards. */
export async function buildCardIndex() {
  const catalog = []; // compact rows, index = card number
  const cardBuckets = Array.from({ length: CARD_SHARDS }, () => ({}));
  const postings = new Map(); // term -> Map<cardNum, weight>
  const seen = new Set();
  const resolutions = {}; // "season|cycle" -> resolution text
  const topicRows = []; // per card, for buildTopicSummaries
  let files = 0;

  for (const { dir, kind } of SOURCES) {
    for (const abs of await listMarkdown(path.join(TRAINING_DATA, dir))) {
      const raw = await fs.readFile(abs, "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const cards = parseCards(body);
      if (!cards.length) continue;
      files++;
      const rel = path.relative(TRAINING_DATA, abs).split(path.sep).join("/");
      if (meta.resolution && meta.season && meta.cycle) resolutions[`${meta.season}|${meta.cycle}`] ??= meta.resolution;
      cards.forEach((card, n) => {
        // Same card disclosed by many teams: index it once (first wins).
        const fingerprint = crypto
          .createHash("sha1")
          .update(`${shortCite(card.cite).toLowerCase()}|${stripMarks(card.body).toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 400)}`)
          .digest("hex");
        if (seen.has(fingerprint)) return;
        seen.add(fingerprint);

        const id = crypto.createHash("sha1").update(`${rel}#${n}`).digest("hex").slice(0, 16);
        const num = catalog.length;
        const row = {
          id,
          tag: card.tag,
          cite: shortCite(card.cite),
          team: meta.team || "",
          side: meta.side || "",
          season: meta.season || "",
          cycle: meta.cycle || "",
          kind,
          hl: card.body.includes("<mark>") ? 1 : 0,
          preview: previewOf(card.body),
        };
        catalog.push(row);
        topicRows.push({ id, doc: rel, team: row.team, side: row.side, season: row.season, cycle: row.cycle, section: card.section, cite: row.cite, tag: row.tag, hl: row.hl });
        cardBuckets[cardShard(id)][id] = {
          ...row,
          fullCite: card.cite,
          body: card.body,
          section: card.section,
          resolution: meta.resolution || "",
          tournaments: parseTournaments(meta.tournaments),
        };

        // Field-weighted term weights: tag 6, author 4, highlighted text 2,
        // body 1 (capped so one long card can't dominate a common word).
        const weights = new Map();
        const add = (tokens, w) => {
          for (const t of tokens) weights.set(t, (weights.get(t) || 0) + w);
        };
        add(new Set(tokenize(card.tag)), 6);
        add(new Set(tokenize(row.cite)), 4);
        const marked = [...card.body.matchAll(/<mark>([^<]*)<\/mark>/g)].map((m) => m[1]).join(" ");
        add(new Set(tokenize(marked)), 2);
        const bodyCounts = new Map();
        for (const t of tokenize(card.body)) bodyCounts.set(t, Math.min(3, (bodyCounts.get(t) || 0) + 1));
        for (const [t, c] of bodyCounts) weights.set(t, (weights.get(t) || 0) + c);
        for (const [t, w] of weights) {
          if (!postings.has(t)) postings.set(t, new Map());
          postings.get(t).set(num, Math.round(w));
        }
      });
    }
  }

  const maxDocs = catalog.length * MAX_DOC_FREQ_RATIO;
  const termBuckets = Array.from({ length: TERM_SHARDS }, () => []);
  for (const [term, plist] of postings) {
    if (plist.size > maxDocs) continue;
    const flat = [];
    for (const [num, w] of plist) flat.push(num, w);
    termBuckets[termShard(term)].push(`${JSON.stringify(term)}:${JSON.stringify(flat)}`);
  }
  postings.clear();

  const tmp = `${CARD_INDEX_DIR}.tmp-${process.pid}`;
  await fs.rm(tmp, { recursive: true, force: true });
  await fs.mkdir(path.join(tmp, "terms"), { recursive: true });
  await fs.mkdir(path.join(tmp, "cards"), { recursive: true });
  for (let n = 0; n < TERM_SHARDS; n++) {
    await fs.writeFile(path.join(tmp, "terms", `${pad(n)}.json`), `{${termBuckets[n].join(",")}}`);
    termBuckets[n] = null;
  }
  for (let n = 0; n < CARD_SHARDS; n++) {
    await fs.writeFile(path.join(tmp, "cards", `${pad(n)}.json`), JSON.stringify(cardBuckets[n]));
    cardBuckets[n] = null;
  }
  await fs.writeFile(
    path.join(tmp, "catalog.json"),
    JSON.stringify({ builtAt: new Date().toISOString(), files, resolutions, cards: catalog })
  );
  const topics = buildTopicSummaries(topicRows).map((t) => ({ ...t, resolution: resolutions[`${t.season}|${t.cycle}`] || "" }));
  await fs.writeFile(path.join(tmp, "topics.json"), JSON.stringify({ builtAt: new Date().toISOString(), topics }));
  await fs.rm(CARD_INDEX_DIR, { recursive: true, force: true });
  await fs.rename(tmp, CARD_INDEX_DIR);
  // The public /topics pages are static Next pages built from this; Next
  // reads it from inside web/ so the build doesn't trace the whole repo.
  await fs.mkdir(WEB_DATA_DIR, { recursive: true });
  await fs.copyFile(path.join(CARD_INDEX_DIR, "topics.json"), path.join(WEB_DATA_DIR, "topics.json"));
  invalidateCardIndex();
  return { files, cards: catalog.length };
}

// ---------------------------------------------------------------- query ---

let catalogPromise = null;
const termCache = new Map(); // shard -> Promise<object|null>, LRU
const cardCache = new Map();
const CACHE_MAX = 24;

function lruGet(cache, key, load) {
  if (cache.has(key)) {
    const v = cache.get(key);
    cache.delete(key);
    cache.set(key, v);
    return v;
  }
  const p = load().catch(() => null);
  cache.set(key, p);
  while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return p;
}

function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fs
      .readFile(path.join(CARD_INDEX_DIR, "catalog.json"), "utf8")
      .then((raw) => {
        const data = JSON.parse(raw);
        const byId = new Map(data.cards.map((c, i) => [c.id, i]));
        return { ...data, byId };
      })
      .catch(() => null);
  }
  return catalogPromise;
}

export function invalidateCardIndex() {
  catalogPromise = null;
  termCache.clear();
  cardCache.clear();
}

const loadTermShard = (n) =>
  lruGet(termCache, n, async () => JSON.parse(await fs.readFile(path.join(CARD_INDEX_DIR, "terms", `${pad(n)}.json`), "utf8")));
const loadCardShard = (n) =>
  lruGet(cardCache, n, async () => JSON.parse(await fs.readFile(path.join(CARD_INDEX_DIR, "cards", `${pad(n)}.json`), "utf8")));

export async function hasCardIndex() {
  return Boolean(await loadCatalog());
}

function matchesFilters(row, { side, season, cycle, kind, highlighted }) {
  if (side && row.side.toLowerCase() !== String(side).toLowerCase()) return false;
  if (season && row.season !== season) return false;
  if (cycle && row.cycle !== cycle) return false;
  if (kind && row.kind !== kind) return false;
  if (highlighted && !row.hl) return false;
  return true;
}

/**
 * Searches cards. Ranks by field-weighted term matches (tag > author >
 * highlighted text > body) times IDF, then rewards matching more of the
 * query's distinct terms. Returns { total, results: [catalog rows + score] }.
 */
export async function searchCards(query, { limit = 20, offset = 0, ...filters } = {}) {
  const cat = await loadCatalog();
  if (!cat) return { total: 0, results: [], available: false };
  const terms = [...new Set(tokenize(query))].slice(0, 12);
  const N = cat.cards.length;

  let scored;
  if (terms.length === 0) {
    // No query: browse by filters, highlighted (read-ready) cards first.
    scored = [];
    for (let i = 0; i < N; i++) if (matchesFilters(cat.cards[i], filters)) scored.push([i, cat.cards[i].hl]);
  } else {
    const shards = await Promise.all(terms.map((t) => loadTermShard(termShard(t))));
    const score = new Map(); // num -> [score, matchedTerms]
    terms.forEach((t, i) => {
      const flat = shards[i]?.[t];
      if (!flat) return;
      const df = flat.length / 2;
      const idf = Math.log(1 + N / df);
      for (let j = 0; j < flat.length; j += 2) {
        const num = flat[j];
        const s = score.get(num) || [0, 0];
        s[0] += flat[j + 1] * idf;
        s[1] += 1;
        score.set(num, s);
      }
    });
    scored = [];
    // With 3+ terms, a card must match at least half of them to count — a
    // single shared common word isn't a result.
    const minMatched = terms.length >= 3 ? Math.ceil(terms.length / 2) : 1;
    for (const [num, [s, matched]] of score) {
      if (matched < minMatched) continue;
      const row = cat.cards[num];
      if (!matchesFilters(row, filters)) continue;
      const coverage = matched / terms.length;
      scored.push([num, s * coverage * coverage * (row.hl ? 1.1 : 1)]);
    }
  }
  scored.sort((a, b) => b[1] - a[1]);
  // Same card re-cut with different highlighting by another team: keep the
  // best-ranked copy only.
  const seenCards = new Set();
  scored = scored.filter(([num]) => {
    const key = `${cat.cards[num].cite.toLowerCase()}|${cat.cards[num].tag.toLowerCase().slice(0, 60)}`;
    if (seenCards.has(key)) return false;
    seenCards.add(key);
    return true;
  });
  const page = scored.slice(offset, offset + limit).map(([num, s]) => ({ ...cat.cards[num], score: Math.round(s * 10) / 10 }));
  return { total: scored.length, results: page, available: true };
}

/** Full card by id (tag, full cite, body with <mark>, round metadata), or null. */
export async function getCard(id) {
  if (!/^[0-9a-f]{16}$/.test(String(id))) return null;
  const shard = await loadCardShard(cardShard(id));
  return shard?.[id] ?? null;
}

/** Filter options with counts: seasons, topic cycles (+ resolution), sides. */
export async function cardFacets() {
  const cat = await loadCatalog();
  if (!cat) return { available: false, seasons: [], cycles: [], total: 0 };
  const seasons = new Map();
  const cycles = new Map();
  for (const c of cat.cards) {
    seasons.set(c.season, (seasons.get(c.season) || 0) + 1);
    const key = `${c.season}|${c.cycle}`;
    cycles.set(key, (cycles.get(key) || 0) + 1);
  }
  return {
    available: true,
    total: cat.cards.length,
    builtAt: cat.builtAt,
    seasons: [...seasons].sort((a, b) => b[0].localeCompare(a[0])).map(([season, count]) => ({ season, count })),
    cycles: [...cycles]
      .map(([k, count]) => {
        const [season, cycle] = k.split("|");
        return { season, cycle, count, resolution: cat.resolutions?.[k] || "" };
      })
      .sort((a, b) => b.season.localeCompare(a.season) || a.cycle.localeCompare(b.cycle)),
  };
}
