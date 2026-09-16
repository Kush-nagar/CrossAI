import { generateFile, SUPPORTED_FORMATS } from "./fileGen.mjs";
import { searchCorpus, readCorpusSection } from "./corpusSearch.mjs";
import { webSearch, hasWebSearch } from "./webSearch.mjs";
import { apiGet as caselistApiGet, apiGetBuffer as caselistApiGetBuffer, CaselistError } from "./caselistClient.mjs";
import { extractTextFromBuffer, cleanText } from "./extract.mjs";
import { lookupJudgeByName, lookupJudgeById, getJudgeReport, TabroomJudgeError } from "./tabroomJudgeClient.mjs";
import { judgeCacheKey, isFresh, getCachedJudge, upsertParadigmOnly } from "./judgeCache.mjs";
import { searchTournaments, getTournamentEntries, getEntryRecord, TabroomResultsError } from "./tabroomResultsClient.mjs";

export const generateFileTool = {
  name: "generate_file",
  description:
    "Generate a downloadable file for the debater — a written case, block, strategy memo, prep sheet, or round debrief — in the requested format. " +
    "Only call this for an actual deliverable the debater asked for (per the plan-before-complex-execution rule: tell them what you're producing first). " +
    "Use markdown-style content: '# '/'## ' for headings, '- ' for bullets, '**bold**' for emphasis. " +
    "For xlsx, provide content as a markdown pipe table (e.g. '| Speech | Time | Notes |').",
  input_schema: {
    type: "object",
    properties: {
      filename: {
        type: "string",
        description: "Base filename without extension, e.g. 'aff-case-econ-da'.",
      },
      format: {
        type: "string",
        enum: SUPPORTED_FORMATS,
        description: "Output file format.",
      },
      title: {
        type: "string",
        description: "Optional document title, rendered as a heading.",
      },
      content: {
        type: "string",
        description: "The full content of the document, in the markdown subset described above.",
      },
    },
    required: ["filename", "format", "content"],
  },
};

/**
 * Executes a generate_file tool_use block. `describeLocation` maps the
 * written file's name to a human-facing reference (a URL for the web app,
 * an absolute path for the CLI).
 *
 * Returns { toolResultContent, isError, finalName, location } — callers get
 * both the tool_result payload for the conversation and the structured
 * filename/location for their own UI (e.g. a download link), no re-parsing.
 */
export async function runGenerateFileTool(toolUseBlock, describeLocation) {
  const { filename, format, content, title } = toolUseBlock.input ?? {};
  try {
    const { filename: finalName, absPath } = await generateFile({ filename, format, content, title });
    const location = describeLocation(finalName, absPath);
    return {
      toolResultContent: `File generated: ${finalName}\nAvailable at: ${location}`,
      isError: false,
      finalName,
      location,
    };
  } catch (err) {
    return {
      toolResultContent: `Failed to generate file: ${err.message}`,
      isError: true,
      finalName: null,
      location: null,
    };
  }
}

// --- Corpus retrieval tools (internal — never surfaced to the debater) ---
// These back the chat endpoint's on-demand corpus loading: the system prompt
// carries only the reference core + a manifest, and the model pulls evidence,
// cases, blocks, and rounds through these tools when a turn needs them.
// Retrieval is invisible bookkeeping — per the corpus-privacy rule, nothing a
// tool returns may be referenced by file or cite in the reply.

export const searchCorpusTool = {
  name: "search_corpus",
  description:
    "Silently search your internal training corpus (evidence, cases, blocks, real rounds) for material relevant to the " +
    "current turn. Returns matching files with scores and text snippets (each snippet tagged with its char offset). " +
    "Use this before answering anything that benefits from grounding in real material — argument structure, how a " +
    "position is typically run or answered, what strong evidence on a topic looks like. This is internal bookkeeping: " +
    "never mention searching, the corpus, or any file/cite it returns (corpus-privacy rule); let what you learn shape " +
    "the substance of your coaching invisibly. This also bans referring to the retrieval mechanism itself by ANY " +
    "name or synonym — not 'the corpus,' 'my archive,' 'my loaded topic archive,' 'my database,' 'my sources,' 'my " +
    "training data,' or 'my materials.' State every fact as your own knowledge, with zero meta-reference to where " +
    "it came from.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search terms — debate jargon and topic words work well (e.g. 'court clog uniqueness', 'K framework link debate').",
      },
      maxResults: {
        type: "integer",
        description: "Maximum files to return (default 6).",
      },
    },
    required: ["query"],
  },
};

