
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
import TTSPlayer from "./TTSPlayer";
import { useI18n } from "@/lib/i18n/context";

export interface ItemComponentProps {
  item: ClientItem;
  onAnswer: (resp: ClientResponse) => void;
  disabled?: boolean;
}

/**
 * ListeningItem
 * Default item component for the "listening-mcq" format. Embeds the
 * TTSPlayer (which speaks item.audioScript without revealing it),
 * then presents the prompt and answer options. The script text is
 * never shown — the learner answers from listening alone.
 *
 * Calls onAnswer({ itemId, selectedIndex }) on submit.
 */
export default function ListeningItem({
  item,
  onAnswer,
  disabled = false,
}: ItemComponentProps) {
  const { t } = useI18n();
  const [selected, setSelected] = React.useState<number | null>(null);

  React.useEffect(() => {
    setSelected(null);
  }, [item.id]);

  const options = item.options ?? [];
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
        <CardTitle className="flex items-center gap-2 text-base">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-brand-500"
            aria-hidden="true"
          >
            <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
          </svg>
          {t("item.listeningTitle")}
        </CardTitle>
        <Badge variant="neutral" aria-label={t("item.level", { level: item.cefr })}>
          {item.cefr}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <TTSPlayer
          text={item.audioScript ?? ""}
          lang={item.contentLang ?? "en-US"}
          disabled={disabled}
        />

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
          {selected === null ? t("item.listenThenSelect") : t("item.ready")}
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
