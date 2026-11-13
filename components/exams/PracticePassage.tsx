import type { PracticeQuestion } from "@/lib/exams/catalog";
export function PracticePassage({
  question,
  language,
}: {
  question: PracticeQuestion;
  language: string;
}) {
  return question.table ? (
    <div
      className="overflow-x-auto"
      data-testid="practice-passage"
      lang={language}
    >
      <table className="w-full min-w-72 border-collapse text-left text-sm tabular-nums">
        <caption className="mb-4 text-left font-semibold leading-7">
          {question.table.caption}
        </caption>
        <thead>
          <tr>
            {question.table.columns.map((column) => (
              <th
                key={column}
                scope="col"
                className="border-b border-slate-300 px-3 py-3"
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {question.table.rows.map((row, i) => (
            <tr key={i}>
              {row.map((value, j) =>
                j === 0 ? (
                  <th
                    key={j}
                    scope="row"
                    className="border-b border-slate-200 px-3 py-3 font-medium"
                  >
                    {value}
                  </th>
                ) : (
                  <td key={j} className="border-b border-slate-200 px-3 py-3">
                    {value}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p
      data-testid="practice-passage"
      className="whitespace-pre-wrap text-[length:var(--practice-font-size,17px)] leading-9"
      lang={language}
    >
      {question.passage}
    </p>
  );
}
