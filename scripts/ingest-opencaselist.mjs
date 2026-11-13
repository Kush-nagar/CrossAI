#!/usr/bin/env node
// Pulls open-source Public Forum round docs from openCaselist into the public
// card archive (training-data/cases/pf-archive/<season>/<cycle>/*.md), in the
// same format the existing archive uses, so `npm run build-card-index` turns
// them into searchable individual cards.
//
// RUN THIS ON YOUR OWN COMPUTER, with your own Tabroom.com login. openCaselist
// requires a signed-in account for every request; the password is used once
// to get a session token and is never written anywhere.
//
//   node scripts/ingest-opencaselist.mjs --list                  # show PF caselists
//   node scripts/ingest-opencaselist.mjs --caselist hspf25       # ingest one caselist
//   node scripts/ingest-opencaselist.mjs --caselist hspf25 --limit 50 --dry-run
//
// Options:
//   --caselist <slug>   caselist to ingest (see --list). Repeatable.
//   --season <YYYY-YYYY> override the season label (default: from the slug's year)
//   --school <name>     only this school (repeatable; matches name or display name)
//   --limit <n>         stop after n new documents
//   --delay <ms>        pause between API requests (default 1500 — be polite)
//   --dry-run           list what would be downloaded, write nothing
//
// Credentials: prompted interactively, or set CASELIST_USERNAME and
// CASELIST_PASSWORD (or CASELIST_TOKEN to reuse a session token).
//
// Resumable: progress is kept in scripts/opencaselist-state.json (gitignored)
// and existing output files are skipped, so you can stop and re-run any time.
//
// Be a good citizen: openCaselist is a free community service. Keep the
// default delay, ingest one caselist at a time, and respect openCaselist's
// terms of use. Every doc ingested here was disclosed open-source by its team.

import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { fileURLToPath } from "node:url";
import { login, apiGet, apiGetBuffer, CaselistError } from "./lib/caselistClient.mjs";
import { extractTextFromBuffer, cleanText } from "./lib/extract.mjs";
import { parseCards } from "./lib/cardParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const ARCHIVE = path.join(ROOT, "training-data", "cases", "pf-archive");
const STATE_PATH = path.join(__dirname, "opencaselist-state.json");
const TOPICS_PATH = path.join(__dirname, "data", "pf-topics.json");
const SUPPORTED_EXTS = new Set([".docx", ".pdf"]);

// ------------------------------------------------------------------ args ---
function parseArgs(argv) {
  const opts = { caselists: [], schools: [], limit: Infinity, delay: 1500, dryRun: false, list: false, season: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === "--caselist") opts.caselists.push(next());
    else if (a === "--school") opts.schools.push(next().toLowerCase());
    else if (a === "--limit") opts.limit = Number(next()) || Infinity;
    else if (a === "--delay") opts.delay = Math.max(500, Number(next()) || 1500);
    else if (a === "--season") opts.season = next();
    else if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--list") opts.list = true;
    else if (a === "--help" || a === "-h") opts.help = true;
    else throw new Error(`Unknown option: ${a}`);
  }
  return opts;
}

// ----------------------------------------------------------------- utils ---
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ask(question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      rl._writeToOutput = (s) => {
        if (s.includes(question)) rl.output.write(s);
        else rl.output.write("*");
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer.trim());
    });
  });
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 110);
}

// PF topics rotate by month; map a date to the topic cycle it was debated on.
function cycleForDate(iso) {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return "unsorted";
  const m = d.getUTCMonth() + 1;
  if (m === 9 || m === 10) return "september-october";
  if (m === 11 || m === 12) return "november-december";
  if (m === 1) return "january";
  if (m === 2) return "february";
  if (m === 3) return "march";
  if (m === 4 || m === 5) return "april";
  if (m === 6) return "nationals";
  return "unsorted";
}

function seasonForSlug(slug) {
  const m = /(\d{2})$/.exec(slug);
  if (!m) return null;
  const start = 2000 + Number(m[1]);
  return `${start}-${start + 1}`;
}

function normSide(s) {
  const v = String(s || "").toLowerCase();
  if (v.startsWith("a") || v.startsWith("p")) return "Pro"; // Aff/Pro
  if (v.startsWith("n") || v.startsWith("c")) return "Con"; // Neg/Con
  return "";
}

