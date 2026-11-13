export function XpFloat({ amount }: { amount: number }) {
  return (
    <span
      className="pointer-events-none fixed left-1/2 top-1/3 z-40 -translate-x-1/2 animate-score-float text-lg font-semibold text-brand-700"
      aria-live="polite"
    >
      +{amount} XP
    </span>
  );
}