import type {
  IRTParams,
  AbilityEstimate,
  Item,
  CEFRLevel,
  ModuleResult,
} from "@/lib/types";

/**
 * Item Response Theory (IRT) engine for EngLearn.
 *
 * Uses the 3-parameter logistic (3PL) model:
 *   - a: discrimination (slope)
 *   - b: difficulty (location on the logit scale, ~ -3..3)
 *   - c: pseudo-guessing lower asymptote (default 0)
 *
 * Ability (theta) is estimated with Expected A Posteriori (EAP) over a
 * discrete grid using a standard-normal prior. Adaptive item selection picks
 * the unused item maximizing Fisher information at the current theta.
 */

// Numerical floor to keep probabilities/divisors strictly inside (0, 1).
const EPS = 1e-9;

/**
 * 3PL probability of a correct response.
 *   P(theta) = c + (1 - c) / (1 + exp(-a*(theta - b)))
 */
export function probabilityCorrect(theta: number, irt: IRTParams): number {
  const c = irt.c ?? 0;
  return c + (1 - c) / (1 + Math.exp(-irt.a * (theta - irt.b)));
}

/**
 * Fisher information contributed by a single item at a given theta.
 *   I(theta) = a^2 * (Q/P) * ((P - c)/(1 - c))^2
 * where P = probabilityCorrect, Q = 1 - P.
 *
 * Guards against divide-by-zero when P -> 0 (so Q/P blows up) or c -> 1.
 */
export function fisherInformation(theta: number, irt: IRTParams): number {
  const c = irt.c ?? 0;
  const P = probabilityCorrect(theta, irt);
  const Q = 1 - P;

  // P can never truly hit 0 unless a*(theta-b) -> -inf, but clamp defensively.
  if (P <= EPS) return 0;
  // If c is (numerically) 1 the item carries no information.
  const denom = 1 - c;
  if (denom <= EPS) return 0;

  const ratio = (P - c) / denom;
  return irt.a ** 2 * (Q / P) * ratio ** 2;
}

/**
 * Expected A Posteriori (EAP) ability estimation.
 *
 * Grid: theta in [-4, 4] step 0.1. Prior: standard normal N(0, 1).
 * Likelihood at a grid point = product over items of P^correct * (1-P)^(1-correct).
 * Posterior (unnormalized) = prior * likelihood.
 *   theta_hat = sum(g * post) / sum(post)
 *   se        = sqrt(sum((g - theta_hat)^2 * post) / sum(post))
 *
 * The likelihood is accumulated in LOG space and the per-grid log-posterior is
 * shifted by its maximum before exponentiating (log-sum-exp trick). The
 * posterior is normalized anyway, so this shift is mathematically exact while
 * preventing the raw product from underflowing to 0 for long item sequences
 * (e.g. dozens of items each with P in [0.2, 0.8] would otherwise underflow).
 *
 * With no items, returns the prior moments {theta: 0, se: 1}.
 */