const yamlStr = (s) => JSON.stringify(String(s ?? ""));

async function loadJson(p, fallback) {
  try {
    return JSON.parse(await fs.readFile(p, "utf8"));
  } catch {
    return fallback;
  }
}

// ------------------------------------------------------------------- api ---
function makeClient(token, delay) {
  let last = 0;
  async function paced(fn) {
    const wait = last + delay - Date.now();
    if (wait > 0) await sleep(wait);
    for (let attempt = 0; ; attempt++) {
      last = Date.now();
      try {
        return await fn();
      } catch (err) {
        const status = err instanceof CaselistError ? err.status : 0;
        if (status === 401 || status === 403) throw err;
        if (attempt >= 3 || (status && status < 500 && status !== 429)) throw err;
        const backoff = delay * 2 ** (attempt + 1);
        console.warn(`  retrying after ${status || "network error"} in ${Math.round(backoff / 1000)}s`);
        await sleep(backoff);
      }
    }
  }
  return {
    get: (p) => paced(() => apiGet(token, p)),
    buffer: (p) => paced(() => apiGetBuffer(token, p)),
  };
}

const enc = encodeURIComponent;

// ------------------------------------------------------------------ main ---
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || (!opts.list && opts.caselists.length === 0)) {
    console.log(
      "Usage: node scripts/ingest-opencaselist.mjs --list | --caselist <slug> [--season YYYY-YYYY] [--school name] [--limit n] [--dry-run]"
    );
    return;
  }

  let token = process.env.CASELIST_TOKEN || "";
  if (!token) {
    const username = process.env.CASELIST_USERNAME || (await ask("Tabroom username (email): "));
    const password = process.env.CASELIST_PASSWORD || (await ask("Tabroom password (not stored): ", { hidden: true }));
    token = await login(username, password, false);
    console.log("Signed in to openCaselist.");
  }
  const api = makeClient(token, opts.delay);

  if (opts.list) {
    const lists = [
      ...(await api.get("/caselists").catch(() => [])),
      ...(await api.get("/caselists?archived=true").catch(() => [])),
    ];
    const pf = lists.filter((c) => /pf|public forum/i.test(`${c.event} ${c.name} ${c.display_name}`));
    const seen = new Set();
    for (const c of pf.sort((a, b) => (b.year || 0) - (a.year || 0))) {
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      console.log(`${c.name.padEnd(14)} ${String(c.year || "").padEnd(6)} ${c.level || ""} ${c.display_name || ""}${c.archived ? " (archived)" : ""}`);
    }
    return;
  }

  const topics = await loadJson(TOPICS_PATH, {});
  const state = await loadJson(STATE_PATH, { done: {} });
  let added = 0;
  let skipped = 0;
  let failed = 0;
  let noCards = 0;

  for (const caselist of opts.caselists) {
    const season = opts.season || seasonForSlug(caselist);
    if (!season) throw new Error(`Can't tell the season from "${caselist}" — pass --season YYYY-YYYY.`);
    console.log(`\n== ${caselist} (${season})`);
    let schools = await api.get(`/caselists/${enc(caselist)}/schools`);
    schools = (schools || []).map((s) => (typeof s === "string" ? { name: s, display_name: s } : s));
    if (opts.schools.length) {
      schools = schools.filter((s) =>
        opts.schools.some((q) => `${s.name} ${s.display_name || s.displayName || ""}`.toLowerCase().includes(q))
      );
    }
    console.log(`${schools.length} schools`);

    for (const school of schools) {
      if (added >= opts.limit) break;
      const schoolName = school.display_name || school.displayName || school.name;
      let teams;
      try {
        teams = await api.get(`/caselists/${enc(caselist)}/schools/${enc(school.name)}/teams`);
      } catch (err) {
        console.warn(`  ${schoolName}: could not list teams (${err.message})`);
        continue;
      }
      for (const team of teams || []) {
        if (added >= opts.limit) break;
        const teamName = team.display_name || team.displayName || team.name;
        let rounds;
        try {
          rounds = await api.get(`/caselists/${enc(caselist)}/schools/${enc(school.name)}/teams/${enc(team.name)}/rounds`);
        } catch (err) {
          console.warn(`  ${teamName}: could not list rounds (${err.message})`);
          continue;
        }
        for (const round of rounds || []) {
          if (added >= opts.limit) break;
          const docPath = round.opensource;
          if (!docPath) continue;
          const ext = (/\.[a-z0-9]+$/i.exec(docPath)?.[0] || "").toLowerCase();
          if (!SUPPORTED_EXTS.has(ext)) continue;
          if (state.done[docPath]) {
            skipped++;
            continue;
          }

          const side = normSide(round.side);
          const cycle = cycleForDate(round.created_at || round.createdAt || round.updated_at);
          const resolution = topics?.[season]?.[cycle] || "";
          const base = slugify(`${teamName}-${side || "x"}-${round.tournament || "tournament"}-${round.round || ""}`);
          const outDir = path.join(ARCHIVE, season, cycle);
          const outPath = path.join(outDir, `${base}.md`);

          if (opts.dryRun) {
            console.log(`  would ingest: ${teamName} ${side} — ${round.tournament} ${round.round || ""} -> ${path.relative(ROOT, outPath)}`);
            added++;
            continue;
          }
          try {
            await fs.access(outPath);
            state.done[docPath] = path.relative(ROOT, outPath);
            skipped++;
            continue;
          } catch {
            // not there yet — ingest it
          }

          let text;
          try {
            const buf = await api.buffer(`/download?path=${enc(docPath)}`);
            text = await extractTextFromBuffer(buf, ext);
          } catch (err) {
            console.warn(`  ${teamName} ${round.tournament}: download failed (${err.message})`);
            failed++;
            continue;
          }
          if (!text) {
            failed++;
            continue;
          }
          const body = cleanText(text);
          const cardCount = parseCards(body).length;
          if (cardCount === 0) {
            // Analytics-only docs or unreadable formatting: nothing to card.
            state.done[docPath] = "no-cards";
            noCards++;
            continue;
          }

          const tournament = String(round.tournament || "").trim();
          const md = [
            "---",
            `title: ${yamlStr(`${teamName} (${side || "?"}) — ${tournament}${round.round ? ` ${round.round}` : ""}, ${season} ${cycle} PF case`)}`,
            `tags: [case, public-forum, pf-archive, opencaselist, season-${season}, cycle-${cycle}${side ? `, side-${side.toLowerCase()}` : ""}]`,
            `team: ${yamlStr(teamName)}`,
            `school: ${yamlStr(schoolName)}`,
            `season: ${season}`,
            `cycle: ${cycle}`,
            `resolution: ${yamlStr(resolution)}`,
            `side: ${side}`,
            `tournaments: ${JSON.stringify(tournament ? [tournament] : [])}`,
            `round: ${yamlStr(round.round || "")}`,
            `source: opencaselist`,
            `caselist: ${caselist}`,
            `source_doc: ${yamlStr(path.basename(docPath))}`,
            "---",
            "",
            `Open-source round doc disclosed on openCaselist by ${teamName} (${side || "side unknown"}), ${tournament}${round.round ? ` ${round.round}` : ""}, ${season} PF.`,
            "",
            body,
            "",
          ].join("\n");
          await fs.mkdir(outDir, { recursive: true });
          await fs.writeFile(outPath, md, "utf8");
          state.done[docPath] = path.relative(ROOT, outPath);
          added++;
          console.log(`  + ${teamName} ${side} — ${tournament} ${round.round || ""} (${cardCount} cards)`);
          if (added % 10 === 0) await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 1));
        }
      }
    }
  }

  if (!opts.dryRun) await fs.writeFile(STATE_PATH, JSON.stringify(state, null, 1));
  console.log(
    `\nDone. ${opts.dryRun ? "Would add" : "Added"} ${added}, skipped ${skipped} already ingested, ${noCards} had no cards, ${failed} failed.`
  );
  if (!opts.dryRun && added) console.log("Next: npm run build-card-index  (then commit training-data/ and push)");
}

main().catch((err) => {
  console.error(err instanceof CaselistError && err.status === 401 ? "openCaselist rejected the login or token." : err.message);
  process.exit(1);
});
