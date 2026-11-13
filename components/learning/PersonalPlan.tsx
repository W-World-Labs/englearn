import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { useAuth } from "@/lib/client/auth";
import { lessonById, type StudyLocale } from "@/lib/learning/catalog";
import { learningMessages } from "@/lib/learning/messages";
import { planMessages } from "@/lib/learning/plan-messages";
import type { LearningEvidence, LearningPlan } from "@/lib/learning/plan";
import type { PlanStatus } from "@/lib/learning/useAccountPlan";
export function PersonalPlan({
  plan,
  evidence,
  status,
  retry,
  explanationLocale,
  compact = false,
}: {
  plan: LearningPlan | null;
  evidence?: LearningEvidence | null;
  status: PlanStatus;
  retry: () => void;
  explanationLocale: StudyLocale;
  compact?: boolean;
}) {
  const { locale, courseName, t } = useI18n(),
    m = planMessages(locale),
    l = learningMessages(locale),
    auth = useAuth();
  if (status === "idle") return null;
  return (
    <section
      data-testid="personal-plan"
      data-stage={plan?.stage}
      data-language={plan?.language}
      data-status={status}
      className="my-5 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6"
    >
      <h2 className="text-xl font-bold">
        {m.title} · {courseName()}
      </h2>
      {status === "loading" ? (
        <p role="status" className="mt-3 text-sm">
          {m.loading}
        </p>
      ) : status === "error" || status === "expired" ? (
        <div role="alert" className="mt-3 text-sm">
          <p>{m[status]}</p>
          <button
            className="ielts-button mt-3"
            onClick={status === "expired" ? () => auth.login("/learn") : retry}
          >
            {status === "expired" ? m.login : m.retry}
          </button>
        </div>
      ) : (
        plan && (
          <>
            <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
              <span>
                {m.grammar}: {l[plan.stage]}
              </span>
              {plan.vocabularyStage && (
                <span>
                  {m.vocabulary}: {l[plan.vocabularyStage]}
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-7">
              {m[plan.basis]} {plan.adjustment && m[plan.adjustment]}
            </p>
            {!compact &&
              (evidence?.grammar ||
                evidence?.vocabulary ||
                plan.practice ||
                plan.promotion) && (
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {plan.practice && (
                  <li>
                    {t("plan.practiceSummary", {
                      lessons: plan.practice.lessons,
                      days: plan.practice.days,
                    })}
                  </li>
                )}
                {plan.promotion && (
                  <li>
                    {t("plan.promotion", {
                      qualifying: plan.promotion.qualifying,
                      days: plan.promotion.days,
                    })}
                  </li>
                )}
                {evidence?.grammar && (
                  <li>
                    {t("plan.evidenceGrammar", {
                      date: new Date(evidence.grammar.at).toLocaleDateString(
                        locale,
                      ),
                      items: evidence.grammar.items,
                    })}
                  </li>
                )}
                {evidence?.vocabulary && (
                  <li>
                    {t("plan.evidenceVocabulary", {
                      date: new Date(
                        evidence.vocabulary.at,
                      ).toLocaleDateString(locale),
                      correct: evidence.vocabulary.correct,
                      total: evidence.vocabulary.total,
                    })}
                  </li>
                )}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              {plan.grammarDiagnostic && (
                <Link
                  to="/test"
                  search={{ modules: ["grammar"] }}
                  className="ielts-button"
                  data-testid="plan-diagnostic"
                >
                  {m.diagnostic} →
                </Link>
              )}
              {plan.vocabularyDiagnostic && !compact && (
                <Link to="/vocabulary" className="ielts-button">
                  {m.vocabularyDiagnostic} →
                </Link>
              )}
            </div>
            <ol className="mt-4 space-y-3">
              {plan.lessons.slice(0, compact ? 1 : 3).map((item) => {
                const lesson = lessonById(item.id);
                return (
                  lesson && (
                    <li key={item.id}>
                      <Link
                        to="/learn"
                        search={{ lesson: item.id }}
                        data-testid="plan-lesson"
                        data-reason={item.reason}
                        className="block rounded-xl border border-blue-100 bg-white p-4 text-sm"
                      >
                        <span className="block text-xs text-slate-600">
                          {m[item.reason]} · {l[lesson.stage]}
                        </span>
                        <strong className="mt-1 block text-blue-900">
                          {lesson.title[explanationLocale]} →
                        </strong>
                      </Link>
                    </li>
                  )
                );
              })}
            </ol>
            {!plan.lessons.length && <p className="mt-4 text-sm">{m.empty}</p>}
            <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold text-blue-900">
              {(plan.reviewCount > 0 || plan.resumeRecall) && (
                <Link
                  to="/learn"
                  search={{ tab: "review" }}
                  className="ielts-button"
                >
                  {plan.resumeRecall ? m.resumeRecall : m.recall} (
                  {plan.reviewCount}) →
                </Link>
              )}
              {!!plan.wordIds.length && (
                <Link
                  to="/learn"
                  search={{ tab: "review", words: plan.wordIds.join(",") }}
                  data-testid="plan-words"
                  className="ielts-button"
                >
                  {m.words} ({plan.wordIds.length}) →
                </Link>
              )}
              {compact && (
                <Link to="/learn" className="ielts-button">
                  {m.open} →
                </Link>
              )}
            </div>
          </>
        )
      )}
    </section>
  );
}