export const readCorpusFileTool = {
  name: "read_corpus_file",
  description:
    "Silently read a section of an internal training-corpus file found via search_corpus (or listed in the corpus " +
    "manifest). Reads are ranged by char offset/length so large files can be read in targeted pieces — start from a " +
    "snippet's offset rather than 0 when you're chasing a specific match. Same privacy rule as search_corpus: never " +
    "surface the file, its name, or its cites in your reply — and never refer to the retrieval mechanism itself by " +
    "any name or synonym ('the corpus,' 'my archive,' 'my database,' 'my sources,' etc.). State every fact as your " +
    "own knowledge, with zero meta-reference to where it came from.",
  input_schema: {
    type: "object",
    properties: {
      path: {
        type: "string",
        description: "Corpus-relative path, e.g. 'blocks/court-clog/courts.md'.",
      },
      offset: {
        type: "integer",
        description: "Char offset to start reading from (default 0).",
      },
      length: {
        type: "integer",
        description: "Chars to read (default 40000, max 60000).",
      },
    },
    required: ["path"],
  },
};

// Default files returned per search when the model doesn't specify. Lower =
// fewer/tighter snippets fed back into the loop = less to stream/re-encode on
// the next turn. Env-overridable so top_k can be tuned without a code change
// (e.g. CORPUS_SEARCH_MAX_RESULTS=3 for the leanest retrieval).
const DEFAULT_SEARCH_MAX_RESULTS = Number(process.env.CORPUS_SEARCH_MAX_RESULTS) || 6;

export async function runSearchCorpusTool(toolUseBlock) {
  const { query, maxResults } = toolUseBlock.input ?? {};
  try {
    const results = await searchCorpus(query, { maxResults: maxResults || DEFAULT_SEARCH_MAX_RESULTS });
    if (results.length === 0) {
      return { toolResultContent: "No corpus files matched that query.", isError: false };
    }
    const text = results
      .map((r) => {
        const snippets = r.snippets
          .map((s) => `  [offset ${s.offset}] ${s.text}`)
          .join("\n");
        return `${r.path} (score ${r.score}, ${r.sizeChars} chars)${r.title ? ` — ${r.title}` : ""}\n${snippets}`;
      })
      .join("\n\n");
    return {
      toolResultContent:
        `Internal grounding only. State what you learn as your own knowledge, flatly, with zero meta-reference to ` +
        `where it came from — no "the corpus," "my archive," "my sources," "my training data," or any other name ` +
        `for this lookup, and no file path, title, or cite from below:\n\n${text}`,
      isError: false,
    };
  } catch (err) {
    return { toolResultContent: `Search failed: ${err.message}`, isError: true };
  }
}

export async function runReadCorpusFileTool(toolUseBlock) {
  const { path: relPath, offset, length } = toolUseBlock.input ?? {};
  try {
    const section = await readCorpusSection(relPath, { offset, length });
    const header =
      `${relPath} — chars ${section.offset}-${section.offset + section.length} of ${section.totalChars}` +
      (section.hasMore ? ` (more remains; next offset ${section.offset + section.length})` : " (end of file)");
    return {
      toolResultContent:
        `Internal grounding only. State what you learn as your own knowledge, flatly, with zero meta-reference to ` +
        `where it came from — no "the corpus," "my archive," "my sources," "my training data," or any other name ` +
        `for this lookup, and no file path, title, or cite from below:\n\n${header}\n\n${section.content}`,
      isError: false,
    };
  } catch (err) {
    return { toolResultContent: `Read failed: ${err.message}`, isError: true };
  }
}

// --- OpenCaselist scouting tools (opponent disclosure) -------------------
// These let Cross scout a team from the OpenCaselist wiki DURING coaching —
// rounds (opponents, judges, sides, tournaments, round reports), disclosed
// cites/positions, and team contact/notes. Unlike the corpus tools, this is
// PUBLIC opponent disclosure: Cross may name teams, positions, judges, and
// tournaments openly in its reply. Each runner is authenticated with the
// signed-in debater's own OpenCaselist token (passed by the chat endpoint).
//
// Flow the model follows: caselist_events (resolve circuit+year -> slug) ->
// caselist_schools (find the school) -> caselist_teams -> team rounds/cites/
// info, then caselist_round_document to read a round's open-source speech doc.
// Retrieval is faithful: report only what the tools return, never invent
// rounds, judges, or positions.

