import { Link } from "@tanstack/react-router";
import { examLessonLink } from "@/lib/learning/exam-links";
import { lessonById } from "@/lib/learning/catalog";
import { useI18n } from "@/lib/i18n/context";
import { studyTextLocale } from "@/lib/i18n/localized";
export function ExamLearningLink({
  question,
  examId,
}: {
  question: string;
  examId?: string;
}) {
  const { locale, setLearningLanguage, t } = useI18n();
  const mapping = examLessonLink(question, examId),
    lesson = mapping && lessonById(mapping.lessonId);
  if (!lesson) return null;
  return (
    <div
      className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4"
      data-testid="exam-learning-link"
    >
      <p className="text-sm leading-7">
        {t("learn.relatedConcept")}
      </p>
      <Link
        className="ielts-button mt-3 inline-block"
        to="/learn"
        search={{ lesson: lesson.id }}
        onClick={() => setLearningLanguage(lesson.language)}
      >
        {lesson.title[studyTextLocale(locale)]} →
      </Link>
    </div>
  );
}
