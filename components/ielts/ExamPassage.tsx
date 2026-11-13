import * as React from "react";
import { mergeHighlight, type Highlight } from "@/lib/ielts/session";

export function ExamPassage({
  text,
  highlights,
  onChange,
  onNote,
  enabled,
}: {
  text: string;
  highlights: Highlight[];
  onChange: (ranges: Highlight[]) => void;
  onNote?: (text: string) => void;
  enabled: boolean;
}) {
  const root = React.useRef<HTMLDivElement>(null);
  const [selectionMenu, setSelectionMenu] = React.useState<{
    start: number;
    end: number;
    x: number;
    y: number;
  } | null>(null);
  function highlight() {
    const selection = window.getSelection();
    if (
      !enabled ||
      !root.current ||
      !selection ||
      selection.isCollapsed ||
      !selection.rangeCount
    )
      return;
    const range = selection.getRangeAt(0);
    if (
      !root.current.contains(range.startContainer) ||
      !root.current.contains(range.endContainer)
    )
      return;
    const prefix = range.cloneRange();
    prefix.selectNodeContents(root.current);
    prefix.setEnd(range.startContainer, range.startOffset);
    const start = prefix.toString().length;
    const end = start + range.toString().length;
    const bounds = range.getBoundingClientRect();
    if (end > start && end <= text.length)
      setSelectionMenu({
        start,
        end,
        x: Math.max(8, Math.min(window.innerWidth - 240, bounds.left)),
        y: Math.max(8, Math.min(window.innerHeight - 130, bounds.bottom + 6)),
      });
  }
  const chunks: React.ReactNode[] = [];
  let cursor = 0;
  for (const h of highlights) {
    if (h.start < cursor || h.end > text.length) continue;
    chunks.push(text.slice(cursor, h.start));
    chunks.push(
      <mark
        key={`${h.start}-${h.end}`}
        className="cursor-pointer rounded-sm bg-yellow-200 text-slate-900"
        title="Remove highlight"
        onClick={() => enabled && onChange(highlights.filter((v) => v !== h))}
      >
        {text.slice(h.start, h.end)}
      </mark>,
    );
    cursor = h.end;
  }
  chunks.push(text.slice(cursor));
  return (
    <>
      <div
        ref={root}
        onMouseUp={highlight}
        onKeyUp={highlight}
        onContextMenu={(e) => {
          if (window.getSelection()?.toString()) {
            e.preventDefault();
            highlight();
          }
        }}
        className="whitespace-pre-wrap leading-[1.5]"
        lang="en"
      >
        {chunks}
      </div>
      {selectionMenu && (
        <div
          className="exam-selection-menu"
          role="toolbar"
          aria-label="Selected text actions"
          style={{ left: selectionMenu.x, top: selectionMenu.y }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            onClick={() => {
              onNote?.(text.slice(selectionMenu.start, selectionMenu.end));
              onChange(mergeHighlight(highlights, selectionMenu));
              setSelectionMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            ✎　Note
          </button>
          <button
            onClick={() => {
              onChange(mergeHighlight(highlights, selectionMenu));
              setSelectionMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            ▰　Highlight
          </button>
          <button onClick={() => setSelectionMenu(null)}>
            Keep text selected
          </button>
        </div>
      )}
    </>
  );
}

export function AirportMap() {
  return (
    <figure className="my-5 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <figcaption className="mb-3 text-sm font-semibold">
        Terminal 3 · Questions 16–20
      </figcaption>
      <svg
        viewBox="0 0 540 360"
        role="img"
        aria-labelledby="airport-title airport-desc"
        className="w-full text-slate-700"
      >
        <title id="airport-title">Terminal 3 plan, locations A to G</title>
        <desc id="airport-desc">
          Entrance at the bottom leads to C. A corridor goes right then north to
          A, on the left. A opens north onto central seating. B is a circle at
          the top left. F is an L-shaped building to the right between seating
          and B. A long eastern corridor from central seating ends at G. D and E
          are unused rooms on the west side.
        </desc>
        <path
          d="M220 325V265H370V190H260V60M260 125H330M260 190H495"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="28"
        />
        <g fill="white" stroke="#64748b" strokeWidth="2">
          <rect x="160" y="245" width="120" height="65" rx="4" />
          <rect x="310" y="175" width="70" height="65" rx="4" />
          <circle cx="215" cy="55" r="37" />
          <path d="M300 75H390V115H350V150H300Z" />
          <rect x="458" y="160" width="65" height="60" rx="4" />
          <rect x="35" y="100" width="80" height="55" rx="4" />
          <rect x="35" y="195" width="80" height="55" rx="4" />
        </g>
        <g
          fill="currentColor"
          fontSize="22"
          fontWeight="700"
          textAnchor="middle"
        >
          <text x="220" y="283">
            C
          </text>
          <text x="345" y="213">
            A
          </text>
          <text x="215" y="63">
            B
          </text>
          <text x="330" y="111">
            F
          </text>
          <text x="490" y="198">
            G
          </text>
          <text x="75" y="135">
            D
          </text>
          <text x="75" y="230">
            E
          </text>
        </g>
        <g fill="currentColor" fontSize="13" textAnchor="middle">
          <text x="220" y="350">
            Main entrance ↑
          </text>
          <text x="235" y="163">
            Central seating
          </text>
          <text x="505" y="40">
            N ↑
          </text>
        </g>
      </svg>
    </figure>
  );
}
