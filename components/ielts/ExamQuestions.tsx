import * as React from "react";
import { AirportMap } from "./ExamPassage";
import { EXAM_ID, type ExamId, type ExamQuestion } from "@/lib/ielts/exam";

export function ExamQuestions({
  questions,
  answers,
  flags,
  active,
  onAnswer,
  onFlag,
  onFocus,
  examId = EXAM_ID,
}: {
  questions: ExamQuestion[];
  answers: Record<string, string>;
  flags: string[];
  active: string;
  onAnswer: (id: string, value: string) => void;
  onFlag: (id: string) => void;
  onFocus: (id: string) => void;
  examId?: ExamId;
}) {
  const groups = [...new Set(questions.map((q) => q.groupId))].map((id) =>
    questions.filter((q) => q.groupId === id),
  );
  const [picked, setPicked] = React.useState<string | null>(null);
  function number(q: ExamQuestion) {
    return (
      <button
        type="button"
        className={`exam-question-number ${active === q.id ? "is-active" : ""} ${flags.includes(q.id) ? "is-flagged" : ""}`}
        aria-label={`Flag question ${q.number}`}
        aria-pressed={flags.includes(q.id)}
        title="Flag for review"
        onClick={() => onFlag(q.id)}
      >
        {q.number}
      </button>
    );
  }
  function input(q: ExamQuestion) {
    return (
      <span
        id={`question-${q.id}`}
        className="inline-flex scroll-mt-5 items-center gap-1"
        key={q.id}
      >
        {number(q)}
        <input
          className="exam-gap"
          aria-label={`Answer ${q.number}`}
          value={answers[q.id] ?? ""}
          maxLength={200}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          onFocus={() => onFocus(q.id)}
          onChange={(e) => onAnswer(q.id, e.target.value)}
        />
      </span>
    );
  }
  return (
    <>
      {groups.map((group) => {
        const first = group[0];
        const headings = first.type === "matching-headings";
        const grid = [
          "matching-features",
          "matching-information",
          "map-labelling",
        ].includes(first.type);
        const inline =
          !!first.groupContent &&
          !first.options.length &&
          /\(\d+\)\s*_+/.test(first.groupContent);
        return (
          <div key={first.groupId} className="mb-10">
            <h3 className="mb-1 font-bold">
              Questions {first.number}–{group[group.length - 1].number}
            </h3>
            <p className="mb-5 leading-6">{first.instruction}</p>
            {headings ? (
              <>
                <div className="mb-6 space-y-2" aria-label="Heading options">
                  {first.options.map((o) => {
                    const label =
                      first.groupContent
                        ?.split("\n")
                        .find((line) => line.trim().startsWith(`${o.value} `))
                        ?.trim() ?? o.label;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("text/plain", o.value);
                          setPicked(o.value);
                        }}
                        aria-pressed={picked === o.value}
                        onClick={() =>
                          setPicked(picked === o.value ? null : o.value)
                        }
                        className={`exam-drag-option ${picked === o.value ? "is-selected" : ""}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                {group.map((q) => (
                  <div
                    key={q.id}
                    id={`question-${q.id}`}
                    className="mb-5 flex scroll-mt-5 flex-wrap items-center gap-3"
                    onFocus={() => onFocus(q.id)}
                  >
                    {number(q)}
                    <span>{q.prompt}</span>
                    <button
                      type="button"
                      className="exam-drop-zone"
                      aria-label={`Answer ${q.number}: ${answers[q.id] || "drop heading here"}`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const value = e.dataTransfer.getData("text/plain");
                        if (q.options.some((o) => o.value === value)) {
                          onAnswer(q.id, value);
                          setPicked(null);
                        }
                      }}
                      onClick={() => {
                        if (
                          picked &&
                          q.options.some((o) => o.value === picked)
                        ) {
                          onAnswer(q.id, picked);
                          setPicked(null);
                        }
                      }}
                    >
                      {answers[q.id] || "Drag answer here"}
                    </button>
                    {answers[q.id] && (
                      <button
                        className="text-sm underline"
                        aria-label={`Clear answer ${q.number}`}
                        onClick={() => onAnswer(q.id, "")}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <p className="text-xs text-slate-500">
                  Drag a heading into a gap, or select a heading and then select
                  a gap.
                </p>
              </>
            ) : grid ? (
              <>
                {first.type === "map-labelling" && examId === EXAM_ID && (
                  <div className="max-w-xl">
                    <AirportMap />
                  </div>
                )}
                {first.groupContent && (
                  <p className="mb-5 whitespace-pre-wrap leading-6">
                    {first.groupContent}
                  </p>
                )}
                {first.options.some((o) => o.label !== o.value) && (
                  <div className="mb-5 space-y-1">
                    {first.options.map((o) => (
                      <p key={o.value}>{o.label}</p>
                    ))}
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="exam-matching-table">
                    <thead>
                      <tr>
                        <th scope="col"> </th>
                        {first.options.map((o) => (
                          <th key={o.value} scope="col">
                            {o.value}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {group.map((q) => (
                        <tr
                          id={`question-${q.id}`}
                          key={q.id}
                          onFocus={() => onFocus(q.id)}
                        >
                          <th scope="row">
                            {number(q)} {q.prompt}
                          </th>
                          {q.options.map((o) => (
                            <td key={o.value}>
                              <input
                                type="radio"
                                name={q.id}
                                aria-label={`Question ${q.number}, ${o.value}`}
                                checked={answers[q.id] === o.value}
                                onChange={() => onAnswer(q.id, o.value)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : inline ? (
              <div className="whitespace-pre-wrap leading-[3]">
                {first
                  .groupContent!.split(/(\(\d+\)\s*_+)/g)
                  .map((chunk, i) => {
                    const match = chunk.match(/^\((\d+)\)\s*_+$/);
                    const q =
                      match && group.find((g) => g.number === Number(match[1]));
                    return q ? (
                      input(q)
                    ) : (
                      <React.Fragment key={i}>{chunk}</React.Fragment>
                    );
                  })}
              </div>
            ) : (
              <>
                {first.groupContent && (
                  <p className="mb-5 whitespace-pre-wrap">
                    {first.groupContent}
                  </p>
                )}
                {group.map((q) => (
                  <div
                    id={q.options.length ? `question-${q.id}` : undefined}
                    key={q.id}
                    className="mb-7 scroll-mt-5"
                    onFocus={() => onFocus(q.id)}
                  >
                    {q.options.length ? (
                      <fieldset>
                        <legend className="mb-4 leading-6">
                          {number(q)} {q.prompt}
                        </legend>
                        <div className="space-y-5 pl-3">
                          {q.options.map((o) => (
                            <label
                              key={o.value}
                              className="flex items-start gap-2"
                            >
                              <input
                                type="radio"
                                className="mt-1.5"
                                name={q.id}
                                value={o.value}
                                checked={answers[q.id] === o.value}
                                onChange={() => onAnswer(q.id, o.value)}
                              />
                              <span>{o.label}</span>
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    ) : (
                      <label className="leading-[3]">
                        {q.prompt.includes("________") ? (
                          <>
                            {q.prompt.split("________")[0]}
                            {input(q)}
                            {q.prompt.split("________")[1]}
                          </>
                        ) : (
                          <>
                            {q.prompt} {input(q)}
                          </>
                        )}
                      </label>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        );
      })}
    </>
  );
}
