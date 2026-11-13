import { QuestionFeedback } from "./QuestionFeedback";
import * as React from "react";
import { downloadMaterial, materialLabels } from "@/lib/learning/materials";
import { Link } from "@tanstack/react-router";
import { useI18n } from "@/lib/i18n/context";
import { studyTextLocale } from "@/lib/i18n/localized";
import { studyCard } from "@/lib/learning/cards";
import { type StudyJournal } from "@/lib/learning/session";
import {
  type LearningLanguage,
  type StudyLocale,
} from "@/lib/learning/catalog";
import {
  finishReview,
  MAX_REVIEW_ROUNDS,
  rateReview,
  reviewCards,
  reviewCounts,
  seededReviewCards,
  planReview,
  startReview,
  parseReviewImport,
  mergeReviewImport,
  MAX_JOURNAL_BYTES,
  type ReviewFilter,
  type ReviewImport,
  type RecallRating,
} from "@/lib/learning/review";
import { reinforcementMessages } from "@/lib/learning/reinforcement-messages";
import { learningMessages } from "@/lib/learning/messages";
import { XpAward } from "@/components/learn/XpAward";
import { addXp } from "@/lib/gamification/store";
import { xpForRecallRound } from "@/lib/gamification/xp";

export function RecallPanel({
  session,
  commit,
  explanationLocale,
  wordIds,
}: {
  session: StudyJournal | null;
  commit: (s: StudyJournal) => void;
  explanationLocale: StudyLocale;
  wordIds?: string;
}) {
  const { locale, learningLanguage } = useI18n(),
    m = reinforcementMessages(locale);
  const [filter, setFilter] = React.useState<ReviewFilter>("recommended"),
    [limit, setLimit] = React.useState(12),
    [revealed, setRevealed] = React.useState(false),
    [notice, setNotice] = React.useState(""),
    [done, setDone] = React.useState(false),
    [xpEarned, setXpEarned] = React.useState<number | null>(null);
  const [incoming, setIncoming] = React.useState<ReviewImport | null>(null),
    [restoreDraft, setRestoreDraft] = React.useState(false);
  const draft = session?.reviewDraft,
    card = draft ? studyCard(draft.cards[draft.ratings.length]) : undefined;
  const seeds = seededReviewCards(
      wordIds,
      learningLanguage as LearningLanguage,
    ),
    candidates =
      filter === "recommended" && seeds.length
        ? seeds
        : reviewCards(session, learningLanguage as LearningLanguage, filter),
    plan = planReview(candidates, limit);
  const counts = React.useMemo(
    () => reviewCounts(session, learningLanguage as LearningLanguage),
    [session, learningLanguage],
  );
  const full = (session?.reviews?.length ?? 0) >= MAX_REVIEW_ROUNDS;
  React.useEffect(() => {
    setRevealed(false);
  }, [draft?.id]);
  function begin() {
    if (!session || !plan.length || full) return;
    if (draft && !window.confirm(m.replace)) return;
    commit(startReview(session, plan, crypto.randomUUID()));
    setDone(false);
    setXpEarned(null);
    setRevealed(false);
  }
  function awardFinishedRound(next: StudyJournal, before: StudyJournal) {
    if (next === before) return;
    const round = next.reviews?.[next.reviews.length - 1];
    if (round) {
      const xp = xpForRecallRound(round.cards.length);
      addXp(xp);
      setXpEarned(xp);
    }
  }
  function rate(rating: RecallRating) {
    if (!session || !revealed) return;
    let next = rateReview(session, rating);
    if (next.reviewDraft?.ratings.length === next.reviewDraft?.cards.length) {
      const finishedRound = finishReview(next);
      awardFinishedRound(finishedRound, next);
      next = finishedRound;
      setDone(true);
    }
    commit(next);
    setRevealed(false);
  }
  async function file(event: React.ChangeEvent<HTMLInputElement>) {
    const f = event.target.files?.[0];
    event.target.value = "";
    if (!f) return;
    setNotice("");
    setIncoming(null);
    if (f.size > MAX_JOURNAL_BYTES) {
      setNotice(m.invalid);
      return;
    }
    try {
      const parsed = parseReviewImport(await f.text());
      if (!parsed) {
        setNotice(m.invalid);
        return;
      }
      setIncoming(parsed);
      setRestoreDraft(false);
    } catch {
      setNotice(m.invalid);
    }
  }
  return (
    <section
      className="my-6 rounded-2xl border border-blue-200 bg-white p-5 sm:p-7"
      aria-label={m.reviewTitle}
    >
      <h2 className="text-xl font-bold">{m.reviewTitle}</h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600">
        {m.reviewHint}
      </p>
      {full && (
        <p role="alert" className="mt-4 text-sm text-amber-900">
          {m.capacity}
        </p>
      )}
      <div className="my-4 flex flex-wrap gap-2">
        {(["recommended", "weak", "due", "all"] as const).map((f) => (
          <button
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 rounded-xl border px-3 text-sm ${filter === f ? "border-blue-500 bg-blue-50 text-blue-900" : "border-slate-200"}`}
          >
            {m[f] + (counts[f] > 0 ? ` (${counts[f]})` : "")}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm">
          {m.length}
          <select
            aria-label={m.length}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="ml-2 min-h-11 rounded-lg border border-slate-300 px-3"
          >
            {[6, 12, 20].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          className="ielts-button disabled:opacity-50"
          disabled={!session || !plan.length || full}
          onClick={begin}
        >
          {m.start} ({plan.length})
        </button>
        <Link
          to="/learn"
          search={
            wordIds ? { tab: "materials", words: wordIds } : { tab: "materials" }
          }
          className="text-sm font-semibold text-blue-800 underline"
        >
          {m.makeMaterials}
        </Link>
      </div>
      {filter === "recommended" && seeds.length > 0 && (
        <p
          role="status"
          data-testid="recall-seeded"
          className="mt-4 rounded-xl bg-blue-50 p-3 text-sm text-blue-900"
        >
          {m.seeded}{" "}
          <Link
            to="/learn"
            search={{ tab: "review" }}
            className="font-semibold underline"
          >
            {m.showRecommended}
          </Link>
        </p>
      )}
      {!plan.length && (
        <p className="mt-4 text-sm text-slate-600">
          {m.empty}{" "}
          <Link
            to="/learn"
            search={{ tab: "courses" }}
            className="font-semibold text-blue-800 underline"
          >
            {learningMessages(locale).courses} →
          </Link>
        </p>
      )}
      {done && (
        <div className="mt-5 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-900">
          <p>{m.done}</p>
          {xpEarned !== null && (
            <XpAward amount={xpEarned} className="mt-2" />
          )}
        </div>
      )}
      {draft && card && (
        <div
          data-testid="recall-card"
          className="mt-6 rounded-xl bg-blue-50/60 p-5"
        >
          <p className="text-sm text-slate-600">
            {m.resume} · {draft.ratings.length + 1}/{draft.cards.length} ·{" "}
            {card.language.toUpperCase()}
          </p>
          <h3 className="mt-4 text-xl font-semibold" lang={card.language}>
            {card.front}
          </h3>
          <QuestionFeedback question={card.id} />
          {!!card.choices.length && (
            <ol
              type="A"
              className="mt-4 list-inside list-[upper-alpha] space-y-2"
              lang={card.language}
            >
              {card.choices.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ol>
          )}
          {!revealed ? (
            <button
              className="ielts-button mt-5"
              onClick={() => setRevealed(true)}
            >
              {m.reveal}
            </button>
          ) : (
            <div data-testid="recall-answer" className="mt-5">
              <p className="text-xl font-bold">
                {card.answer[explanationLocale]}
              </p>
              <p className="mt-3 text-sm leading-7">
                {card.explanation[explanationLocale]}
              </p>
              {card.examples.map((line) => (
                <p className="mt-2 text-sm" key={line} lang={card.language}>
                  {line}
                </p>
              ))}
              <p className="mt-5 text-sm font-semibold">{m.selfRating}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {([0, 1, 2] as const).map((r) => (
                  <button
                    key={r}
                    data-rating={r}
                    className="ielts-button"
                    onClick={() => rate(r)}
                  >
                    {m[r === 0 ? "again" : r === 1 ? "hard" : "good"]}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {draft && !card && (
        <button
          className="ielts-button mt-4"
          onClick={() => {
            if (session) {
              const finishedRound = finishReview(session);
              awardFinishedRound(finishedRound, session);
              commit(finishedRound);
              setDone(true);
            }
          }}
        >
          {m.finish}
        </button>
      )}
      <button
        className="mt-6 text-sm font-semibold text-blue-800 underline disabled:opacity-50"
        disabled={!session?.reviews?.length && !session?.reviewDraft}
        onClick={() =>
          downloadMaterial(
            JSON.stringify(
              {
                format: "lingolearn-review-results",
                version: 1,
                rounds: session?.reviews ?? [],
                draft: session?.reviewDraft ?? null,
              },
              null,
              2,
            ),
            "lingolearn-review-results.json",
            "application/json",
          )
        }
      >
        {materialLabels[studyTextLocale(locale)].export}
      </button>
      <details className="mt-7 border-t border-slate-200 pt-4">
        <summary className="cursor-pointer text-sm font-semibold">
          {m.results}
        </summary>
        <p className="mt-3 text-sm leading-7 text-slate-600">{m.importHint}</p>
        <label className="mt-3 block text-sm">
          {m.file}
          <input
            type="file"
            accept=".json,application/json"
            onChange={file}
            className="mt-2 block max-w-full text-sm"
          />
        </label>
        {incoming && (
          <div className="mt-4 rounded-xl bg-slate-50 p-4">
            <p>
              {m.preview}: {incoming.rounds.length}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              {incoming.rounds.slice(0, 5).map((round) => (
                <li key={round.id}>
                  {studyCard(round.cards[0])!.language.toUpperCase()} ·{" "}
                  {round.cards.length} {m.cardUnit} ·{" "}
                  {new Date(round.at).toLocaleString(locale)}
                </li>
              ))}
            </ul>
            {incoming.draft && (
              <>
                <p className="mt-2 text-sm">{m.draftIncluded}</p>
                <label className="mt-3 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={restoreDraft}
                    onChange={(e) => setRestoreDraft(e.target.checked)}
                  />
                  {m.restoreDraft}
                </label>
              </>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                className="ielts-button"
                disabled={
                  !session || (!incoming.rounds.length && !restoreDraft)
                }
                onClick={() => {
                  if (!session) return;
                  const next = mergeReviewImport(
                    session,
                    incoming,
                    restoreDraft,
                  );
                  if (!next) {
                    setNotice(m.conflict);
                    return;
                  }
                  commit(next);
                  setIncoming(null);
                  setNotice(m.imported);
                }}
              >
                {m.import}
              </button>
              <button
                className="ielts-button"
                onClick={() => setIncoming(null)}
              >
                {m.cancel}
              </button>
            </div>
          </div>
        )}
        {notice && (
          <p role="status" className="mt-4 text-sm">
            {notice}
          </p>
        )}
      </details>
    </section>
  );
}
