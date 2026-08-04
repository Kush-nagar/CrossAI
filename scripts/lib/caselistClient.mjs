// Client for the official OpenCaselist REST API (https://api.opencaselist.com).
//
// OpenCaselist auth is backed by Tabroom: POST /login with a debater's Tabroom
// username/password returns a `caselist_token` session cookie, and every wiki
// resource is a normal authenticated GET carrying that cookie. We use this
// sanctioned API rather than scraping HTML — it's stable, structured, and
// on the right side of the community's terms.
//
// Credential handling: the password is used exactly once, here, to obtain the
// token. It is never stored or logged. Only the returned token is kept (in the
// server-side session store — see session.mjs), never sent to the browser.

const API_BASE = (process.env.CASELIST_API_BASE || "https://api.opencaselist.com/v1").replace(/\/+$/, "");
const USER_AGENT = "Cross-Debate-Assistant (+https://github.com/; contact: app owner)";

export class CaselistError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "CaselistError";
    this.status = status;
  }
}

// Pulls the caselist_token value out of the Set-Cookie header(s) on the
// /login response. Node's undici fetch exposes getSetCookie(); fall back to
// the combined header string if it's unavailable.
function extractToken(res) {
  let cookies = [];
  if (typeof res.headers.getSetCookie === "function") {
    cookies = res.headers.getSetCookie();
  } else {
    const raw = res.headers.get("set-cookie");
    if (raw) cookies = [raw];
  }
  for (const c of cookies) {
    const m = /(?:^|[,;\s])caselist_token=([^;,\s]+)/.exec(c);
    if (m) return decodeURIComponent(m[1]);
  }
  return null;
}

/**
 * Authenticate a debater's Tabroom credentials against OpenCaselist.
 * Returns the caselist_token on success; throws CaselistError otherwise.
 * The password is not retained past this call.
 */
export async function login(username, password, remember = true) {
  let res;
  try {
    res = await fetch(`${API_BASE}/login`, {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": USER_AGENT },
      body: JSON.stringify({ username, password, remember: Boolean(remember) }),
    });
  } catch (err) {
    throw new CaselistError(`Couldn't reach OpenCaselist: ${err.message}`, 502);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CaselistError("Tabroom login failed — check your username and password.", 401);
  }
  if (!res.ok) {
    throw new CaselistError(`OpenCaselist login error (HTTP ${res.status}).`, res.status);
  }

  const token = extractToken(res);
  if (!token) {
    throw new CaselistError("Login succeeded but no session token was returned by OpenCaselist.", 502);
  }
  return token;
}

/**
 * Authenticated GET against the OpenCaselist API. `relPath` must be a leading-
 * slash path (already URL-encoded by the caller); it is appended to the fixed
 * API base, so there is no open-redirect / SSRF surface. Returns parsed JSON.
 * Throws CaselistError with `.status` (401 signals an expired token → re-login).
 */
export async function apiGet(token, relPath) {
  if (!token) throw new CaselistError("Not authenticated with OpenCaselist.", 401);
  if (typeof relPath !== "string" || !relPath.startsWith("/")) {
    throw new CaselistError("Invalid caselist path.", 400);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${relPath}`, {
      headers: {
        cookie: `caselist_token=${encodeURIComponent(token)}`,
        "user-agent": USER_AGENT,
        accept: "application/json",
      },
    });
  } catch (err) {
    throw new CaselistError(`Couldn't reach OpenCaselist: ${err.message}`, 502);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CaselistError("Your OpenCaselist session expired — sign in again.", 401);
  }
  if (res.status === 404) {
    throw new CaselistError("Not found on the caselist.", 404);
  }
  if (!res.ok) {
    throw new CaselistError(`OpenCaselist error (HTTP ${res.status}).`, res.status);
  }

  try {
    return await res.json();
  } catch {
    throw new CaselistError("OpenCaselist returned an unreadable response.", 502);
  }
}

/**
 * Authenticated GET returning the raw body as a Buffer — for the /download
 * endpoint that serves teams' open-source disclosure documents (docx/pdf).
 * Same fixed-base/leading-slash rules as apiGet, so no open-proxy surface.
 */
export async function apiGetBuffer(token, relPath) {
  if (!token) throw new CaselistError("Not authenticated with OpenCaselist.", 401);
  if (typeof relPath !== "string" || !relPath.startsWith("/")) {
    throw new CaselistError("Invalid caselist path.", 400);
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${relPath}`, {
      headers: {
        cookie: `caselist_token=${encodeURIComponent(token)}`,
        "user-agent": USER_AGENT,
      },
    });
  } catch (err) {
    throw new CaselistError(`Couldn't reach OpenCaselist: ${err.message}`, 502);
  }

  if (res.status === 401 || res.status === 403) {
    throw new CaselistError("Your OpenCaselist session expired — sign in again.", 401);
  }
  if (res.status === 404) {
    throw new CaselistError("Document not found on the caselist.", 404);
  }
  if (!res.ok) {
    throw new CaselistError(`OpenCaselist error (HTTP ${res.status}).`, res.status);
  }

  return Buffer.from(await res.arrayBuffer());
}
