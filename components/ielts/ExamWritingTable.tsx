import {
  EXAM_ID_02,
  MARROWGATE_TABLE,
  MARROWGATE_YEARS,
  TRANSPORT_TABLE,
  type ExamId,
} from "@/lib/ielts/exam";
import { EXAM_ID } from "@/lib/ielts/exam";

export function ExamWritingTable({ examId = EXAM_ID }: { examId?: ExamId }) {
  const practice02 = examId === EXAM_ID_02;
  const caption = practice02
    ? "Books borrowed from Marrowgate public libraries (thousands)"
    : "Journeys to work in Westbridge (%)";
  const head: readonly string[] = practice02
    ? ["Books", ...MARROWGATE_YEARS.map(String)]
    : ["Transport", "2000", "2010", "2020"];
  const rows: readonly (readonly (string | number)[])[] = practice02
    ? MARROWGATE_TABLE
    : TRANSPORT_TABLE;
  return (
    <div className="my-6 overflow-x-auto">
      <table className="exam-data-table">
        <caption className="mb-5 font-bold">{caption}</caption>
        <thead>
          <tr>
            {head.map((h) => (
              <th scope="col" key={h}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((cell, i) =>
                i === 0 ? (
                  <th scope="row" key={i}>
                    {cell}
                  </th>
                ) : (
                  <td key={i}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