const CASELIST_MAX = 12000; // char cap on any single tool result
const capStr = (s, n) => {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n) + "…[truncated]" : t;
};
// Page an item list by serialized size so the packed JSON stays well-formed —
// blind truncation used to cut mid-array for teams with many rounds, handing
// the model unparseable data. Callers surface nextOffset so the model can
// request the rest.
const pageItems = (items, offset, charBudget = 9000) => {
  const start = Math.min(Math.max(0, Number(offset) || 0), items.length);
  const page = [];
  let used = 0;
  for (let i = start; i < items.length; i++) {
    const len = JSON.stringify(items[i]).length;
    if (page.length > 0 && used + len > charBudget) break;
    used += len;
    page.push(items[i]);
  }
  const end = start + page.length;
  return { page, start, end, nextOffset: end < items.length ? end : undefined };
};
// The API stores sides as single letters; normalize for side-split stats.
const normSide = (side) => (side === "A" ? "Aff/Pro" : side === "N" ? "Neg/Con" : side);
const asCaselistArray = (d) => (Array.isArray(d) ? d : Array.isArray(d?.caselists) ? d.caselists : []);
const includesCI = (hay, needle) => String(hay ?? "").toLowerCase().includes(String(needle ?? "").toLowerCase());
const packJson = (obj) => capStr(JSON.stringify(obj), CASELIST_MAX);
const encSeg = encodeURIComponent;

export const caselistEventsTool = {
  name: "caselist_events",
  description:
    "List the caselists on the OpenCaselist wiki so you can resolve a circuit + year to a slug (for example High " +
    "School PF 2025-26). Returns each caselist's slug (pass it to the other caselist tools), display name, event code " +
    "(cx=Policy, ld=LD, pf=Public Forum), level (hs/college/ms), and year. Includes past/archived seasons. Optionally " +
    "filter by event, level, or year. Seasons roll over in the summer, so the newest caselist can be nearly empty " +
    "early in the year — when a school/team/search lookup comes back empty on the current season, retry on the " +
    "previous season's slug before concluding the team doesn't disclose.",
  input_schema: {
    type: "object",
    properties: {
      event: { type: "string", description: "Filter by event code: cx, ld, or pf." },
      level: { type: "string", description: "Filter by level: hs, college, or ms." },
      year: { type: "integer", description: "Filter by starting year, for example 2025 for the 2025-26 season." },
    },
  },
};

export const caselistSchoolsTool = {
  name: "caselist_schools",
  description:
    "List schools disclosed on a caselist. Pass the caselist slug from caselist_events. Provide query to filter by " +
    "school name (school lists are long) so you can find a specific school's slug.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug, for example hspf25." },
      query: { type: "string", description: "Case-insensitive substring to filter school names by." },
    },
    required: ["caselist"],
  },
};

export const caselistTeamsTool = {
  name: "caselist_teams",
  description: "List a school's disclosed teams on a caselist. Returns each team's slug and display name.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug." },
      school: { type: "string", description: "School slug from caselist_schools." },
    },
    required: ["caselist", "school"],
  },
};

export const caselistRoundsTool = {
  name: "caselist_team_rounds",
  description:
    "Get a team's disclosed rounds — the core scouting data. Each round has round_id (join key for " +
    "caselist_team_cites), tournament, round, side (Aff/Neg or Pro/Con), opponent, judge, the round REPORT (a " +
    "speech-order summary of what happened), and an opensource document path when the team uploaded their speech doc " +
    "(pass it to caselist_round_document to read it). Use this for backhalf tendency analysis, side splits, " +
    "broken-positions-by-tournament, and lists of judges/opponents/tournaments faced. Long round lists are paged: " +
    "when the result has nextOffset, call again with offset=nextOffset until it is absent — do this BEFORE computing " +
    "any percentages or tendencies, or your stats will silently cover only the first page.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug." },
      school: { type: "string", description: "School slug." },
      team: { type: "string", description: "Team slug from caselist_teams." },
      offset: { type: "integer", description: "Round index to continue from (the previous result's nextOffset)." },
    },
    required: ["caselist", "school", "team"],
  },
};

export const caselistCitesTool = {
  name: "caselist_team_cites",
  description:
    "Get a team's disclosed cites — their positions and cards. Each cite has a title (the position/tag), the citation " +
    "body (cites), and a round_id linking it to a round from caselist_team_rounds (join on round_id to see which " +
    "positions were broken at which tournament). This is the team's disclosed document content. Paged like " +
    "caselist_team_rounds: follow nextOffset until absent before summarizing.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug." },
      school: { type: "string", description: "School slug." },
      team: { type: "string", description: "Team slug." },
      offset: { type: "integer", description: "Cite index to continue from (the previous result's nextOffset)." },
    },
    required: ["caselist", "school", "team"],
  },
};

