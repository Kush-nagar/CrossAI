// Opponent results lookup, scraped from Tabroom.com — same conventions as
// tabroomJudgeClient.mjs (plain fetch + regex, typed error carrying .status,
// authenticated with the signed-in debater's own TabroomToken). Tabroom has
// no results API and, as of mid-2026, gates the results area behind login;
// every function here is a single user-initiated page fetch — no crawling.
//
// Tabroom results are tournament-anchored (there is no student-name search),
// so the scan chain is: searchTournaments (name -> tourn_id) ->
// getTournamentEntries (tourn_id -> entry_id by team code/student name) ->
// getEntryRecord (round-by-round record with opponents, judges, decisions).

import { fetchPage, isLoginPage, TABROOM_WEB } from "./tabroomJudgeClient.mjs";

export class TabroomResultsError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TabroomResultsError";
    this.status = status;
  }
}

const stripTags = (s) =>
  String(s ?? "")
    .replace(/<span class="hidden">[\s\S]*?<\/span>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

function assertUsablePage(html, what) {
  if (isLoginPage(html)) {
    throw new TabroomResultsError(
      "Tabroom requires login for results and the current session has no working Tabroom token — ask the debater to sign out and sign back in.",
      401
    );
  }
  if (/anonymized public postings/i.test(html)) {
    throw new TabroomResultsError(
      `This tournament anonymizes its public postings, so ${what} isn't available for it. Try one of the team's other tournaments.`,
      404
    );
  }
}

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)";

/**
 * Search tournaments by name. Returns [{tourn_id, name, location, dates}],
 * newest first (Tabroom's own ordering). Use the dates to pick the right
 * season's instance of an annual tournament.
 */
