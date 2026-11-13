// Per-request user identity, carried implicitly through async calls.
//
// Several modules (voiceProfile, feedback, delivery, fileGen) began life as
// single-user CLI features writing one shared JSON file / directory. On the
// hosted app that meant every account read and wrote the SAME voice profile,
// feedback log and delivery history — one user's data leaking into another's
// prompts and screens. Rather than thread a userId through every function
// signature, server.mjs binds the signed-in user here (runWithUser) once the
// session is resolved, and those modules ask userDataPath()/userSubdir() for
// a per-user location.
//
// Outside a request (CLI scripts, `npm run chat`) there is no user: dev keeps
// the original root-level files; production refuses to fall back to a shared
// file and uses an isolated "_anonymous" bucket instead.

import { AsyncLocalStorage } from "node:async_hooks";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");

export const USER_DATA_DIR = path.join(ROOT, "user-data");
const IS_PROD = process.env.NODE_ENV === "production";
// Supabase auth user ids are UUIDs. Validated before ever touching a path so
// a malformed id can't escape its directory.
const USER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const als = new AsyncLocalStorage();

export function isValidUserId(userId) {
  return typeof userId === "string" && USER_ID_RE.test(userId);
}

/** Runs fn with userId bound as the current user for everything it awaits. */
export function runWithUser(userId, fn) {
  return als.run({ userId: isValidUserId(userId) ? userId : null }, fn);
}

/** Express middleware: binds req.session.userId for the rest of the request. */
export function bindUser(req, res, next) {
  runWithUser(req.session?.userId, next);
}

export function currentUserId() {
  return als.getStore()?.userId ?? null;
}

/**
 * Per-user directory name for the current request, or null outside a request
 * in dev (callers then use their legacy shared location).
 */
export function userSubdir() {
  const id = currentUserId();
  if (id) return id;
  return IS_PROD ? "_anonymous" : null;
}

/** Absolute path for a per-user data file, e.g. userDataPath("feedback.json"). */
export function userDataPath(fileName) {
  const sub = userSubdir();
  return sub ? path.join(USER_DATA_DIR, sub, fileName) : path.join(ROOT, fileName);
}

/** writeFile that creates the parent directory first. */
export async function writeUserFile(absPath, data) {
  await fs.mkdir(path.dirname(absPath), { recursive: true });
  await fs.writeFile(absPath, data, "utf8");
}