export const caselistTeamInfoTool = {
  name: "caselist_team_info",
  description:
    "Get a team's detail: display name, debater names, and free-text notes. Scan the notes for contact info (email, " +
    "handles) the team chose to publish. The school's US state is included when available.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug." },
      school: { type: "string", description: "School slug." },
      team: { type: "string", description: "Team slug." },
    },
    required: ["caselist", "school", "team"],
  },
};

export const caselistSearchTool = {
  name: "caselist_search",
  description:
    "Full-text search within a caselist (positions, cites, reports). Use when you do not know the school/team but have " +
    "a position name, argument, or debater. Returns matching results with their school/team/context.",
  input_schema: {
    type: "object",
    properties: {
      caselist: { type: "string", description: "Caselist slug to search within." },
      query: { type: "string", description: "Search terms (position, argument, debater, school)." },
    },
    required: ["caselist", "query"],
  },
};

export const caselistRoundDocumentTool = {
  name: "caselist_round_document",
  description:
    "Download and read a team's open-source disclosure document for a round — the actual speech doc with cut cards " +
    "(text a debater highlighted to read aloud is wrapped in <mark> tags). Pass the opensource path returned by " +
    "caselist_team_rounds. Long documents are returned in chunks: the result says the next offset to request when " +
    "more remains.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "The round's opensource path from caselist_team_rounds." },
      offset: { type: "integer", description: "Char offset to continue reading from (default 0)." },
    },
    required: ["path"],
  },
};

export const caselistTools = [
  caselistEventsTool,
  caselistSchoolsTool,
  caselistTeamsTool,
  caselistRoundsTool,
  caselistCitesTool,
  caselistTeamInfoTool,
  caselistSearchTool,
  caselistRoundDocumentTool,
];
const CASELIST_TOOL_NAMES = new Set(caselistTools.map((t) => t.name));
export const isCaselistTool = (name) => CASELIST_TOOL_NAMES.has(name);

/**
 * Executes any caselist_* tool. `token` is the signed-in debater's OpenCaselist
 * session token (from their Cross session). Returns { toolResultContent, isError }.
 */
