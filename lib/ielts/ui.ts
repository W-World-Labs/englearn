/**
 * Structured IELTS UI content keyed by UI locale — read via localizedText().
 * Flat one-off strings live in the message tree under `ielts.*` instead.
 */
export const SECTION_LABELS = {
  en: {
    full: "Full test",
    listening: "Listening",
    reading: "Reading",
    writing: "Writing",
  },
  zh: {
    full: "连续模考",
    listening: "听力",
    reading: "阅读",
    writing: "写作",
  },
} as const;

export const FILTER_LABELS = {
  en: ["All", "Incorrect (incl. blank)", "Unanswered"],
  zh: ["全部", "错题（含未答）", "未作答"],
} as const;

export const SECTION_SUMMARIES = {
  en: [
    "40 questions · 4 parts · incl. preview & 2 min review",
    "40 questions · 3 passages · match, judge and complete",
    "2 tasks · data description and discussion essay",
  ],
  zh: [
    "40 题 · 4 个 Part · 含读题与 2 分钟检查",
    "40 题 · 3 篇文章 · 匹配、判断与填空",
    "2 项任务 · 图表描述与议论文",
  ],
} as const;

export const GUIDE_STEPS = {
  en: [
    [
      "01 · Navigate questions",
      "Choose a Part along the bottom, then a question number. Use the arrows at the lower right for the previous or next question.",
    ],
    [
      "02 · Highlight and take notes",
      "Select passage text and choose Highlight or Note from the floating menu. Open notes using the button at the upper right.",
    ],
    [
      "03 · Drag and complete",
      "Drag a heading into a gap, or select an option and then a gap. Type completion answers directly. Tab moves between fields.",
    ],
    [
      "04 · Mark for review",
      "Click the small number beside a question to flag it. The bottom navigation displays the flag and an answer status line.",
    ],
    [
      "05 · Display and submit",
      "Options at the upper right changes text size and contrast. The timer does not pause. The checkmark opens submission; deadlines submit automatically.",
    ],
  ],
  zh: [
    [
      "01 · 题号导航",
      "底部点击 Part，再点击题号，右侧会定位到对应题。用右下角箭头前往上一题或下一题。",
    ],
    [
      "02 · 高亮与笔记",
      "用鼠标选中左侧原文，在浮动菜单选择 Highlight 或 Note。顶部笔记按钮可查看笔记。",
    ],
    [
      "03 · 拖拽与填空",
      "把标题选项拖入空格；也可以先点选项再点空格。填空直接输入，可使用 Tab 在输入框间移动。",
    ],
    [
      "04 · 复查标记",
      "点击题目旁的小题号标记复查。底部题号会显示标记；已作答的题号下方会有状态线。",
    ],
    [
      "05 · 显示与交卷",
      "右上角 Options 可调整字号、对比度。计时不暂停，到时自动交卷；右下角勾号进入提交确认。",
    ],
  ],
} as const;
