
import * as React from "react";
import type { ClientItem, ClientResponse } from "@/lib/types";
import VocabularyItem from "@/components/vocabulary/VocabularyItem";
import GrammarItem from "@/components/grammar/GrammarItem";
import ListeningItem from "@/components/listening/ListeningItem";
import OpenResponseItem from "@/components/openresponse/OpenResponseItem";
import { useI18n } from "@/lib/i18n/context";

/**
 * Shared prop contract implemented by every module item component.
 */
export interface ItemComponentProps {
  item: ClientItem;
  onAnswer: (resp: ClientResponse) => void;
  disabled?: boolean;
}

type ItemComponent = React.ComponentType<ItemComponentProps>;

/**
 * Resolve the correct module component for a given item.
 *
 * Primary dispatch is by `item.format`; we fall back to `item.module` so a
 * mislabeled-but-recoverable item still renders something sensible.
 *
 *   yesno           -> VocabularyItem
 *   mcq / reading   -> GrammarItem   (grammar + reading share the MCQ UI)
 *   listening-mcq   -> ListeningItem
 *   open            -> OpenResponseItem (speaking + writing)
 */
function resolveComponent(item: ClientItem): ItemComponent | null {
  switch (item.format) {
    case "yesno":
      return VocabularyItem;
    case "mcq":
    case "reading-mcq":
      return GrammarItem;
    case "listening-mcq":
      return ListeningItem;
    case "open":
      return OpenResponseItem;
    default:
      break;
  }

  // Format was unrecognized — fall back to the module.
  switch (item.module) {
    case "vocabulary":
      return VocabularyItem;
    case "grammar":
    case "reading":
      return GrammarItem;
    case "listening":
      return ListeningItem;
    case "speaking":
    case "writing":
      return OpenResponseItem;
    default:
      return null;
  }
}

/**
 * ItemRenderer
 * Dispatcher that renders the appropriate module component for `item`,
 * forwarding the shared ItemComponentProps. Returns a graceful fallback
 * card if no component matches the item's format/module.
 */
export function ItemRenderer({ item, onAnswer, disabled }: ItemComponentProps) {
  const { t } = useI18n();
  const Component = resolveComponent(item);

  if (!Component) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-800"
      >
        {t("common.renderError", {
          format: item.format,
          module: item.module,
        })}
      </div>
    );
  }

  return <Component item={item} onAnswer={onAnswer} disabled={disabled} />;
}

export default ItemRenderer;
