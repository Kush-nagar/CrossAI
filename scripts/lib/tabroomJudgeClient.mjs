// Judge paradigm lookup, scraped from Tabroom.com — ported from the proven
// handleJudge logic in flowforge-tabroom-link's tabroom-proxy. Public
// disclosure data (a judge's own posted paradigm), so this runs anonymously —
// no Tabroom login/session needed, unlike caselistClient.mjs.

const TABROOM_WEB = "https://www.tabroom.com";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class TabroomJudgeError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "TabroomJudgeError";
    this.status = status;
  }
}

function isLoginPage(html) {
  const lower = html.toLowerCase();
  return (
    lower.includes("log in to tabroom") ||
    lower.includes("please login to view") ||
    lower.includes("login session has expired") ||
    lower.includes("please log in again") ||
    lower.includes("showloginbox") ||
    (lower.includes("password") && lower.includes("email") && lower.includes("create a new account"))
  );
}

function isNoResults(html) {
  return /returned no judges/i.test(html) || /no results found/i.test(html);
}

function extractJudgeName(html) {
  // Current Tabroom puts the judge's name in the page's <h3>; older layouts
  // used <h4> (which today holds certification slugs like "nsda-experience",
  // hence h3 first).
  const h3Matches = html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi);
  for (const m of h3Matches) {
    const name = m[1].replace(/<[^>]+>/g, "").trim();
    if (name && name.length < 60 && !/(paradigm|tabroom|log in|search|judge|view past)/i.test(name)) return name;
  }
  const h4Match = html.match(/<h4[^>]*>([\s\S]*?)<\/h4>/);
  if (h4Match?.[1]) {
    const name = h4Match[1].replace(/<[^>]+>/g, "").trim();
    if (name && !/(paradigm|tabroom|log in|judge|view past|-)/i.test(name)) return name;
  }
  const hMatches = html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi);
  for (const m of hMatches) {
    const name = m[1].replace(/<[^>]+>/g, "").trim();
    if (name && name.length < 60 && !/(paradigm|tabroom|log in|search|judge paradigms|view past)/i.test(name)) return name;
  }
  return null;
}

