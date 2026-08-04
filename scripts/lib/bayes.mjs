// Transparent heuristic Bayesian ledger for drill scoring.
//
// Win-probability estimates start from a prior, add a log-odds adjustment per
// applicable factor (weights come from training-data/reference/
// factor-weights.md), and convert back to a probability. The arithmetic lives
// here — server-side, deterministic — so the model only ever picks factors
// and weights; it never does the math itself. The resulting numbers are
// structured judgment, not statistics: useful for comparing moves against
// each other, not for claiming a real-world win rate.

// Any single factor beyond this range is almost certainly a model mistake
// (the reference table tops out at ±1.4), so clamp rather than let one wild
// adjustment saturate the probability.
const MAX_FACTOR_ADJUSTMENT = 2.5;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toLogOdds(p) {
  return Math.log(p / (1 - p));
}

function toProbability(logOdds) {
  return 1 / (1 + Math.exp(-logOdds));
}

// Normalizes one model-produced factor entry: { name, adjustment, why? }.
// Returns null for entries too malformed to score.
function sanitizeFactor(factor) {
  if (!factor || typeof factor !== "object") return null;
  const adjustment = Number(factor.adjustment);
  if (!Number.isFinite(adjustment)) return null;
  return {
    name: typeof factor.name === "string" ? factor.name : "Unnamed factor",
    adjustment: clamp(adjustment, -MAX_FACTOR_ADJUSTMENT, MAX_FACTOR_ADJUSTMENT),
    why: typeof factor.why === "string" ? factor.why : "",
  };
}

/**
 * Scores one ledger: prior + per-factor log-odds adjustments → probability.
 * Returns { prior, factors, logOdds, probability } with probability kept off
 * the exact 0/1 poles (heuristic estimates should never read as certainty).
 */
export function scoreLedger({ prior = 0.5, factors = [] } = {}) {
  const safePrior = clamp(Number.isFinite(Number(prior)) ? Number(prior) : 0.5, 0.05, 0.95);
  const safeFactors = (Array.isArray(factors) ? factors : []).map(sanitizeFactor).filter(Boolean);
  const logOdds = safeFactors.reduce((sum, f) => sum + f.adjustment, toLogOdds(safePrior));
  return {
    prior: safePrior,
    factors: safeFactors,
    logOdds,
    probability: clamp(toProbability(logOdds), 0.02, 0.98),
  };
}

/** Scores several candidate moves and marks the highest-probability one optimal. */
export function scoreMoves(moves = []) {
  const scored = (Array.isArray(moves) ? moves : [])
    .filter((m) => m && typeof m === "object")
    .map((move) => ({
      name: typeof move.name === "string" ? move.name : "Unnamed move",
      description: typeof move.description === "string" ? move.description : "",
      ...scoreLedger(move),
    }));
  let best = null;
  for (const move of scored) {
    if (!best || move.probability > best.probability) best = move;
  }
  return scored.map((move) => ({ ...move, optimal: move === best }));
}
