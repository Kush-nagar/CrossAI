// Live web search for the stress test's attack-evidence cards.
//
// When a full stress test predicts an opponent attack, the debater needs a
// REAL source to go cut, not a plausible-sounding but invented cite. This
// module fetches genuine web results so the model can quote and attribute
// evidence that actually exists.
//
// Provider: Tavily (https://tavily.com) — a search API built for LLM
// grounding; it returns clean, quotable snippets plus source URLs and, when
// available, publish dates. Gated behind TAVILY_API_KEY: unset means the
// stress test simply falls back to archive-only grounding (no error), exactly
// like the Supabase/Groq/Hume optional integrations elsewhere in the app.
//
// Follows the same shape as the other external clients: a typed *Error class
// carrying .status, and no key retained past the call.

const TAVILY_ENDPOINT = "https://api.tavily.com/search";

export class WebSearchError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "WebSearchError";
    this.status = status;
  }
}

export function hasWebSearch() {
  return Boolean(process.env.TAVILY_API_KEY);
}

/**
 * Runs one web search and returns real, citable results.
 * @returns {Promise<Array<{title,url,publishedDate,snippet}>>}
 * Throws WebSearchError on a hard failure; the caller (a tool runner) reports
 * that back to the model as a tool error rather than crashing the audit.
 */
export async function webSearch(query, { maxResults = 4 } = {}) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) throw new WebSearchError("Web search is not configured (TAVILY_API_KEY unset).", 503);
  if (typeof query !== "string" || !query.trim()) throw new WebSearchError("query is required", 400);

  let res;
  try {
    res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query: query.trim(),
        // "advanced" returns tighter, more quotable snippets — worth the extra
        // latency here since each snippet becomes card body a debater reads.
        search_depth: "advanced",
        max_results: Math.max(1, Math.min(8, maxResults)),
        include_answer: false,
        include_raw_content: false,
      }),
    });
  } catch (err) {
    throw new WebSearchError(`Web search request failed: ${err.message}`, 502);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new WebSearchError(`Web search returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`, res.status);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new WebSearchError("Web search returned a non-JSON response.", 502);
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  return results.slice(0, maxResults).map((r) => ({
    title: String(r?.title || "").trim(),
    url: String(r?.url || "").trim(),
    publishedDate: String(r?.published_date || "").trim() || null,
    snippet: String(r?.content || "").replace(/\s+/g, " ").trim().slice(0, 1200),
  }));
}
