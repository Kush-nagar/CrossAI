// DEV-ONLY functional-test routes. Never mounted in production (the caller
// checks NODE_ENV) and every request must originate from the loopback
// interface — checked against the raw socket address, not X-Forwarded-For,
// so it cannot be spoofed through a proxy.
//
// Purpose: let a localhost test harness (curl / scripts) exercise the
// authenticated API surface using a session the user created by signing in
// normally in their browser. The OpenCaselist token never leaves the process:
// the harness only ever receives a fresh signed session cookie.

import { readSession, devCloneLatestSession } from "./session.mjs";
import { apiGet } from "./caselistClient.mjs";

// Hot-reload tools.mjs on every self-test call (cache-busted dynamic import)
// so scraping-layer fixes can be exercised without a server restart. Only the
// dev harness does this; production routes keep their boot-time import.
async function freshCaselistRunner() {
  const mod = await import(`./tools.mjs?bust=${Date.now()}`);
  return mod.runCaselistTool;
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function loopbackOnly(req, res, next) {
  if (!LOOPBACK.has(req.socket.remoteAddress)) {
    res.status(403).json({ error: "Dev routes are localhost-only." });
    return;
  }
  next();
}

export function mountDevTestRoutes(app) {
  // Defense in depth: the caller already checks NODE_ENV, but these routes
  // mint session cookies, so refuse to mount in production even if a future
  // refactor drops that check.
  if (process.env.NODE_ENV === "production") {
    throw new Error("devTestRoutes must never be mounted in production.");
  }
  // Mint a test session cloned from the most recent live one. The user signs
  // in via the browser first; the harness then calls this to get its own
  // cookie. Body contains only the cookie pair and username — no token.
  app.get("/api/dev/test-session", loopbackOnly, async (req, res) => {
    const userId = await devCloneLatestSession(res);
    if (!userId) {
      res.status(409).json({ error: "No live session to clone — sign in at localhost:3000 first." });
      return;
    }
    // createSession already set the Set-Cookie header; echo it for curl use.
    const setCookie = res.getHeader("Set-Cookie");
    const pair = String(Array.isArray(setCookie) ? setCookie[setCookie.length - 1] : setCookie).split(";")[0];
    res.json({ ok: true, userId, cookie: pair });
  });

  // Fetch a single Tabroom page through the session's TabroomToken and return
  // the raw HTML. For developing/debugging Tabroom scrapers against pages the
  // site gates behind login (paradigm search, results) without ever exposing
  // the token itself. Path must be site-relative, e.g.
  //   /api/dev/tabroom-fetch?path=%2Findex%2Fparadigm.mhtml%3Fjudge_person_id%3D12345
  app.get("/api/dev/tabroom-fetch", loopbackOnly, async (req, res) => {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: "No session cookie — mint one via /api/dev/test-session." });
      return;
    }
    const path = String(req.query.path || "");
    if (!path.startsWith("/")) {
      res.status(400).json({ error: "path must be a site-relative Tabroom path starting with /" });
      return;
    }
    try {
      const headers = {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      };
      if (session.tabroomToken) headers.cookie = `TabroomToken=${encodeURIComponent(session.tabroomToken)}`;
      const r = await fetch(`https://www.tabroom.com${path}`, { headers });
      res.type("text/plain").status(200).send(await r.text());
    } catch (err) {
      res.status(502).json({ error: `Tabroom fetch failed: ${err.message}` });
    }
  });

  // Tabroom scraping self-test: exercises the judge-report and results-scan
  // tool chain with the session's TabroomToken via the production runner
  // (hot-reloaded like the caselist selftest, so scraper fixes can be
  // exercised without a restart). Query params:
  //   ?judge=<name>            judge report by name
  //   &tournament=<name>       tournament search, then entries + first entry's
  //   &filter=<entry filter>   record when filter matches something
  app.get("/api/dev/tabroom-selftest", loopbackOnly, async (req, res) => {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: "No session cookie — mint one via /api/dev/test-session." });
      return;
    }
    const token = session.tabroomToken;
    const report = {};
    const mod = await import(`./tools.mjs?bust=${Date.now()}`);
    const run = async (name, input) => {
      const t0 = Date.now();
      const r = await mod.runTabroomTool({ name, input }, token);
      let parsed = null;
      try {
        parsed = JSON.parse(r.toolResultContent);
      } catch {
        parsed = null;
      }
      report[name] = { ok: !r.isError, ms: Date.now() - t0, input, result: parsed ?? String(r.toolResultContent).slice(0, 2000) };
      return parsed;
    };

    try {
      if (req.query.judge) {
        const judge = await run("tabroom_judge_report", { name: String(req.query.judge) });
        if (judge?.results?.length) {
          await run("tabroom_judge_report", { judge_id: judge.results[0].judge_id });
        }
      }
      if (req.query.tournament) {
        const search = await run("tabroom_search_tournaments", { query: String(req.query.tournament) });
        const tournId = search?.tournaments?.[0]?.tourn_id;
        if (tournId) {
          const entries = await run("tabroom_tournament_entries", {
            tourn_id: tournId,
            filter: req.query.filter ? String(req.query.filter) : undefined,
          });
          const entryId = entries?.entries?.[0]?.entry_id;
          if (entryId) await run("tabroom_entry_record", { tourn_id: tournId, entry_id: entryId });
        }
      }
      res.json({ userId: session.userId, hasTabroomToken: Boolean(token), report });
    } catch (err) {
      res.status(500).json({ userId: session.userId, error: err.message, report });
    }
  });

  // Deterministic caselist scraping self-test: walks the full tool chain
  // (events -> schools -> teams -> rounds -> cites -> info -> document ->
  // search) with the session's token, via the exact production runners.
  // Query params: ?school=<name filter>&team=<slug or blank for first>.
  app.get("/api/dev/caselist-selftest", loopbackOnly, async (req, res) => {
    const session = await readSession(req);
    if (!session) {
      res.status(401).json({ error: "No session cookie — mint one via /api/dev/test-session." });
      return;
    }
    const token = session.caselistToken;
    const schoolQuery = String(req.query.school || "");
    const teamWanted = String(req.query.team || "");
    const slugWanted = String(req.query.slug || "");
    const report = {};
    const runCaselistTool = await freshCaselistRunner();
    const run = async (name, input) => {
      const t0 = Date.now();
      const r = await runCaselistTool({ name, input }, token);
      let parsed = null;
      try {
        parsed = JSON.parse(r.toolResultContent);
      } catch {
        parsed = null; // document chunks are plain text — keep raw
      }
      report[name] = {
        ok: !r.isError,
        ms: Date.now() - t0,
        input,
        result: parsed ?? String(r.toolResultContent).slice(0, 2000),
      };
      return parsed ?? r.toolResultContent;
    };

    try {
      // 1. events -> HS PF caselist slug (?slug= overrides; default newest)
      const events = await run("caselist_events", { event: "pf", level: "hs" });
      const slug = slugWanted || events?.caselists?.[0]?.slug;
      if (!slug) throw new Error("no PF caselist slug resolved");

      // 2. schools (filtered)
      const schools = await run("caselist_schools", { caselist: slug, query: schoolQuery });
      const school = schools?.schools?.[0]?.name;
      if (!school) throw new Error(`no school matched "${schoolQuery}" on ${slug}`);

      // 3. teams
      const teams = await run("caselist_teams", { caselist: slug, school });
      const team =
        (teamWanted && teams?.teams?.find((t) => String(t.name).toLowerCase() === teamWanted.toLowerCase())?.name) ||
        teams?.teams?.[0]?.name;
      if (!team) throw new Error(`school ${school} has no teams`);

      // 4-6. rounds (walk ALL pages), cites, info
      let allRounds = [];
      let offset = 0;
      for (let pageN = 0; pageN < 30; pageN++) {
        const pageRes = await run("caselist_team_rounds", { caselist: slug, school, team, offset });
        allRounds = allRounds.concat(pageRes?.rounds || []);
        if (pageRes?.nextOffset == null) break;
        offset = pageRes.nextOffset;
      }
      report.rounds_paging = { totalCollected: allRounds.length, sides: [...new Set(allRounds.map((r) => r.side))] };
      await run("caselist_team_cites", { caselist: slug, school, team });
      await run("caselist_team_info", { caselist: slug, school, team });

      // Raw field-name check straight off the API (bypasses the mapper) so a
      // renamed field can't silently null a column like `opensource`.
      const rawRounds = await apiGet(
        token,
        `/caselists/${encodeURIComponent(slug)}/schools/${encodeURIComponent(school)}/teams/${encodeURIComponent(team)}/rounds`
      );
      const rawFirst = (Array.isArray(rawRounds) ? rawRounds : rawRounds?.rounds || [])[0];
      report.raw_round_keys = rawFirst ? Object.keys(rawFirst) : [];

      // 7. round document — first opensource doc on this team, else scan the
      // school's other teams so the download path still gets exercised.
      let docPath = allRounds.find((r) => r.opensource)?.opensource || null;
      let docTeam = docPath ? team : null;
      if (!docPath) {
        for (const t of (teams?.teams || []).slice(0, 10)) {
          if (t.name === team) continue;
          const tr = await apiGet(
            token,
            `/caselists/${encodeURIComponent(slug)}/schools/${encodeURIComponent(school)}/teams/${encodeURIComponent(t.name)}/rounds`
          );
          const hit = (Array.isArray(tr) ? tr : tr?.rounds || []).find((r) => r.opensource);
          if (hit) {
            docPath = hit.opensource;
            docTeam = t.name;
            break;
          }
        }
      }
      if (docPath) {
        report.opensource_doc_from_team = docTeam;
        await run("caselist_round_document", { path: docPath });
      } else {
        report.caselist_round_document = { ok: null, skipped: "no opensource doc on any of this school's first 10 teams" };
      }

      // 8. search
      await run("caselist_search", { caselist: slug, query: schoolQuery || school });

      res.json({ userId: session.userId, chain: { slug, school, team }, report });
    } catch (err) {
      res.status(500).json({ userId: session.userId, error: err.message, report });
    }
  });
}