export async function runCaselistTool(toolUseBlock, token) {
  const { name, input = {} } = toolUseBlock;
  if (!token) {
    return { toolResultContent: "Not signed in to OpenCaselist — ask the debater to sign in again.", isError: true };
  }
  try {
    switch (name) {
      case "caselist_events": {
        const [cur, old] = await Promise.all([
          caselistApiGet(token, "/caselists").catch(() => []),
          caselistApiGet(token, "/caselists?archived=true").catch(() => []),
        ]);
        const seen = new Set();
        let events = [];
        for (const c of [...asCaselistArray(cur), ...asCaselistArray(old)]) {
          const slug = c?.name || c?.slug;
          if (!slug || seen.has(slug)) continue;
          seen.add(slug);
          events.push({ slug, display_name: c.display_name, event: c.event, level: c.level, year: c.year, archived: c.archived });
        }
        if (input.event) events = events.filter((e) => includesCI(e.event, input.event));
        if (input.level) events = events.filter((e) => includesCI(e.level, input.level));
        if (input.year) events = events.filter((e) => Number(e.year) === Number(input.year));
        events.sort((a, b) => (b.year || 0) - (a.year || 0));
        return { toolResultContent: packJson({ count: events.length, caselists: events }), isError: false };
      }
      case "caselist_schools": {
        const raw = await caselistApiGet(token, `/caselists/${encSeg(input.caselist)}/schools`);
        let schools = (Array.isArray(raw) ? raw : raw?.schools || []).map((s) =>
          typeof s === "string" ? { name: s, displayName: s } : { name: s.name, displayName: s.displayName || s.display_name, state: s.state }
        );
        const totalOnCaselist = schools.length;
        if (input.query) schools = schools.filter((s) => includesCI(s.displayName, input.query) || includesCI(s.name, input.query));
        const total = schools.length;
        const shown = schools.slice(0, 60);
        const note =
          total === 0
            ? totalOnCaselist === 0
              ? "This caselist has no schools yet (new season?) — try the previous season's slug from caselist_events."
              : `No school matched "${input.query}" among ${totalOnCaselist} schools — check the spelling, try a shorter substring, or try the previous season's caselist.`
            : total > shown.length
            ? "narrow with query"
            : undefined;
        return {
          toolResultContent: packJson({ total, totalOnCaselist, showing: shown.length, note, schools: shown }),
          isError: false,
        };
      }
      case "caselist_teams": {
        const raw = await caselistApiGet(token, `/caselists/${encSeg(input.caselist)}/schools/${encSeg(input.school)}/teams`);
        const teams = (Array.isArray(raw) ? raw : raw?.teams || []).map((t) =>
          typeof t === "string" ? { name: t } : { name: t.name, display_name: t.display_name || t.displayName }
        );
        return { toolResultContent: packJson({ count: teams.length, teams }), isError: false };
      }
      case "caselist_team_rounds": {
        const raw = await caselistApiGet(
          token,
          `/caselists/${encSeg(input.caselist)}/schools/${encSeg(input.school)}/teams/${encSeg(input.team)}/rounds`
        );
        const allRounds = (Array.isArray(raw) ? raw : raw?.rounds || []).map((r) => ({
          round_id: r.round_id ?? r.id,
          tournament: r.tournament,
          round: r.round,
          side: normSide(r.side),
          opponent: r.opponent,
          judge: r.judge,
          report: capStr(r.report, 1800),
          opensource: r.opensource || null,
        }));
        const { page, start, end, nextOffset } = pageItems(allRounds, input.offset);
        return {
          toolResultContent: packJson({
            total: allRounds.length,
            showing: `${start}-${Math.max(start, end - 1)}`,
            nextOffset,
            note: nextOffset ? "More rounds remain — call again with offset=nextOffset before computing stats." : undefined,
            rounds: page,
          }),
          isError: false,
        };
      }
      case "caselist_team_cites": {
        const raw = await caselistApiGet(
          token,
          `/caselists/${encSeg(input.caselist)}/schools/${encSeg(input.school)}/teams/${encSeg(input.team)}/cites`
        );
        const allCites = (Array.isArray(raw) ? raw : raw?.cites || []).map((c) => ({
          round_id: c.round_id,
          title: c.title,
          cites: capStr(c.cites, 1200),
        }));
        const { page, start, end, nextOffset } = pageItems(allCites, input.offset);
        return {
          toolResultContent: packJson({
            total: allCites.length,
            showing: `${start}-${Math.max(start, end - 1)}`,
            nextOffset,
            note: nextOffset ? "More cites remain — call again with offset=nextOffset." : undefined,
            cites: page,
          }),
          isError: false,
        };
      }
      case "caselist_team_info": {
        const [team, school] = await Promise.all([
          caselistApiGet(token, `/caselists/${encSeg(input.caselist)}/schools/${encSeg(input.school)}/teams/${encSeg(input.team)}`).catch(() => null),
          caselistApiGet(token, `/caselists/${encSeg(input.caselist)}/schools/${encSeg(input.school)}`).catch(() => null),
        ]);
        const t = Array.isArray(team) ? team[0] : team;
        const debaters = [];
        for (let i = 1; i <= 4; i++) {
          const f = t?.[`debater${i}_first`];
          const l = t?.[`debater${i}_last`];
          if (f || l) debaters.push([f, l].filter(Boolean).join(" "));
        }
        return {
          toolResultContent: packJson({
            display_name: t?.display_name || t?.displayName,
            debaters,
            notes: capStr(t?.notes, 2500),
            state: (Array.isArray(school) ? school[0] : school)?.state,
          }),
          isError: false,
        };
      }
      case "caselist_round_document": {
        const docPath = String(input.path || "").trim();
        if (!docPath) {
          return { toolResultContent: "Missing opensource path — get it from caselist_team_rounds first.", isError: true };
        }
        const buf = await caselistApiGetBuffer(token, `/download?path=${encSeg(docPath)}`);
        const ext = (/\.[a-z0-9]+$/i.exec(docPath)?.[0] || "").toLowerCase();
        const text = await extractTextFromBuffer(buf, ext);
        if (text == null) {
          return { toolResultContent: `Can't extract text from this document type (${ext || "unknown"}).`, isError: true };
        }
        const clean = cleanText(text);
        const offset = Math.max(0, Number(input.offset) || 0);
        const chunk = clean.slice(offset, offset + CASELIST_MAX);
        const end = offset + chunk.length;
        const header =
          `${docPath} — chars ${offset}-${end} of ${clean.length}` +
          (end < clean.length ? ` (more remains; next offset ${end})` : " (end of document)");
        return { toolResultContent: `${header}\n\n${chunk}`, isError: false };
      }
      case "caselist_search": {
        const raw = await caselistApiGet(token, `/search?q=${encSeg(input.query)}&shard=${encSeg(input.caselist)}`);
        // Compact each hit (long string fields capped) so 40 results can't
        // blow the packJson cap and truncate mid-array.
        const results = (Array.isArray(raw) ? raw : raw?.results || []).slice(0, 40).map((r) => {
          const out = {};
          for (const [k, v] of Object.entries(r ?? {})) out[k] = typeof v === "string" ? capStr(v, 300) : v;
          return out;
        });
        const { page, nextOffset } = pageItems(results, 0);
        return {
          toolResultContent: packJson({
            count: results.length,
            showing: page.length,
            note: nextOffset ? "result list truncated to fit — refine the query for the rest" : undefined,
            results: page,
          }),
          isError: false,
        };
      }
      default:
        return { toolResultContent: `Unknown caselist tool: ${name}`, isError: true };
    }
  } catch (err) {
    const msg =
      err instanceof CaselistError && err.status === 401
        ? "OpenCaselist session expired — ask the debater to sign in again."
        : `Caselist lookup failed: ${err.message}`;
    return { toolResultContent: msg, isError: true };
  }
}

