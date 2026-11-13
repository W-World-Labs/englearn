
import * as React from "react";
import type { ClientItem, ClientResponse } from "@/lib/types";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  RadioGroup,
  Badge,
} from "@/components/ui";
import type { RadioOption } from "@/components/ui";
import { useI18n } from "@/lib/i18n/context";

export interface ItemComponentProps {
  item: ClientItem;
  onAnswer: (resp: ClientResponse) => void;
  disabled?: boolean;
}

/**
 * GrammarItem
 * Default item component for the "mcq" and "reading-mcq" formats.
 * Used by both the grammar and reading modules. When `item.passage`
 * is present (reading-mcq) it is rendered above the question prompt.
 *
 * Calls onAnswer({ itemId, selectedIndex }) when the learner submits.
 */
export default function GrammarItem({
  item,
  onAnswer,
  disabled = false,
}: ItemComponentProps) {
  const { t } = useI18n();
  // Track selection by index. We encode the index in the radio option
  // `value` so that duplicate option labels never collide.
  const [selected, setSelected] = React.useState<number | null>(null);

  // Reset local selection whenever a new item is presented.
  React.useEffect(() => {
    setSelected(null);
  }, [item.id]);

  const options = item.options ?? [];
  const hasPassage = Boolean(item.passage && item.passage.trim().length > 0);
  const isReading = item.format === "reading-mcq" || hasPassage;

  const radioOptions: RadioOption[] = options.map((label, idx) => ({
    value: String(idx),
    label,
  }));

  const canSubmit = !disabled && selected !== null;

  function handleSubmit() {
    if (selected === null || disabled) return;
    onAnswer({ itemId: item.id, selectedIndex: selected });
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex items-start justify-between gap-3">
        <CardTitle className="text-base">
          {isReading ? t("item.readingTitle") : t("item.chooseOption")}
        </CardTitle>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="neutral" aria-label={t("item.level", { level: item.cefr })}>
            {item.cefr}
          </Badge>
          <Badge variant="default">{t(`modules.${item.module}`)}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {hasPassage && (
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              {t("item.passage")}
            </p>
            <p className="whitespace-pre-line text-[0.95rem] leading-relaxed text-slate-700">
              {item.passage}
            </p>
          </div>
        )}

        <p
          className="text-base font-medium leading-relaxed text-slate-900"
          id={`prompt-${item.id}`}
        >
          {item.prompt}
        </p>

        <RadioGroup
          options={radioOptions}
          value={selected === null ? null : String(selected)}
          onChange={(v) => setSelected(Number(v))}
          disabled={disabled}
          aria-labelledby={`prompt-${item.id}`}
        />
      </CardContent>

      <CardFooter className="justify-between">
        <span className="text-xs text-slate-400" aria-live="polite">
          {selected === null ? t("item.selectToContinue") : t("item.ready")}
        </span>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!canSubmit}
          aria-disabled={!canSubmit}
        >
          {t("item.submit")}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Button>
      </CardFooter>
    </Card>
  );
}
