import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import GrammarItem from "@/components/grammar/GrammarItem";
import ListeningItem from "@/components/listening/ListeningItem";
import { I18nProvider } from "@/lib/i18n/context";
import type { ClientItem } from "@/lib/types";

function page(node: ReactNode) {
  return renderToStaticMarkup(<I18nProvider>{node}</I18nProvider>);
}

const reading: ClientItem = {
  id: "zh-rea-001",
  module: "reading",
  format: "reading-mcq",
  cefr: "A2",
  prompt: "小明住在哪里？",
  passage: "小明住在北京。",
  options: ["上海", "北京"],
};

const listening: ClientItem = {
  id: "zh-lis-001",
  module: "listening",
  format: "listening-mcq",
  cefr: "A2",
  contentLang: "zh-CN",
  prompt: "火车几点出发？",
  audioScript: "九点三十分出发。",
  options: ["9:15", "9:30"],
};

it("renders the default Chinese assessment card without English chrome", () => {
  const html = page(<GrammarItem item={reading} onAnswer={() => {}} />);
  expect(html).toContain("阅读理解");
  expect(html).toContain("短文");
  expect(html).toContain("阅读");
  expect(html).toContain("选择答案后继续");
  expect(html).toContain("提交");
  expect(html).toContain('aria-label="等级 A2"');
  expect(html).toContain("小明住在北京。");
  expect(html).not.toContain("Reading comprehension");
  expect(html).not.toContain("Choose the best option");
  expect(html).not.toContain(">Passage<");
  expect(html).not.toContain(">Submit<");
});

it("renders the listening card and play control in Chinese", () => {
  const html = page(<ListeningItem item={listening} onAnswer={() => {}} />);
  expect(html).toContain("听力理解");
  expect(html).toContain("先听，再选择答案");
  expect(html).toContain("播放语音");
  expect(html).toContain('aria-label="播放语音"');
  expect(html).not.toContain("Listening comprehension");
  expect(html).not.toContain("Play audio");
  expect(html).not.toContain("Listen, then select");
});
