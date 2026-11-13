/** Normalize theta (~-4..4) to 0–100 for charts and copy. */
export function thetaToScore(theta: number): number {
  const pct = ((theta + 4) / 8) * 100;
  return Math.round(Math.min(100, Math.max(0, pct)));
}