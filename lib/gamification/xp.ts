import type { TestResult } from "@/lib/types";

export function xpForLevel(totalXp: number): number {
  return Math.floor(totalXp / 100) + 1;
}

export function xpProgressInLevel(totalXp: number): {
  level: number;
  current: number;
  needed: number;
  pct: number;
} {
  const level = xpForLevel(totalXp);
  const base = (level - 1) * 100;
  const current = totalXp - base;
  const needed = 100;
  return {
    level,
    current,
    needed,
    pct: Math.min(100, Math.round((current / needed) * 100)),
  };
}

export function xpForCorrectAnswer(): number {
  return 10;
}

export function xpForWrongAnswer(): number {
  return 2;
}

export function xpForCompletedAssessment(result: TestResult): number {
  const base = 40;
  const perModule = 15 * result.modules.length;
  const cefrBonus =
    { A1: 0, A2: 5, B1: 10, B2: 20, C1: 30, C2: 40 }[result.overallCEFR] ?? 0;
  return base + perModule + cefrBonus;
}

/**
 * Completion-gated XP for scored learning rounds (lesson practice and
 * workbench activities). Awarded once per finished round, scaled by the
 * answer key — repeating a round still requires redoing the work.
 */
export function xpForScoredRound(correct: number): number {
  const c = Number.isFinite(correct) ? Math.max(0, Math.floor(correct)) : 0;
  return Math.min(30, 4 + 3 * c);
}

/**
 * Completion-gated XP for finishing a daily reading task. Matches the
 * scored-round completion floor: real engagement, no correctness shown.
 */
export function xpForDailyRead(): number {
  return 4;
}

/**
 * Completion-gated XP for recall rounds. Self-ratings never scale the
 * reward — only the number of cards worked through counts.
 */
export function xpForRecallRound(cards: number): number {
  const n = Number.isFinite(cards) ? Math.floor(cards) : 0;
  return Math.min(15, Math.max(0, n));
}

/**
 * Completion-gated XP for a finished exam paper or vocabulary test.
 * Timed sections frequently complete while the tab is closed, so callers
 * award once per attempt id rather than at the submit click.
 */
export function xpForExamPaper(questions: number): number {
  const n = Number.isFinite(questions) ? Math.max(0, Math.floor(questions)) : 0;
  return Math.min(40, 8 + n);
}

export const MAX_HEARTS = 5;