// --- Tabroom judge paradigm lookup ---------------------------------------
// Judges post their paradigms publicly on Tabroom; this scrapes that lookup
// (no session/token needed, unlike the caselist tools above) so Cross can
// ground round-prep and strategy coaching in a real judge's stated
// preferences instead of guessing from the paradigm reference corpus alone.

export const lookupJudgeParadigmTool = {
  name: "lookup_judge_paradigm",
  description:
    "Look up a judge's paradigm from Tabroom by name or judge_id. Use this when a debater names a specific judge and " +
    "you want their actual stated preferences to ground round-prep or strategy advice. Returns the judge's paradigm " +
    "text and a tabroom_url, or — when a name matches multiple judges — a disambiguation list of {judge_id, name} to " +
    "re-query with judge_id. This is the judge's own public disclosure; you may name and quote it openly.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Judge's full name, e.g. 'Jane Smith'. Provide this or judge_id." },
      judge_id: { type: "string", description: "Tabroom judge_person_id, e.g. from a prior disambiguation result." },
    },
  },
};

export async function runLookupJudgeParadigmTool(toolUseBlock, token) {
  const { name, judge_id } = toolUseBlock.input ?? {};
  if (!name && !judge_id) {
    return { toolResultContent: "Provide a judge name or judge_id.", isError: true };
  }
  try {
    const cacheKey = judgeCacheKey({ judgeId: judge_id, name });
    const cached = await getCachedJudge(cacheKey);
    if (isFresh(cached)) {
      return {
        toolResultContent: packJson({
          judge_id: cached.judge_id,
          name: cached.name,
          paradigm: cached.paradigm_text,
          tabroom_url: cached.tabroom_url,
          source: cached.source,
        }),
        isError: false,
      };
    }
    const result = judge_id ? await lookupJudgeById(judge_id, token) : await lookupJudgeByName(name, token);
    // Read-through: seed the cache with just the paradigm (no Nemotron call
    // from chat tools) so a later /api/judge/summary call for this judge
    // skips the scrape too. Fire-and-forget — doesn't block the tool reply.
    if (result.paradigm?.trim() && !Array.isArray(result.results)) {
      upsertParadigmOnly({
        cacheKey: judgeCacheKey({ judgeId: result.judge_id, name: result.name }),
        judgeId: result.judge_id,
        name: result.name,
        source: result.source,
        tabroomUrl: result.tabroom_url,
        paradigm: result.paradigm,
      }).catch(() => {});
    }
    return { toolResultContent: packJson(result), isError: false };
  } catch (err) {
    const msg = err instanceof TabroomJudgeError ? err.message : `Judge lookup failed: ${err.message}`;
    return { toolResultContent: msg, isError: true };
  }
}

// --- Tabroom scouting tools (judge reports + tournament results) -----------
// Deeper Tabroom pulls than the paradigm lookup above: a judge's full judging
// record with computed decision stats, and tournament-anchored competitor
// results (Tabroom has no student-name search — the scan chain is
// tournament -> entries -> entry record). All public postings data, so like
// the caselist tools it may be named and quoted openly. Authenticated with
// the signed-in debater's own TabroomToken; single page fetch per call.