export function estimateAbility(
  items: { irt: IRTParams; correct: boolean }[]
): AbilityEstimate {
  if (items.length === 0) {
    return { theta: 0, se: 1 };
  }

  // Build the theta grid: -4..4 step 0.1 (81 points).
  const grid: number[] = [];
  for (let g = -4; g <= 4 + 1e-9; g += 0.1) {
    // Round to avoid floating drift accumulating across 80 additions.
    grid.push(Math.round(g * 10) / 10);
  }

  // log of the standard-normal prior density (constant term cancels in the
  // normalization but is kept for clarity).
  const logPrior = (g: number) =>
    -(g * g) / 2 - 0.5 * Math.log(2 * Math.PI);

  // Accumulate the unnormalized log-posterior on the grid.
  const logPost: number[] = new Array(grid.length);
  let maxLogPost = -Infinity;

  for (let i = 0; i < grid.length; i++) {
    const g = grid[i];
    let logLik = 0;
    for (const { irt, correct } of items) {
      const P = probabilityCorrect(g, irt);
      // Clamp to keep the log well-defined at the asymptotes.
      const Pc = Math.min(Math.max(P, EPS), 1 - EPS);
      logLik += correct ? Math.log(Pc) : Math.log(1 - Pc);
    }
    const lp = logPrior(g) + logLik;
    logPost[i] = lp;
    if (lp > maxLogPost) maxLogPost = lp;
  }

  // Exponentiate after subtracting the max (log-sum-exp normalization).
  let sumPost = 0;
  let sumThetaPost = 0;
  const posteriors: number[] = new Array(grid.length);
  for (let i = 0; i < grid.length; i++) {
    const post = Math.exp(logPost[i] - maxLogPost);
    posteriors[i] = post;
    sumPost += post;
    sumThetaPost += grid[i] * post;
  }

  // After the shift at least one grid point has post = 1, so sumPost >= 1.
  // This guard should never fire, but keeps the function total.
  if (sumPost <= EPS) {
    return { theta: 0, se: 1 };
  }

  const theta = sumThetaPost / sumPost;

  let sumVarPost = 0;
  for (let i = 0; i < grid.length; i++) {
    const d = grid[i] - theta;
    sumVarPost += d * d * posteriors[i];
  }
  const se = Math.sqrt(sumVarPost / sumPost);

  return { theta, se };
}

/**
 * Adaptive selection: among candidates whose id is NOT already administered,
 * return the one maximizing Fisher information at the current theta.
 * Returns null when no eligible candidate remains.
 */
export function selectNextItem(
  theta: number,
  candidates: Item[],
  administeredIds: string[]
): Item | null {
  const used = new Set(administeredIds);
  let best: Item | null = null;
  let bestInfo = -Infinity;

  for (const item of candidates) {
    if (used.has(item.id)) continue;
    const info = fisherInformation(theta, item.irt);
    if (info > bestInfo) {
      bestInfo = info;
      best = item;
    }
  }

  return best;
}

/**
 * Stopping rule for the adaptive sequence.
 * Defaults: minItems = 5, maxItems = 15, seThreshold = 0.35.
 * Stop when count >= maxItems, OR (count >= minItems AND se <= seThreshold).
 */
export function shouldStop(
  est: AbilityEstimate,
  count: number,
  opts?: { minItems?: number; maxItems?: number; seThreshold?: number }
): boolean {
  const minItems = opts?.minItems ?? 5;
  const maxItems = opts?.maxItems ?? 15;
  const seThreshold = opts?.seThreshold ?? 0.35;

  if (count >= maxItems) return true;
  if (count >= minItems && est.se <= seThreshold) return true;
  return false;
}

/**
 * Map a theta estimate to a CEFR band.
 *   theta <= -1.5            -> A1
 *   -1.5 < theta <= -0.5     -> A2
 *   -0.5 < theta <=  0.5     -> B1
 *    0.5 < theta <=  1.5     -> B2
 *    1.5 < theta <=  2.5     -> C1
 *    theta >  2.5            -> C2
 */
export function thetaToCEFR(theta: number): CEFRLevel {
  if (theta <= -1.5) return "A1";
  if (theta <= -0.5) return "A2";
  if (theta <= 0.5) return "B1";
  if (theta <= 1.5) return "B2";
  if (theta <= 2.5) return "C1";
  return "C2";
}

/**
 * Aggregate per-module thetas into a single overall CEFR band.
 * Uses the median theta across modules (robust to a single outlier module),
 * falling back to the mean of the two central values for an even count.
 * Returns "A1" when there are no modules.
 */
export function overallCEFR(modules: ModuleResult[]): CEFRLevel {
  if (modules.length === 0) return "A1";

  const thetas = modules.map((m) => m.theta).sort((x, y) => x - y);
  const mid = Math.floor(thetas.length / 2);
  const median =
    thetas.length % 2 === 1
      ? thetas[mid]
      : (thetas[mid - 1] + thetas[mid]) / 2;

  return thetaToCEFR(median);
}