function extractParadigm(html) {
  if (isLoginPage(html) || isNoResults(html)) return null;

  const patterns = [
    /class="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /id="paradigm[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*ltborderbottom[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*paradigm_text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const text = m[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
      if (text.length > 20) return text;
    }
  }
  const bodyMatch = html.match(/<h4[^>]*>[\s\S]*?<\/h4>([\s\S]*?)(?:<div[^>]*class="[^"]*menu|<footer|$)/i);
  if (bodyMatch?.[1]) {
    const text = bodyMatch[1].replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
    if (text.length > 20 && !isLoginPage(text) && !isNoResults(text)) return text;
  }
  return null;
}

// Paradigm-search results are a table: first | last | affiliations | link
// (an icon anchor with no text, so name-from-anchor-text parsing finds
// nothing on the current layout).
function parseJudgeSearchResults(html) {
  const results = [];
  const seen = new Set();
  for (const row of html.split(/<tr[\s>]/i).slice(1)) {
    const id = /judge_person_id=(\d+)/.exec(row)?.[1];
    if (!id || seen.has(id)) continue;
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
      m[1].replace(/<br\s*\/?>/gi, "; ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    );
    if (cells.length < 2) continue;
    seen.add(id);
    results.push({ judge_id: id, name: `${cells[0]} ${cells[1]}`.trim(), affiliations: cells[2] || undefined });
  }
  return results;
}

async function fetchPage(url, token) {
  let res;
  try {
    const headers = { "user-agent": USER_AGENT };
    if (token) headers.cookie = `TabroomToken=${encodeURIComponent(token)}`;
    res = await fetch(url, { headers });
  } catch (e) {
    throw new TabroomJudgeError(`Couldn't reach Tabroom: ${e.message}`, 502);
  }
  return res.text();
}

export { fetchPage, isLoginPage, USER_AGENT, TABROOM_WEB };

/**
 * Authenticate a Tabroom account. Returns the TabroomToken session value on
 * success; throws TabroomJudgeError otherwise. Password is used only for
 * this call and never retained.
 */
export async function login(username, password) {
  let res;
  try {
    res = await fetch(`${TABROOM_WEB}/user/login/login_save.mhtml`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", "user-agent": USER_AGENT },
      body: new URLSearchParams({ username, password }).toString(),
      redirect: "manual",
    });
  } catch (e) {
    throw new TabroomJudgeError(`Couldn't reach Tabroom: ${e.message}`, 502);
  }

  const setCookie = res.headers.get("set-cookie") || "";
  const location = res.headers.get("location") || "";
  const tokenMatch = /TabroomToken=([^;]+)/.exec(setCookie);
  if (location.includes("err=") || !tokenMatch) {
    throw new TabroomJudgeError("Tabroom login failed — check your username and password.", 401);
  }
  return decodeURIComponent(tokenMatch[1]);
}

/**
 * Look up a judge's paradigm by their Tabroom judge_person_id. Pass the
 * signed-in debater's TabroomToken to resolve paradigms Tabroom otherwise
 * gates behind login.
 * Returns { judge_id, name, paradigm, tabroom_url }.
 */
export async function lookupJudgeById(judgeId, token) {
  const url = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${encodeURIComponent(judgeId)}`;
  const html = await fetchPage(url, token);
  const name = extractJudgeName(html);
  return {
    judge_id: judgeId,
    name: isLoginPage(html) ? "Unknown" : name || "Unknown",
    paradigm: extractParadigm(html),
    tabroom_url: url,
  };
}

/**
 * Look up a judge's paradigm by name. Tries the tournaments.tech directory
 * first (fast, structured), then falls back to scraping Tabroom's paradigm
 * search. Returns either a resolved { judge_id?, name, paradigm, tabroom_url }
 * or, when the name is ambiguous, { name, results: [{judge_id, name}], total }.
 */
export async function lookupJudgeByName(name, token) {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new TabroomJudgeError("Judge name is required.", 400);

  try {
    const res = await fetch(`https://tournaments.tech/query?format=LD&term=${encodeURIComponent(trimmed)}`, {
      signal: AbortSignal.timeout(5000),
    });
    const text = await res.text();
    const ttData = JSON.parse(text);

    if (ttData && (ttData.paradigm || ttData.name)) {
      return {
        judge_id: ttData.judge_id || ttData.id || undefined,
        name: ttData.name || trimmed,
        paradigm: ttData.paradigm || null,
        tabroom_url:
          ttData.tabroom_url ||
          ttData.url ||
          (ttData.judge_id ? `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${ttData.judge_id}` : undefined),
        source: "tournaments_tech",
      };
    }
    if (Array.isArray(ttData) && ttData.length === 1 && ttData[0]) {
      return {
        judge_id: ttData[0].judge_id || ttData[0].id || undefined,
        name: ttData[0].name || trimmed,
        paradigm: ttData[0].paradigm || null,
        tabroom_url: ttData[0].url || undefined,
        source: "tournaments_tech",
      };
    }
    if (Array.isArray(ttData) && ttData.length > 1) {
      return {
        name: trimmed,
        results: ttData.map((j) => ({ judge_id: String(j.judge_id || j.id || ""), name: String(j.name || "Unknown") })),
        total: ttData.length,
        source: "tournaments_tech",
      };
    }
    // Unrecognized format — fall through to Tabroom scraping.
  } catch {
    // tournaments.tech unavailable or non-JSON — fall through.
  }

  const [firstName, ...rest] = trimmed.split(" ");
  const lastName = rest.join(" ") || trimmed;
  const searchUrl = `${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(firstName)}&search_last=${encodeURIComponent(lastName)}`;
  const searchHtml = await fetchPage(searchUrl, token);

  if (isLoginPage(searchHtml)) {
    return { name: trimmed, paradigm: null, warning: "Tabroom requires login to view this paradigm.", tabroom_url: searchUrl };
  }
  if (isNoResults(searchHtml)) {
    return { name: trimmed, paradigm: null, tabroom_url: searchUrl, source: "tabroom_fallback" };
  }

  const judgeResults = parseJudgeSearchResults(searchHtml);

  if (judgeResults.length === 1) {
    const pUrl = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${judgeResults[0].judge_id}`;
    const pHtml = await fetchPage(pUrl, token);
    // Prefer the name off the judge's own paradigm page (same source
    // lookupJudgeById trusts) over the search-results table cells — those
    // cells aren't reliably [first name, last name] on every result row.
    return {
      judge_id: judgeResults[0].judge_id,
      name: extractJudgeName(pHtml) || judgeResults[0].name,
      paradigm: extractParadigm(pHtml),
      tabroom_url: pUrl,
      source: "tabroom_fallback",
    };
  }

  if (judgeResults.length === 0) {
    const searchParadigm = extractParadigm(searchHtml);
    if (searchParadigm) {
      return { name: trimmed || extractJudgeName(searchHtml) || "Unknown", paradigm: searchParadigm, tabroom_url: searchUrl, source: "tabroom_fallback" };
    }
  }

  return { name: trimmed || "Multiple Results", results: judgeResults, total: judgeResults.length, source: "tabroom_fallback" };
}

// --- Judging record (experience + decision stats) ---------------------------
// The paradigm page also carries a "Full Judging Record" table when viewed
// logged-in: one row per round judged, with fixed column order
// Tournament | Lv | Date | Ev | Rd | Aff | Neg | Vote | Result.
// "Result" is the panel outcome ("Pro 3-0"); comparing it to "Vote" tells us
// whether this judge sat with or against the panel majority.

const stripTags = (s) =>
  String(s ?? "")
    .replace(/<span class="hidden">[\s\S]*?<\/span>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&ndash;/g, "–")
    .replace(/\s+/g, " ")
    .trim();

const AFF_SIDE_WORDS = new Set(["aff", "pro"]);
const NEG_SIDE_WORDS = new Set(["neg", "con"]);
const sideWord = (s) => {
  const w = String(s ?? "").trim().toLowerCase().split(/\s+/)[0] || "";
  if (AFF_SIDE_WORDS.has(w)) return "aff";
  if (NEG_SIDE_WORDS.has(w)) return "neg";
  return null;
};

// Prelims are labeled R1/R11/"Round 3"; anything else (Finals, Semis, Octas,
// Doubles, Runoff...) is treated as an elim round.
const isElimLabel = (label) => {
  const l = String(label ?? "").trim();
  return l !== "" && !/^(r(oun)?d?)?\s*\d+/i.test(l);
};

/** Parse the Full Judging Record table into structured rounds. */
export function parseJudgingRecord(html) {
  const start = html.search(/Full Judging Record/i);
  if (start === -1) return [];
  const tableEnd = html.indexOf("</table>", start);
  const section = html.slice(start, tableEnd === -1 ? undefined : tableEnd);
  const rows = section.split(/<tr[\s>]/i).slice(1);
  const rounds = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    if (cells.length < 9) continue; // header or malformed row
    const [tournCell, levelCell, dateCell, eventCell, roundCell, affCell, negCell, voteCell, resultCell] = cells;
    const round = {
      tournament: stripTags(tournCell),
      tourn_id: /tourn_id=(\d+)/.exec(tournCell)?.[1] ?? null,
      level: stripTags(levelCell),
      date: /\d{4}-\d{2}-\d{2}/.exec(dateCell)?.[0] ?? stripTags(dateCell),
      event: stripTags(eventCell),
      round: stripTags(roundCell),
      aff: stripTags(affCell),
      aff_entry_id: /entry_id=(\d+)/.exec(affCell)?.[1] ?? null,
      neg: stripTags(negCell),
      neg_entry_id: /entry_id=(\d+)/.exec(negCell)?.[1] ?? null,
      vote: stripTags(voteCell),
      result: stripTags(resultCell),
    };
    if (!round.tournament && !round.vote) continue;
    rounds.push(round);
  }
  return rounds;
}

/** Aggregate a parsed judging record into pre-round-relevant stats. */
export function computeJudgeStats(rounds) {
  if (!rounds.length) return null;
  const byEvent = {};
  const byLevel = {};
  const tournaments = new Map(); // name -> latest date
  let affVotes = 0;
  let negVotes = 0;
  let elimRounds = 0;
  let panelRounds = 0;
  let panelMajority = 0;
  const dates = [];

  for (const r of rounds) {
    if (r.event) byEvent[r.event] = (byEvent[r.event] || 0) + 1;
    if (r.level) byLevel[r.level] = (byLevel[r.level] || 0) + 1;
    if (r.tournament) {
      const prev = tournaments.get(r.tournament);
      if (!prev || String(r.date) > prev) tournaments.set(r.tournament, String(r.date));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(r.date)) dates.push(r.date);
    const vote = sideWord(r.vote);
    if (vote === "aff") affVotes++;
    if (vote === "neg") negVotes++;
    if (isElimLabel(r.round)) elimRounds++;
    const tally = /(\d+)\s*-\s*(\d+)/.exec(r.result);
    if (tally && Number(tally[1]) + Number(tally[2]) > 1) {
      panelRounds++;
      const winner = sideWord(r.result);
      if (vote && winner && vote === winner) panelMajority++;
    }
  }

  dates.sort();
  const decided = affVotes + negVotes;
  const pct = (n, d) => (d > 0 ? Math.round((n / d) * 100) : null);
  const recentTournaments = [...tournaments.entries()]
    .sort((a, b) => (a[1] < b[1] ? 1 : -1))
    .slice(0, 8)
    .map(([name, date]) => ({ name, last_judged: date }));

  return {
    total_rounds: rounds.length,
    by_event: byEvent,
    by_level: byLevel,
    tournaments_judged: tournaments.size,
    recent_tournaments: recentTournaments,
    first_round_date: dates[0] ?? null,
    last_round_date: dates[dates.length - 1] ?? null,
    vote_split: {
      aff_or_pro: affVotes,
      neg_or_con: negVotes,
      aff_pct: pct(affVotes, decided),
    },
    elim_rounds: elimRounds,
    elim_pct: pct(elimRounds, rounds.length),
    panel_rounds: panelRounds,
    voted_with_panel_majority: panelMajority,
    majority_pct: pct(panelMajority, panelRounds),
  };
}

function reportFromParadigmPage(html, judgeId, fallbackName, url) {
  if (isLoginPage(html)) {
    throw new TabroomJudgeError(
      "Tabroom requires login for judge records and the current session has no working Tabroom token — ask the debater to sign out and sign back in.",
      401
    );
  }
  const rounds = parseJudgingRecord(html);
  return {
    judge_id: judgeId ?? /judge_person_id=(\d+)/.exec(html)?.[1] ?? null,
    name: extractJudgeName(html) || fallbackName || "Unknown",
    paradigm: extractParadigm(html),
    stats: computeJudgeStats(rounds),
    recent_rounds: rounds.slice(0, 25),
    tabroom_url: url,
  };
}

/**
 * Full judge report: paradigm + judging record + computed decision stats.
 * Goes straight to Tabroom (tournaments.tech has no judging record): by id
 * when given, else via the paradigm name search — which renders the paradigm
 * page itself on a unique match, and a results list otherwise (returned as a
 * {results:[{judge_id,name}]} disambiguation for the caller to re-query).
 */
export async function getJudgeReport({ judgeId, name }, token) {
  if (judgeId) {
    const url = `${TABROOM_WEB}/index/paradigm.mhtml?judge_person_id=${encodeURIComponent(judgeId)}`;
    return reportFromParadigmPage(await fetchPage(url, token), String(judgeId), null, url);
  }

  const trimmed = String(name || "").trim();
  if (!trimmed) throw new TabroomJudgeError("Judge name or judge_id is required.", 400);
  const [firstName, ...rest] = trimmed.split(" ");
  // A single word is a surname search, not first=last=word.
  const searchFirst = rest.length > 0 ? firstName : "";
  const searchLast = rest.join(" ") || trimmed;
  const searchUrl = `${TABROOM_WEB}/index/paradigm.mhtml?search_first=${encodeURIComponent(searchFirst)}&search_last=${encodeURIComponent(searchLast)}`;
  const html = await fetchPage(searchUrl, token);
  if (isNoResults(html)) {
    return { name: trimmed, paradigm: null, stats: null, note: "No judge matched this name on Tabroom — check the spelling or ask for their Tabroom paradigm link.", tabroom_url: searchUrl };
  }

  // A results LIST means the name was ambiguous; a unique match makes Tabroom
  // render the judge's paradigm page directly (no results table present).
  const matches = parseJudgeSearchResults(html);
  if (matches.length > 1) {
    return { name: trimmed, results: matches, total: matches.length };
  }
  if (matches.length === 1) {
    return getJudgeReport({ judgeId: matches[0].judge_id }, token);
  }
  return reportFromParadigmPage(html, null, trimmed, searchUrl);
}