export const tabroomJudgeReportTool = {
  name: "tabroom_judge_report",
  description:
    "Full judge report from Tabroom: the paradigm PLUS the judge's complete judging record with computed decision " +
    "stats — total rounds and seasons judged, event mix, elim-round share, aff/pro vs neg/con vote split, " +
    "panel-majority rate (how often they were 'squirreled' or sat against the panel), and recent tournaments with " +
    "recent rounds. Prefer this over lookup_judge_paradigm whenever the debater is prepping for a specific named " +
    "judge — the record grounds adaptation advice in how the judge actually votes, not just what they say. When a " +
    "name is ambiguous the result is {results:[{judge_id, name}]}: pick the right one (or ask) and re-query with " +
    "judge_id. Public disclosure data: name the judge and cite the numbers openly.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Judge's full name, e.g. 'Jane Smith'. Provide this or judge_id." },
      judge_id: { type: "string", description: "Tabroom judge_person_id, e.g. from a disambiguation result." },
    },
  },
};

export const tabroomTournamentSearchTool = {
  name: "tabroom_search_tournaments",
  description:
    "Search Tabroom tournaments by name. Returns tourn_id, location, and dates, newest first. First step of a " +
    "Tabroom results scan; an annual tournament returns one instance per season, so pick the tourn_id whose dates " +
    "match the season you're scouting.",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Tournament name or fragment, e.g. 'Glenbrooks'." },
    },
    required: ["query"],
  },
};

export const tabroomTournamentEntriesTool = {
  name: "tabroom_tournament_entries",
  description:
    "List the entries (competitors) at a Tabroom tournament from its public postings, with the entry_id needed for " +
    "tabroom_entry_record. Entry names look like 'MV Jane Doe & John Roe' (school code + student names). Always " +
    "pass filter (school code, school fragment, or student last name) — entry lists run to hundreds. Some " +
    "tournaments anonymize postings; the error will say so.",
  input_schema: {
    type: "object",
    properties: {
      tourn_id: { type: "string", description: "Tournament id from tabroom_search_tournaments." },
      filter: { type: "string", description: "Case-insensitive substring to match entry names against." },
    },
    required: ["tourn_id"],
  },
};

export const tabroomEntryRecordTool = {
  name: "tabroom_entry_record",
  description:
    "A team's full round-by-round record at one Tabroom tournament: per round the side, opponent (with their " +
    "entry_id for chained lookups), judge names, each judge's decision (W/L), and speaker points, plus a computed " +
    "W-L record and the list of judges faced. This is the ACTUAL results data caselist disclosure lacks — use it " +
    "to scan an opponent's past results (who beat them, on which side, in front of what judging), and " +
    "cross-reference judge names with tabroom_judge_report when one of them is judging the upcoming round.",
  input_schema: {
    type: "object",
    properties: {
      tourn_id: { type: "string", description: "Tournament id." },
      entry_id: { type: "string", description: "Entry id from tabroom_tournament_entries (or a prior entry record's opponent_entry_id)." },
    },
    required: ["tourn_id", "entry_id"],
  },
};

export const tabroomResultsTools = [tabroomTournamentSearchTool, tabroomTournamentEntriesTool, tabroomEntryRecordTool];
const TABROOM_TOOL_NAMES = new Set([tabroomJudgeReportTool, ...tabroomResultsTools].map((t) => t.name));
export const isTabroomTool = (name) => TABROOM_TOOL_NAMES.has(name);

/**
 * Executes any tabroom_* tool. `token` is the signed-in debater's Tabroom
 * session token (may be null — Tabroom login is non-fatal at sign-in; the
 * clients surface a friendly re-login message when Tabroom walls the page).
 * Returns { toolResultContent, isError }.
 */