export async function searchTournaments(query, token) {
  const q = String(query || "").trim();
  if (!q) throw new TabroomResultsError("Tournament search query is required.", 400);
  const url = `${TABROOM_WEB}/index/search.mhtml?search=${encodeURIComponent(q)}`;
  const html = await fetchPage(url, token);
  assertUsablePage(html, "tournament search");

  const results = [];
  const seen = new Set();
  const chunks = html.split(/href\s*=\s*"\/index\/tourn\/index\.mhtml\?tourn_id=/).slice(1);
  for (const chunk of chunks) {
    const id = /^(\d+)/.exec(chunk)?.[1];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const anchorBody = /^[^>]*>([\s\S]*?)<\/a>/.exec(chunk)?.[1];
    const name = stripTags(anchorBody);
    if (!name) continue;
    // Location and dates are the first text after the anchor: the stripped
    // chunk reads "<id>... > Name City, ST Mon DD-DD, YYYY ...".
    const text = stripTags(chunk.slice(0, 800));
    const dateMatch = new RegExp(`${MONTH}[^A-Za-z<]{0,3}[^<]{0,22}\\d{4}`).exec(text);
    const dates = dateMatch?.[0]?.trim() ?? null;
    const nameIdx = text.indexOf(name);
    const location =
      nameIdx >= 0 ? text.slice(nameIdx + name.length, dateMatch ? dateMatch.index : undefined).trim() : "";
    results.push({ tourn_id: id, name, location: location || undefined, dates });
    if (results.length >= 15) break;
  }
  return { query: q, count: results.length, tournaments: results };
}

/**
 * List entries at a tournament from its public postings, with entry_ids for
 * getEntryRecord. Labels look like "MV Rizaa Fazal & Maeve Goldman" (school
 * code + student names) or bare codes at anonymized-ish events. `filter`
 * narrows by case-insensitive substring before capping.
 */
export async function getTournamentEntries(tournId, token, filter) {
  const id = String(tournId || "").trim();
  if (!id) throw new TabroomResultsError("tourn_id is required.", 400);
  const url = `${TABROOM_WEB}/index/tourn/postings/index.mhtml?tourn_id=${encodeURIComponent(id)}`;
  const html = await fetchPage(url, token);
  assertUsablePage(html, "the entry list");

  const entries = new Map(); // entry_id -> name
  const collect = (page) => {
    const re = /entry_record\.mhtml\?[^"]*entry_id=(\d+)[^>]*>\s*([^<]+)/g;
    let m;
    while ((m = re.exec(page)) !== null) {
      const name = m[2].replace(/\s+/g, " ").trim();
      if (name && !entries.has(m[1])) entries.set(m[1], name);
    }
  };
  collect(html);

  // Some tournaments post round schematics instead of entry links on the
  // index; the pairings inside a round page list (nearly) every entry. When
  // the index is sparse, sample a few round pages spread across the list —
  // bounded fan-out, not a crawl.
  if (entries.size < 10) {
    const roundIds = [...new Set([...html.matchAll(/round\.mhtml\?tourn_id=\d+&(?:amp;)?round_id=(\d+)/g)].map((r) => r[1]))];
    const picks = [...new Set([roundIds[0], roundIds[Math.floor(roundIds.length / 2)], roundIds[roundIds.length - 1]])].filter(Boolean);
    const pages = await Promise.all(
      picks.map((rid) =>
        fetchPage(`${TABROOM_WEB}/index/tourn/postings/round.mhtml?tourn_id=${encodeURIComponent(id)}&round_id=${rid}`, token).catch(() => "")
      )
    );
    pages.forEach(collect);
  }
  let list = [...entries.entries()].map(([entry_id, name]) => ({ entry_id, name }));
  const total = list.length;
  if (filter) {
    const f = String(filter).toLowerCase();
    list = list.filter((e) => e.name.toLowerCase().includes(f));
  }
  const shown = list.slice(0, 80);
  return {
    tourn_id: id,
    total_entries: total,
    matched: list.length,
    showing: shown.length,
    note:
      total === 0
        ? "No entry links on this tournament's postings — results may not be public (yet)."
        : list.length > shown.length
        ? "narrow with filter"
        : undefined,
    entries: shown,
  };
}

/**
 * A team's full round-by-round record at one tournament: per round the side,
 * opponent (with their entry_id for chained lookups), judge names, each
 * judge's decision (W/L), and speaker points, plus a computed W-L summary.
 */
export async function getEntryRecord(tournId, entryId, token) {
  const tid = String(tournId || "").trim();
  const eid = String(entryId || "").trim();
  if (!tid || !eid) throw new TabroomResultsError("tourn_id and entry_id are both required.", 400);
  const url = `${TABROOM_WEB}/index/tourn/postings/entry_record.mhtml?tourn_id=${encodeURIComponent(tid)}&entry_id=${encodeURIComponent(eid)}`;
  const html = await fetchPage(url, token);
  assertUsablePage(html, "this team's round record");

  const start = html.search(/Round Results/i);
  if (start === -1) {
    throw new TabroomResultsError("No round results on this entry's page — check tourn_id/entry_id.", 404);
  }
  const tableEnd = html.indexOf("</table>", start);
  const section = html.slice(start, tableEnd === -1 ? undefined : tableEnd);

  const divTexts = (cell) =>
    [...cell.matchAll(/<div[^>]*>([\s\S]*?)<\/div>/gi)].map((d) => stripTags(d[1])).filter(Boolean);

  const rounds = [];
  let wins = 0;
  let losses = 0;
  const judgesSeen = new Set();
  for (const row of section.split(/<tr[\s>]/i).slice(1)) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 5) continue;
    const [roundCell, sideCell, oppCell, judgeCell, resultCell, scoreCell = ""] = cells;
    const judges = divTexts(judgeCell);
    judges.forEach((j) => judgesSeen.add(j));
    const results = divTexts(resultCell);
    const w = results.filter((r) => /^w/i.test(r)).length;
    const l = results.filter((r) => /^l/i.test(r)).length;
    if (w + l > 0) {
      if (w > l) wins++;
      else if (l > w) losses++;
    }
    rounds.push({
      round: stripTags(roundCell),
      side: stripTags(sideCell),
      opponent: stripTags(oppCell).replace(/^vs\s+/i, ""),
      opponent_entry_id: /entry_id=(\d+)/.exec(oppCell)?.[1] ?? null,
      judges,
      decisions: results,
      points: divTexts(scoreCell),
    });
  }
  // Tabroom lists newest round first; flip to chronological for readability.
  rounds.reverse();

  return {
    tourn_id: tid,
    entry_id: eid,
    record: `${wins}-${losses}`,
    rounds_count: rounds.length,
    judges: [...judgesSeen],
    rounds,
    tabroom_url: url,
  };
}
