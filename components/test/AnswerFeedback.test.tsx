import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n/context";
import { AnswerFeedback } from "./AnswerFeedback";

it.each([true, false])("shows only an actual attempt deduction (lost: %s), with deliberate continuation", attemptLost => {
  const html = renderToStaticMarkup(
    <I18nProvider>
      <AnswerFeedback correct={false} format="mcq" xpEarned={2} attemptLost={attemptLost} onDismiss={() => {}} />
    </I18nProvider>,
  );
  expect(html).toContain("练习参与 +2 XP");
  expect(html.includes("容错 −1")).toBe(attemptLost);
  expect(html).toContain("继续");
  expect(html).toContain('role="status"');
});