export async function runTabroomTool(toolUseBlock, token) {
  const { name, input = {} } = toolUseBlock;
  try {
    switch (name) {
      case "tabroom_judge_report": {
        if (!input.name && !input.judge_id) {
          return { toolResultContent: "Provide a judge name or judge_id.", isError: true };
        }
        const report = await getJudgeReport({ judgeId: input.judge_id, name: input.name }, token);
        // Keep the packed result inside CASELIST_MAX so the JSON stays parseable.
        if (report.paradigm) report.paradigm = capStr(report.paradigm, 4500);
        if (Array.isArray(report.recent_rounds)) report.recent_rounds = report.recent_rounds.slice(0, 15);
        return { toolResultContent: packJson(report), isError: false };
      }
      case "tabroom_search_tournaments": {
        const result = await searchTournaments(input.query, token);
        return { toolResultContent: packJson(result), isError: false };
      }
      case "tabroom_tournament_entries": {
        const result = await getTournamentEntries(input.tourn_id, token, input.filter);
        return { toolResultContent: packJson(result), isError: false };
      }
      case "tabroom_entry_record": {
        const result = await getEntryRecord(input.tourn_id, input.entry_id, token);
        return { toolResultContent: packJson(result), isError: false };
      }
      default:
        return { toolResultContent: `Unknown tabroom tool: ${name}`, isError: true };
    }
  } catch (err) {
    const msg =
      err instanceof TabroomJudgeError || err instanceof TabroomResultsError
        ? err.message
        : `Tabroom lookup failed: ${err.message}`;
    return { toolResultContent: msg, isError: true };
  }
}

// --- Live web search (chat's on-demand time-sensitive lookup) ------------
// Backs /api/chat's search_corpus/read_corpus_file sibling for anything that
// is provably time-sensitive — current topic wording, recent tournament
// results, a just-changed rule — where the static corpus can't be current.
// Env-gated (needs a search API key); hasWebSearch() is false when
// unconfigured, so /api/chat simply omits the tool. See lib/webSearch.mjs.
//
// Same corpus-privacy contract as the corpus tools: this is silent internal
// retrieval, not a citable source list. The debater must never learn whether
// an answer came from the corpus or the web, so results are handed back for
// grounding only — the model synthesizes in its own words and never repeats
// a URL, title, publish date, or the fact that it searched at all. See the
// web-search system-prompt section in prompt.mjs for the full instruction.
export { hasWebSearch };

export const webSearchTool = {
  name: "web_search",
  description:
    "Silently look up something provably time-sensitive that a static training corpus can't be current on — the " +
    "exact current topic/resolution wording, a recent tournament result, a just-changed rule. NOT for argument " +
    "structure, strategy, evidence quality, or 'what does a strong card look like' — that's corpus/internalized " +
    "judgment territory. Returns real results (title, URL, date, snippet) as grounding material only: synthesize " +
    "into your own words in the reply, never quote a snippet verbatim, and never attribute the fact to any " +
    "source at all — no URL, title, publish date, author, or a vaguer stand-in like 'confirmed by the " +
    "official site' or 'per multiple sources'. This also bans naming the lookup itself, internal or external — " +
    "no 'my search', 'my sources', 'the corpus', or similar. State it flatly, like anything else you know " +
    "(corpus-privacy rule — same silence as search_corpus). Never invent a fact if nothing usable comes " +
    "back — say so plainly instead.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "A focused search query for the current fact you need — include the actor/event and any year " +
          "(e.g. 'current Public Forum resolution September October 2026').",
      },
      maxResults: {
        type: "integer",
        description: "Maximum results to return (default 4, max 8).",
      },
    },
    required: ["query"],
  },
};

export async function runWebSearchTool(toolUseBlock) {
  const { query, maxResults } = toolUseBlock.input ?? {};
  try {
    const results = await webSearch(query, { maxResults: maxResults || 4 });
    if (results.length === 0) {
      return { toolResultContent: `No web results for "${query}". Don't fabricate an answer — tell the debater plainly that you don't have this yet.`, isError: false };
    }
    const text = results
      .map((r, i) => {
        const date = r.publishedDate ? ` (${r.publishedDate})` : "";
        return `[${i + 1}] ${r.title || "Untitled"}${date}\n    URL: ${r.url}\n    Passage: ${r.snippet}`;
      })
      .join("\n\n");
    return {
      toolResultContent:
        `Internal grounding only. State the current fact flatly, with no attribution at all — no URL, title, ` +
        `date, author, or a vaguer stand-in like "confirmed by the official site" or "per multiple sources," and ` +
        `no mention that this was searched — and no name for the lookup itself either, internal or external ` +
        `("my search", "my sources", "the corpus," etc.):\n\n${text}`,
      isError: false,
    };
  } catch (err) {
    return { toolResultContent: `Web search failed: ${err.message}. Don't invent a fact — tell the debater plainly that you don't have this yet.`, isError: true };
  }
}

// --- OpenCaselist scouting tools (opponent disclosure) -------------------
// These let Cross scout a team from the OpenCaselist wiki DURING coaching —
