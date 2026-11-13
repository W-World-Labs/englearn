/** @deprecated Use useI18n().tRandom('feedback.correct') in components. */
export function correctMessage(): string {
  return "Awesome!";
}

export function wrongMessage(): string {
  return "Keep going!";
}

export function moduleCompleteMessage(_label: string): string {
  return "Unit complete!";
}

export function assessmentCompleteMessage(): string {
  return "Lesson complete!";
}