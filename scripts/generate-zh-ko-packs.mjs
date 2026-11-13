/**
 * Generates dedicated language packs: zh, ko, ja, es under data/packs/.
 * Run: npm run generate-packs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (lang, file, data) => {
  const dir = path.join(root, "data", "packs", lang);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2) + "\n");
};

const CEFR = ["A1", "A2", "B1", "B2", "C1", "C2"];
function irt(i, mod) {
  const c = mod === "grammar" || mod === "reading" || mod === "listening" ? 0.25 : 0;
  const b = -2 + (i % 12) * 0.35;
  return { a: 1.1 + (i % 5) * 0.08, b: Math.min(2.5, b), c };
}
function cefr(i) {
  return CEFR[Math.min(CEFR.length - 1, Math.floor(i / 10))];
}

const LANG = {
  zh: {
    contentLang: "zh-CN",
    vocPrompt: "你认识这个词吗？",
    openRubric:
      "按 0.0–1.0 评分（任务回应、连贯性、语言范围、准确性）。给出总分与简短中文反馈。",
  },
  ko: {
    contentLang: "ko-KR",
    vocPrompt: "이 단어를 알고 있나요?",
    openRubric:
      "Score 0.0–1.0 (task, coherence, range, accuracy). Brief feedback in Korean.",
  },
  ja: {
    contentLang: "ja-JP",
    vocPrompt: "この単語を知っていますか？",
    openRubric:
      "Score 0.0–1.0 (task, coherence, range, accuracy). Brief feedback in Japanese.",
  },
  es: {
    contentLang: "es-ES",
    vocPrompt: "¿Conoces esta palabra?",
    openRubric:
      "Puntúa 0.0–1.0 (tarea, coherencia, rango, precisión). Breve feedback en español.",
  },
};

function buildVocab(langKey, words, prefix) {
  const meta = LANG[langKey];
  return words.map((w, i) => ({
    id: `${prefix}-voc-${String(i + 1).padStart(3, "0")}`,
    module: "vocabulary",
    format: "yesno",
    irt: irt(i, "vocabulary"),
    cefr: cefr(i),
    contentLang: meta.contentLang,
    prompt: meta.vocPrompt,
    word: w.word,
    isPseudoword: !!w.fake,
  }));
}

function buildGrammar(langKey, items, prefix) {
  const meta = LANG[langKey];
  return items.map((g, i) => ({
    id: `${prefix}-gra-${String(i + 1).padStart(3, "0")}`,
    module: "grammar",
    format: "mcq",
    irt: irt(i, "grammar"),
    cefr: g.cefr ?? cefr(i),
    contentLang: meta.contentLang,
    prompt: g.prompt,
    options: g.options,
    answerIndex: g.answerIndex,
    ...(g.retired ? { retired: true } : {}),
    ...(g.replaces ? { replaces: g.replaces } : {}),
  }));
}

function buildReading(langKey, passages, prefix) {
  const meta = LANG[langKey];
  const outItems = [];
  let n = 0;
  for (const p of passages) {
    p.questions.forEach((q) => {
      n++;
      outItems.push({
        id: `${prefix}-rea-${String(n).padStart(3, "0")}`,
        module: "reading",
        format: "reading-mcq",
        irt: irt(n, "reading"),
        cefr: p.cefr ?? "A2",
        contentLang: meta.contentLang,
        prompt: q.prompt,
        passage: p.passage,
        options: q.options,
        answerIndex: q.answerIndex,
      });
    });
  }
  return outItems;
}

function buildListening(langKey, items, prefix) {
  const meta = LANG[langKey];
  return items.map((l, i) => ({
    id: `${prefix}-lis-${String(i + 1).padStart(3, "0")}`,
    module: "listening",
    format: "listening-mcq",
    irt: irt(i, "listening"),
    cefr: l.cefr ?? cefr(i),
    contentLang: meta.contentLang,
    prompt: l.prompt,
    audioScript: l.audioScript,
    options: l.options,
    answerIndex: l.answerIndex,
  }));
}

function buildOpen(langKey, items, prefix) {
  const meta = LANG[langKey];
  return items.map((o, i) => ({
    id: `${prefix}-${o.module === "speaking" ? "spk" : "wri"}-${String(i + 1).padStart(3, "0")}`,
    module: o.module,
    format: "open",
    irt: { a: 1.4, b: 0.2 + i * 0.15, c: 0 },
    cefr: o.cefr ?? "B1",
    contentLang: meta.contentLang,
    prompt: o.prompt,
    rubric: meta.openRubric,
  }));
}

// —— Chinese ——
const zhWords = [
  { word: "水", fake: false },
  { word: "房子", fake: false },
  { word: "学校", fake: false },
  { word: "朋友", fake: false },
  { word: "工作", fake: false },
  { word: "时间", fake: false },
  { word: "问题", fake: false },
  { word: "方法", fake: false },
  { word: "文化", fake: false },
  { word: "经济", fake: false },
  { word: "环境", fake: false },
  { word: "发展", fake: false },
  { word: "影响", fake: false },
  { word: "研究", fake: false },
  { word: "社会", fake: false },
  { word: "历史", fake: false },
  { word: "科学", fake: false },
  { word: "技术", fake: false },
  { word: "教育", fake: false },
  { word: "健康", fake: false },
  { word: "快乐", fake: false },
  { word: "美丽", fake: false },
  { word: "重要", fake: false },
  { word: "可能", fake: false },
  { word: "应该", fake: false },
  { word: "因为", fake: false },
  { word: "虽然", fake: false },
  { word: "通过", fake: false },
  { word: "根据", fake: false },
  { word: "关于", fake: false },
  { word: "水思", fake: true },
  { word: "房孑", fake: true },
  { word: "学较", fake: true },
  { word: "朋有", fake: true },
  { word: "工昨", fake: true },
  { word: "时问", fake: true },
  { word: "问題", fake: true },
  { word: "方发", fake: true },
  { word: "文花", fake: true },
  { word: "经挤", fake: true },
];

const zhGrammar = [
  { prompt: "我___学生。", options: ["是", "有", "在", "去"], answerIndex: 0 },
  { prompt: "他昨天___北京。", options: ["去", "去了", "去着", "去过"], answerIndex: 1 },
  { prompt: "这本书比那本书___。", options: ["好", "很好", "更好", "最好"], answerIndex: 2 },
  { prompt: "如果明天下雨，我们___在家。", options: ["就", "才", "都", "还"], answerIndex: 0 },
  { prompt: "她正在___电视。", options: ["看", "看了", "看着", "看过"], answerIndex: 0 },
  { prompt: "我___认识你三年了。", options: ["和", "对", "给", "认识"], answerIndex: 3, retired: true },
  { prompt: "请把窗户___。", options: ["关上", "关", "关了", "关着"], answerIndex: 0 },
  { prompt: "他不但会说中文，___会说日语。", options: ["而且", "但是", "因为", "所以"], answerIndex: 0 },
  { prompt: "这个问题___讨论。", options: ["值得", "值得了", "值得着", "值得过"], answerIndex: 0 },
  { prompt: "我打算明年___留学。", options: ["去", "去了", "去过", "去着"], answerIndex: 0 },
  { prompt: "___天气很好，我们去了公园。", options: ["因为", "虽然", "如果", "除非"], answerIndex: 0 },
  { prompt: "他___没来过中国。", options: ["从来", "已经", "正在", "曾经"], answerIndex: 0 },
  { prompt: "请___我一杯水。", options: ["给", "对", "向", "跟"], answerIndex: 0 },
  { prompt: "这部电影我___过两次。", options: ["看", "看了", "看过", "看着"], answerIndex: 2, retired: true },
  { prompt: "他跑得___。", options: ["很快", "更快", "最快", "快"], answerIndex: 0 },
  { prompt: "___努力，___成功。", options: ["只有…才", "因为…所以", "虽然…但是", "不但…而且"], answerIndex: 0 },
  { prompt: "我把书___桌子上了。", options: ["放在", "放在", "放在", "放在"], answerIndex: 0, retired: true },
  { prompt: "他___来晚了。", options: ["又", "再", "还", "才"], answerIndex: 0 },
  { prompt: "这个问题___复杂。", options: ["很", "更", "最", "太"], answerIndex: 3 },
  { prompt: "我___他打过电话。", options: ["给", "对", "向", "跟"], answerIndex: 0 },
];

const zhReading = [
  {
    cefr: "A2",
    passage:
      "小明住在北京。每天早上他骑自行车去上班。周末他喜欢和朋友一起打篮球。小明很喜欢他的城市，但他希望有一天能去国外旅行。",
    questions: [
      {
        prompt: "小明住在哪里？",
        options: ["上海", "北京", "广州", "成都"],
        answerIndex: 1,
      },
      {
        prompt: "他早上怎么去上班？",
        options: ["坐地铁", "骑自行车", "开车", "走路"],
        answerIndex: 1,
      },
      {
        prompt: "周末他喜欢做什么？",
        options: ["看书", "打篮球", "游泳", "做饭"],
        answerIndex: 1,
      },
    ],
  },
  {
    cefr: "B1",
    passage:
      "近年来，越来越多的人选择远程工作。远程工作可以节省通勤时间，也让员工更灵活地安排生活。不过，也有人担心在家工作会减少同事之间的交流，影响团队合作。",
    questions: [
      {
        prompt: "远程工作的一个优点是什么？",
        options: ["增加通勤", "节省通勤时间", "减少工资", "必须出差"],
        answerIndex: 1,
      },
      {
        prompt: "有人担心远程工作会影响什么？",
        options: ["天气", "团队合作", "饮食", "交通"],
        answerIndex: 1,
      },
    ],
  },
];

const zhListening = [
  {
    prompt: "火车几点出发？",
    audioScript: "开往上海的火车九点三十分从第四站台出发。",
    options: ["9:15", "9:30", "9:45", "10:30"],
    answerIndex: 1,
  },
  {
    prompt: "说话者点了什么？",
    audioScript: "你好，我要一杯小杯咖啡和一个巧克力马芬。",
    options: ["大杯咖啡", "小杯咖啡和马芬", "茶", "果汁"],
    answerIndex: 1,
  },
  {
    prompt: "今天天气怎么样？",
    audioScript: "今天下午可能会下雨，记得带伞。",
    options: ["晴天", "可能下雨", "下雪", "很热"],
    answerIndex: 1,
  },
  {
    prompt: "会议改到什么时候？",
    audioScript: "明天的会议改到下午三点，在二楼会议室。",
    options: ["上午十点", "下午三点", "晚上七点", "取消"],
    answerIndex: 1,
  },
  {
    prompt: "她周末要做什么？",
    audioScript: "这个周末我打算去图书馆复习考试。",
    options: ["去图书馆", "去购物", "去旅行", "看电影"],
    answerIndex: 0,
  },
];

const zhOpen = [
  { module: "speaking", prompt: "请用中文介绍你自己，包括姓名、来自哪里以及一个爱好。（约1分钟）", cefr: "A2" },
  { module: "speaking", prompt: "请说明你为什么想学习中文，并举例你使用中文的一个场景。", cefr: "B1" },
  { module: "writing", prompt: "请写约150字，描述你最喜欢的一座城市，并说明原因。", cefr: "B1" },
  { module: "writing", prompt: "请写约200字，讨论网络对学习的影响，给出你的观点与例子。", cefr: "B2" },
];

// —— Korean ——
const koWords = [
  { word: "물", fake: false },
  { word: "집", fake: false },
  { word: "학교", fake: false },
  { word: "친구", fake: false },
  { word: "일", fake: false },
  { word: "시간", fake: false },
  { word: "문제", fake: false },
  { word: "방법", fake: false },
  { word: "문화", fake: false },
  { word: "경제", fake: false },
  { word: "환경", fake: false },
  { word: "발전", fake: false },
  { word: "영향", fake: false },
  { word: "연구", fake: false },
  { word: "사회", fake: false },
  { word: "역사", fake: false },
  { word: "과학", fake: false },
  { word: "기술", fake: false },
  { word: "교육", fake: false },
  { word: "건강", fake: false },
  { word: "행복", fake: false },
  { word: "아름다움", fake: false },
  { word: "중요", fake: false },
  { word: "가능", fake: false },
  { word: "이유", fake: false },
  { word: "비록", fake: false },
  { word: "통해", fake: false },
  { word: "따라", fake: false },
  { word: "관해", fake: false },
  { word: "대해", fake: false },
  { word: "물름", fake: true },
  { word: "집빠", fake: true },
  { word: "학교이", fake: true },
  { word: "친구다", fake: true },
  { word: "일르", fake: true },
  { word: "시간표", fake: true },
  { word: "문제함", fake: true },
  { word: "방법론", fake: true },
  { word: "문화권", fake: true },
  { word: "경제학", fake: true },
];

const koGrammar = [
  { prompt: "저는 학생___.", options: ["입니다", "있습니다", "갑니다", "옵니다"], answerIndex: 0 },
  { prompt: "어제 친구를 ___.", options: ["만났어요", "만나요", "만나", "만나겠"], answerIndex: 0 },
  { prompt: "이 책이 저 책보다 ___.", options: ["좋아요", "더 좋아요", "가장 좋아요", "좋습니다"], answerIndex: 1 },
  { prompt: "비가 오면 집에 ___.", options: ["있을 거예요", "갔어요", "왔어요", "살아요"], answerIndex: 0 },
  { prompt: "지금 텔레비전을 ___.", options: ["봐요", "봤어요", "보고 있어요", "볼 거예요"], answerIndex: 2 },
  { prompt: "한국어를 ___ 배웠어요.", options: ["삼 년 동안", "삼 년", "삼 년에", "삼 년으로"], answerIndex: 0 },
  { prompt: "창문을 ___.", options: ["닫아 주세요", "닫았어요", "닫을 거예요", "닫고 있어요"], answerIndex: 0 },
  { prompt: "그는 한국어___ 일본어도 해요.", options: ["뿐만 아니라", "하지만", "그래서", "왜냐하면"], answerIndex: 0 },
  { prompt: "이 문제는 ___ 생각해 봐야 해요.", options: ["깊이", "빨리", "조용히", "갑자기"], answerIndex: 0 },
  { prompt: "내년에 한국에 ___ 예정이에요.", options: ["갈", "가", "갔", "가고"], answerIndex: 0 },
  { prompt: "날씨가 좋아서 공원에 ___.", options: ["갔어요", "갈 거예요", "가요", "가고 있어요"], answerIndex: 0 },
  { prompt: "그는 ___ 한국에 온 적이 없어요.", options: ["한 번도", "벌써", "아직", "자주"], answerIndex: 0 },
  { prompt: "물 한 잔 ___.", options: ["주세요", "줬어요", "줄 거예요", "주고 있어요"], answerIndex: 0 },
  { prompt: "이 영화를 두 번 ___.", options: ["봤어요", "봐요", "보고 있어요", "볼 거예요"], answerIndex: 0 },
  { prompt: "그는 아주 ___.", options: ["빨라요", "더 빨라요", "가장 빨라요", "빠릅니다"], answerIndex: 0 },
  { prompt: "열심히 하면 ___.", options: ["성공할 거예요", "실패할 거예요", "잠을 잘 거예요", "집에 갈 거예요"], answerIndex: 0 },
  { prompt: "책을 책상 ___ 놓았어요.", options: ["위에", "아래", "옆", "안"], answerIndex: 0 },
  { prompt: "또 ___.", options: ["늦었어요", "일찍 왔어요", "갔어요", "왔어요"], answerIndex: 0 },
  { prompt: "이 문제는 ___ 어려워요.", options: ["너무", "조금", "매우", "별로"], answerIndex: 0 },
  { prompt: "그에게 전화를 ___.", options: ["했어요", "해요", "할 거예요", "하고 있어요"], answerIndex: 0 },
];

const koReading = [
  {
    cefr: "A2",
    passage:
      "민수는 서울에 살고 있습니다. 매일 아침 지하철을 타고 회사에 갑니다. 주말에는 친구들과 축구를 합니다. 민수는 서울을 좋아하지만 언젠가 해외여행을 가고 싶어합니다.",
    questions: [
      {
        prompt: "민수는 어디에 살아요?",
        options: ["부산", "서울", "대구", "인천"],
        answerIndex: 1,
      },
      {
        prompt: "아침에 어떻게 회사에 가요?",
        options: ["버스", "지하철", "자전거", "걸어서"],
        answerIndex: 1,
      },
      {
        prompt: "주말에 무엇을 해요?",
        options: ["독서", "축구", "수영", "요리"],
        answerIndex: 1,
      },
    ],
  },
  {
    cefr: "B1",
    passage:
      "최근 많은 사람들이 재택근무를 선택합니다. 재택근무는 출퇴근 시간을 줄이고 생활을 더 유연하게 만듭니다. 하지만 일부 사람들은 집에서 일하면 동료와의 소통이 줄어든다고 걱정합니다.",
    questions: [
      {
        prompt: "재택근무의 장점은 무엇인가요?",
        options: ["출퇴근 시간 감소", "출퇴근 증가", "급여 감소", "출장 필수"],
        answerIndex: 0,
      },
      {
        prompt: "사람들이 걱정하는 것은?",
        options: ["날씨", "팀워크", "음식", "교통"],
        answerIndex: 1,
      },
    ],
  },
];

const koListening = [
  {
    prompt: "기차는 몇 시에 출발하나요?",
    audioScript: "부산행 기차는 아홉 시 삼십 분에 사번 플랫폼에서 출발합니다.",
    options: ["9:15", "9:30", "9:45", "10:30"],
    answerIndex: 1,
  },
  {
    prompt: "무엇을 주문했나요?",
    audioScript: "안녕하세요, 작은 커피 하나랑 초콜릿 머핀 주세요.",
    options: ["큰 커피", "작은 커피와 머핀", "차", "주스"],
    answerIndex: 1,
  },
  {
    prompt: "오늘 날씨는 어떤가요?",
    audioScript: "오늘 오후에 비가 올 수 있으니 우산을 가져가세요.",
    options: ["맑음", "비 가능", "눈", "매우 더움"],
    answerIndex: 1,
  },
  {
    prompt: "회의는 언제로 바뀌었나요?",
    audioScript: "내일 회의는 오후 세 시로 바뀌었고, 2층 회의실입니다.",
    options: ["오전 10시", "오후 3시", "저녁 7시", "취소"],
    answerIndex: 1,
  },
  {
    prompt: "주말에 무엇을 할 계획인가요?",
    audioScript: "이번 주말에 도서관에 가서 시험 공부를 할 거예요.",
    options: ["도서관", "쇼핑", "여행", "영화"],
    answerIndex: 0,
  },
];

const koOpen = [
  { module: "speaking", prompt: "한국어로 자기소개를 해 주세요. 이름, 출신, 취미를 포함하세요. (약 1분)", cefr: "A2" },
  { module: "speaking", prompt: "한국어를 배우는 이유와 한국어를 사용한 경험을 설명해 주세요.", cefr: "B1" },
  { module: "writing", prompt: "약 150자로 가장 좋아하는 도시를 설명하고 이유를 쓰세요.", cefr: "B1" },
  { module: "writing", prompt: "약 200자로 온라인 학습의 장단점에 대한 의견을 쓰세요.", cefr: "B2" },
];

// —— Japanese ——
const jaWords = [
  { word: "水", fake: false },
  { word: "家", fake: false },
  { word: "学校", fake: false },
  { word: "友達", fake: false },
  { word: "仕事", fake: false },
  { word: "時間", fake: false },
  { word: "問題", fake: false },
  { word: "文化", fake: false },
  { word: "経済", fake: false },
  { word: "環境", fake: false },
  { word: "研究", fake: false },
  { word: "社会", fake: false },
  { word: "歴史", fake: false },
  { word: "科学", fake: false },
  { word: "技術", fake: false },
  { word: "教育", fake: false },
  { word: "健康", fake: false },
  { word: "幸せ", fake: false },
  { word: "重要", fake: false },
  { word: "可能", fake: false },
  { word: "方法", fake: false },
  { word: "意味", fake: false },
  { word: "経験", fake: false },
  { word: "関係", fake: false },
  { word: "意見", fake: false },
  { word: "自然", fake: false },
  { word: "約束", fake: false },
  { word: "趣味", fake: false },
  { word: "将来", fake: false },
  { word: "全部", fake: false },
  { word: "水み", fake: true },
  { word: "家屋", fake: true },
  { word: "学佼", fake: true },
  { word: "友達う", fake: true },
  { word: "仕事み", fake: true },
  { word: "意見き", fake: true },
  { word: "約束る", fake: true },
  { word: "自然ね", fake: true },
  { word: "将来む", fake: true },
  { word: "方法い", fake: true },
];

const jaGrammar = [
  { prompt: "私は学生___。", options: ["です", "ます", "いる", "ある"], answerIndex: 0 },
  { prompt: "昨日友達に___。", options: ["会いました", "会います", "会う", "会って"], answerIndex: 0 },
  { prompt: "この本はあの本より___。", options: ["面白い", "面白く", "面白かった", "面白さ"], answerIndex: 0 },
  { prompt: "雨が降ったら、家に___。", options: ["います", "行きます", "来ます", "帰ります"], answerIndex: 0 },
  { prompt: "今テレビを___。", options: ["見ています", "見ます", "見ました", "見る"], answerIndex: 0 },
  { prompt: "日本語を三年___勉強しました。", options: ["間", "に", "で", "を"], answerIndex: 0 },
  { prompt: "窓を___ください。", options: ["閉めて", "閉め", "閉める", "閉めた"], answerIndex: 0 },
  { prompt: "彼は日本語___英語も話します。", options: ["だけでなく", "しか", "まで", "ほど"], answerIndex: 0 },
  { prompt: "明日会議は午後三時___。", options: ["です", "に", "で", "を"], answerIndex: 0 },
  { prompt: "週末は図書館に___予定です。", options: ["行く", "行った", "行って", "行き"], answerIndex: 0 },
  { prompt: "毎日七時___起きます。", options: ["に", "を", "で", "が"], answerIndex: 0 },
  { prompt: "図書館で本を___。", options: ["読みます", "読みますで", "読むて", "読み"], answerIndex: 0 },
  { prompt: "日本へ来てから、もう二年___。", options: ["なります", "あります", "ですます", "します"], answerIndex: 0 },
  { prompt: "この薬を飲んだら、___なりました。", options: ["元気に", "元気で", "元気の", "元気を"], answerIndex: 0 },
  { prompt: "子供は公園___遊んでいます。", options: ["で", "に", "を", "へ"], answerIndex: 0 },
  { prompt: "私は車を___ことができます。", options: ["運転する", "運転して", "運転だ", "運転"], answerIndex: 0 },
  { prompt: "疲れたので、少し___ましょう。", options: ["休み", "休んで", "休む", "休みます"], answerIndex: 0 },
  { prompt: "部屋に誰も___。", options: ["いません", "ありません", "でした", "ます"], answerIndex: 0 },
  { prompt: "明日は早く___なければなりません。", options: ["起き", "起きて", "起きる", "起きた"], answerIndex: 0 },
  { prompt: "彼女は歌が___。", options: ["上手です", "上手に", "上手で", "上手だと"], answerIndex: 0 },
];

const jaReading = [
  {
    cefr: "A2",
    passage:
      "たろうは東京に住んでいます。毎朝地下鉄で会社に行きます。週末は友達とサッカーをします。",
    questions: [
      {
        prompt: "たろうはどこに住んでいますか？",
        options: ["大阪", "東京", "京都", "福岡"],
        answerIndex: 1,
      },
      {
        prompt: "朝はどうやって会社に行きますか？",
        options: ["バス", "地下鉄", "自転車", "歩く"],
        answerIndex: 1,
      },
    ],
  },
  {
    cefr: "B1",
    passage:
      "最近、在宅勤務を選ぶ人が増えています。通勤時間を省き、生活の自由度も上がります。一方で、同僚との会話が減り、チームワークが弱まると心配する人もいます。",
    questions: [
      {
        prompt: "在宅勤務の利点は何ですか？",
        options: ["通勤時間が増える", "通勤時間を省ける", "給料が上がる", "出張が増える"],
        answerIndex: 1,
      },
      {
        prompt: "心配されている点は何ですか？",
        options: ["チームワークが弱まる", "給料が減る", "残業が増える", "通勤が便利になる"],
        answerIndex: 0,
      },
      {
        prompt: "この文章のテーマは何ですか？",
        options: ["在宅勤務の増加", "東京の通勤", "会社の歴史", "趣味の時間"],
        answerIndex: 0,
      },
    ],
  },
];

const jaListening = [
  {
    prompt: "電車は何時に出発しますか？",
    audioScript: "大阪行きの電車は九時三十分に四番ホームから出発します。",
    options: ["9:15", "9:30", "9:45", "10:30"],
    answerIndex: 1,
  },
  {
    prompt: "何を注文しましたか？",
    audioScript: "すみません、小さいコーヒーとチョコレートマフィンをください。",
    options: ["大きいコーヒー", "小さいコーヒーとマフィン", "お茶", "ジュース"],
    answerIndex: 1,
  },
  {
    prompt: "今日の天気は？",
    audioScript: "今日の午後は雨が降るかもしれないので、傘を持って行ってください。",
    options: ["晴れ", "雨の可能性", "雪", "暑い"],
    answerIndex: 1,
  },
  {
    prompt: "会議は何時に変わりましたか？",
    audioScript: "明日の会議は午後三時に変更になりました。二階の会議室です。",
    options: ["午前十時", "午後三時", "午後七時", "中止"],
    answerIndex: 1,
  },
  {
    prompt: "週末の予定は何ですか？",
    audioScript: "今週末は図書館で試験勉強をするつもりです。",
    options: ["図書館", "買い物", "旅行", "映画"],
    answerIndex: 0,
  },
];

const jaOpen = [
  { module: "speaking", prompt: "日本語で自己紹介してください（名前、出身、趣味）。約1分。", cefr: "A2" },
  { module: "writing", prompt: "150字程度で好きな都市を説明し、理由を書いてください。", cefr: "B1" },
  { module: "speaking", prompt: "日本語を学ぶ理由と使用経験を説明してください。", cefr: "B1" },
  { module: "writing", prompt: "200字程度でオンライン学習の利点と欠点を述べてください。", cefr: "B2" },
];

// —— Spanish ——
const esWords = [
  { word: "agua", fake: false },
  { word: "casa", fake: false },
  { word: "escuela", fake: false },
  { word: "amigo", fake: false },
  { word: "trabajo", fake: false },
  { word: "tiempo", fake: false },
  { word: "problema", fake: false },
  { word: "cultura", fake: false },
  { word: "economía", fake: false },
  { word: "medio", fake: false },
  { word: "estudio", fake: false },
  { word: "sociedad", fake: false },
  { word: "historia", fake: false },
  { word: "ciencia", fake: false },
  { word: "tecnología", fake: false },
  { word: "educación", fake: false },
  { word: "salud", fake: false },
  { word: "feliz", fake: false },
  { word: "importante", fake: false },
  { word: "posible", fake: false },
  { word: "método", fake: false },
  { word: "experiencia", fake: false },
  { word: "significado", fake: false },
  { word: "opinión", fake: false },
  { word: "naturaleza", fake: false },
  { word: "promesa", fake: false },
  { word: "pasatiempo", fake: false },
  { word: "futuro", fake: false },
  { word: "gobierno", fake: false },
  { word: "mercado", fake: false },
  { word: "agüa", fake: true },
  { word: "caza", fake: true },
  { word: "esciela", fake: true },
  { word: "amijo", fake: true },
  { word: "trabajho", fake: true },
  { word: "méthodo", fake: true },
  { word: "esperiencia", fake: true },
  { word: "significodo", fake: true },
  { word: "opiniun", fake: true },
  { word: "naturalesa", fake: true },
];

const esGrammar = [
  { prompt: "Yo ___ estudiante.", options: ["soy", "estoy", "tengo", "hago"], answerIndex: 0 },
  { prompt: "Ayer ___ a mi amigo.", options: ["vi", "veo", "veré", "veía"], answerIndex: 0 },
  { prompt: "Este libro es ___ interesante que ese.", options: ["más", "muy", "mucho", "tan"], answerIndex: 0 },
  { prompt: "Si llueve, nos quedamos ___ casa.", options: ["en", "a", "de", "por"], answerIndex: 0 },
  { prompt: "Ella está ___ la televisión.", options: ["viendo", "ve", "vio", "verá"], answerIndex: 0 },
  { prompt: "Llevo tres años ___ español.", options: ["estudiando", "estudiar", "estudié", "estudio"], answerIndex: 0 },
  { prompt: "Por favor, ___ la ventana.", options: ["cierra", "cerrar", "cerró", "cerrando"], answerIndex: 0 },
  { prompt: "No solo habla español, ___ habla inglés.", options: ["sino que también", "pero", "porque", "aunque"], answerIndex: 0 },
  { prompt: "La reunión es ___ las tres.", options: ["a", "en", "de", "por"], answerIndex: 0 },
  { prompt: "El fin de semana voy a ___ la biblioteca.", options: ["ir a", "fui a", "iba a", "iré a"], answerIndex: 0 },
  { prompt: "Me ___ el español.", options: ["gusta", "gusto", "gustan", "gusté"], answerIndex: 0 },
  { prompt: "¿___ años tienes?", options: ["Cuántos", "Cuánto", "Cuántas", "Cuánta"], answerIndex: 0 },
  { prompt: "Ella ___ en Madrid desde 2020.", options: ["vive", "vivió", "vivo", "viviendo"], answerIndex: 0 },
  { prompt: "Quiero que ___ conmigo.", options: ["vengas", "vienes", "vendrás", "venir"], answerIndex: 0 },
  { prompt: "___ mañana hay examen.", options: ["Pasado", "Por", "Para", "Desde"], answerIndex: 0 },
  { prompt: "No tengo ___ dinero.", options: ["mucho", "mucha", "muchos", "muy"], answerIndex: 0 },
  { prompt: "El libro ___ por el autor en 1990.", options: ["fue escrito", "es escrito", "escribió", "escribe"], answerIndex: 0 },
  { prompt: "___ de llegar, llamé a mi madre.", options: ["Después", "Antes", "Desde", "Aunque"], answerIndex: 0 },
  { prompt: "Si ___ tiempo, iría al cine.", options: ["tuviera", "tengo", "tendré", "tenía"], answerIndex: 0 },
  { prompt: "Hablo ___ español que inglés.", options: ["mejor", "más", "mejor de", "peor"], answerIndex: 0 },
];

const esReading = [
  {
    cefr: "A2",
    passage:
      "Carlos vive en Madrid. Cada mañana va al trabajo en metro. Los fines de semana juega al fútbol con amigos.",
    questions: [
      {
        prompt: "¿Dónde vive Carlos?",
        options: ["Barcelona", "Madrid", "Sevilla", "Valencia"],
        answerIndex: 1,
      },
      {
        prompt: "¿Cómo va al trabajo?",
        options: ["en coche", "en metro", "en bici", "a pie"],
        answerIndex: 1,
      },
    ],
  },
  {
    cefr: "B1",
    passage:
      "En los últimos años, muchas personas han elegido trabajar desde casa. Esto ahorra tiempo de viaje y da más flexibilidad, pero algunos temen que reduzca la comunicación entre compañeros.",
    questions: [
      {
        prompt: "¿Qué ventaja tiene el teletrabajo?",
        options: ["Más viajes", "Ahorra tiempo de viaje", "Más reuniones", "Sueldo mayor"],
        answerIndex: 1,
      },
      {
        prompt: "¿Qué preocupa a algunas personas?",
        options: ["La comida", "El clima", "La comunicación", "El transporte"],
        answerIndex: 2,
      },
      {
        prompt: "¿Cuál es el tema del texto?",
        options: ["El teletrabajo", "El metro de Madrid", "Las vacaciones", "La oficina"],
        answerIndex: 0,
      },
    ],
  },
];

const esListening = [
  {
    prompt: "¿A qué hora sale el tren?",
    audioScript: "El tren a Barcelona sale a las nueve y media desde el andén cuatro.",
    options: ["9:15", "9:30", "9:45", "10:30"],
    answerIndex: 1,
  },
  {
    prompt: "¿Qué pidió?",
    audioScript: "Hola, quisiera un café pequeño y un muffin de chocolate, por favor.",
    options: ["café grande", "café pequeño y muffin", "té", "zumo"],
    answerIndex: 1,
  },
  {
    prompt: "¿Qué tiempo hará?",
    audioScript: "Esta tarde puede llover, lleva un paraguas.",
    options: ["sol", "posible lluvia", "nieve", "mucho calor"],
    answerIndex: 1,
  },
  {
    prompt: "¿Cuándo es la reunión?",
    audioScript: "La reunión de mañana se cambió a las tres de la tarde, en la sala del segundo piso.",
    options: ["10:00", "15:00", "19:00", "cancelada"],
    answerIndex: 1,
  },
  {
    prompt: "¿Qué hará el fin de semana?",
    audioScript: "Este fin de semana pienso ir a la biblioteca a estudiar para el examen.",
    options: ["biblioteca", "compras", "viaje", "cine"],
    answerIndex: 0,
  },
];

const esOpen = [
  { module: "speaking", prompt: "Preséntate en español (nombre, origen, hobby). ~1 min.", cefr: "A2" },
  { module: "writing", prompt: "Escribe ~150 palabras sobre tu ciudad favorita y por qué.", cefr: "B1" },
  { module: "speaking", prompt: "Explica por qué estudias español y un ejemplo de uso.", cefr: "B1" },
  { module: "writing", prompt: "Escribe ~200 palabras sobre ventajas y desventajas del aprendizaje online.", cefr: "B2" },
];


// —— Swarm expansion (Loop content deepening, original CC BY-SA 4.0) ——
// 可直接粘贴进 scripts/generate-zh-ko-packs.mjs 的新增数组（原创，不抄真题）
// 用法：拼接到 zhReading / zhListening / zhOpen / jaReading / jaListening / jaOpen 之后，如 zhReading.push(...zhReadingAdd)
// 每题后附 自查：answerIndex正确性说明。伪词不动。

const zhReadingAdd = [
  {
    cefr: "B1",
    passage:
      "上周六，我们小区的志愿者一起去公园捡垃圾。李阿姨负责带工具，小王负责拍照记录。活动结束后，社区还给大家发了感谢信。很多人说，虽然只是一个上午，但公园变得更干净了，自己也交到了新朋友。",
    questions: [
      {
        prompt: "志愿者们上周六去做了什么？",
        options: ["在小区开会", "去公园捡垃圾", "去敬老院看老人", "在家休息"],
        answerIndex: 1,
        // 自查：passage首句“一起去公园捡垃圾”唯一对应B；A/C/D文中无依据，干扰合理（同为社区活动）。
      },
      {
        prompt: "李阿姨负责什么？",
        options: ["拍照记录", "带工具", "发感谢信", "组织报名"],
        answerIndex: 1,
        // 自查：文中“李阿姨负责带工具，小王负责拍照记录”，B正确；A为小王的工作（强干扰），C是社区做的，D文中未提。
      },
      {
        prompt: "很多人对这次活动是什么看法？",
        options: ["浪费时间", "又累又没意义", "有收获很开心", "人太多太乱"],
        answerIndex: 2,
        // 自查：末句“公园更干净…交到新朋友”为积极评价，C正确；A/B/D与原文情感方向相反，属合理反向干扰。
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "随着高铁网络不断完善，跨城通勤已成为不少人的日常选择。有人早上在杭州喝早茶，中午就能赶到上海开会。电子客票的普及省去了排队取票的麻烦，手机改签也让行程更加灵活。不过，节假日票源紧张、车站安检耗时等问题依然存在。专家认为，未来铁路需要在运力调度和服务细节上继续优化。",
    questions: [
      {
        prompt: "根据文章，电子客票带来了什么变化？",
        options: ["票价明显上涨", "不用排队取票更方便", "车站取消了安检", "车次大幅减少"],
        answerIndex: 1,
        // 自查：“省去了排队取票的麻烦”对应B；A/C/D文中无依据且C与“安检耗时”矛盾，干扰合理。
      },
      {
        prompt: "专家对高铁未来是什么态度？",
        options: ["已经完美无需改进", "应该减少高铁线路", "肯定便利但仍需优化", "建议大家改坐飞机"],
        answerIndex: 2,
        // 自查：末句“需要在运力调度和服务细节上继续优化”=肯定+提改进，对应C；A/B/D曲解或夸大，属B2常见推断干扰。
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "近几年，越来越多的游客开始把目光投向小县城。相比热门景点的人山人海，县城的老街、早市和手艺作坊更能让人放松。当地政府也顺势推出文化夜市和非遗体验项目。不过，一些县城在接待能力上还有差距：停车位不足、民宿卫生标准不统一等问题时有发生。如何在走红之后守住口碑，考验着县城的管理智慧。",
    questions: [
      {
        prompt: "游客开始选择小县城的原因是什么？",
        options: ["县城不收门票", "县城比热门景点更让人放松", "县城交通更发达", "县城有大型游乐场"],
        answerIndex: 1,
        // 自查：“相比…人山人海，县城的老街…更能让人放松”对应B；A/C/D均为旅游联想干扰，文中无依据。
      },
      {
        prompt: "当地政府顺势推出了什么？",
        options: ["文化夜市和非遗体验项目", "免费公交专线", "大型购物中心", "国际主题乐园"],
        answerIndex: 0,
        // 自查：“推出文化夜市和非遗体验项目”逐字对应A；B/C/D为常见旅游开发手段干扰。
      },
      {
        prompt: "文章指出县城目前的问题是什么？",
        options: ["没有特色美食", "游客素质太低", "接待能力仍有差距", "距离大城市太远"],
        answerIndex: 2,
        // 自查：“接待能力上还有差距”对应C（停车位/民宿标准为细节证据）；A/D无中生有，B曲解文意。
      },
      {
        prompt: "“守住口碑”最接近的意思是？",
        options: ["提高景点门票价格", "保持好名声和服务质量", "限制游客数量", "把口号写进宣传语"],
        answerIndex: 1,
        // 自查：口碑=公众评价，守住口碑=保持好名声，对应B；A/C/D为管理手段干扰。
      },
      {
        prompt: "作者对县城旅游热的态度是？",
        options: ["肯定机遇但提醒管理挑战", "认为只是短暂现象", "完全反对游客前往", "建议县城模仿大城市"],
        answerIndex: 0,
        // 自查：全文先肯定（放松/顺势推项目）后提醒（差距/考验管理智慧），对应A；B/C/D与文意不符。
      },
    ],
    // 自查（不重复+分布）：题材“县域旅游”与既存小明生活/志愿捡垃圾/高铁通勤无重叠；answerIndex=[1,0,2,1,0]，覆盖A/B/C。
  },
  {
    cefr: "B2",
    passage:
      "为解决独居老人做饭难的问题，不少城市开始兴办社区食堂。这些食堂价格亲民，菜品清淡软烂，方便老年人咀嚼消化。有的社区食堂还兼具社交功能，老人吃完饭后可以下棋、聊天。不过，社区食堂也面临经营压力：补贴一旦减少，菜价就可能上涨，客流也会流失。如何让公益属性与可持续经营并行，是各地需要继续探索的课题。",
    questions: [
      {
        prompt: "兴办社区食堂主要是为了解决什么问题？",
        options: ["年轻人没地方聚餐", "独居老人做饭难", "上班族午休时间短", "学校食堂价格太高"],
        answerIndex: 1,
        // 自查：首句“为解决独居老人做饭难的问题”对应B；A/C/D均为餐饮联想干扰，文中无依据。
      },
      {
        prompt: "社区食堂的菜品有什么特点？",
        options: ["辛辣重口", "价格昂贵", "清淡软烂", "品种单一"],
        answerIndex: 2,
        // 自查：“菜品清淡软烂，方便老年人咀嚼消化”对应C；A与原文相反，B/D无依据。
      },
      {
        prompt: "文中提到的社交功能体现在哪里？",
        options: ["开设老年大学课程", "饭后可以下棋聊天", "组织集体旅游", "定期举办招聘会"],
        answerIndex: 1,
        // 自查：“吃完饭后可以下棋、聊天”对应B；A/C/D为养老服务联想干扰。
      },
      {
        prompt: "文章认为社区食堂需要继续探索的课题是什么？",
        options: ["公益属性与可持续经营如何并行", "如何吸引更多年轻人就餐", "如何增加菜品种类", "如何扩大食堂面积"],
        answerIndex: 0,
        // 自查：末句“让公益属性与可持续经营并行…需要继续探索”对应A；B/C/D为经营细节干扰。
      },
    ],
    // 自查（不重复+分布）：题材“社区食堂养老”与既存小明生活/远程办公/捡垃圾/高铁/县城旅游无重叠；answerIndex=[1,2,1,0]。
  },
];

const zhListeningAdd = [
  {
    cefr: "A2",
    prompt: "顾客应该找回多少钱？",
    audioScript: "一共三十八块，您给了五十，我找您十二块。",
    options: ["8块", "10块", "12块", "15块"],
    answerIndex: 2,
    // 自查：50-38=12，C正确；A/B/D为相近数字干扰，需听清“十二”。
  },
  {
    cefr: "A2",
    prompt: "快递放在哪里？",
    audioScript: "您的快递到了，放在小区门口的3号柜，取件码是8866。",
    options: ["小区门口3号柜", "物业办公室", "家门口", "超市前台"],
    answerIndex: 0,
    // 自查：audio明说“小区门口的3号柜”，A正确；B/C/D为常见代收点干扰。
  },
  {
    cefr: "B1",
    prompt: "小区什么时候停水？",
    audioScript: "物业通知：明天上午八点到十二点，小区停水检修，请大家提前储水。",
    options: ["今晚八点到十二点", "明天下午两点到六点", "今天上午", "明天上午八点到十二点"],
    answerIndex: 3,
    // 自查：“明天上午八点到十二点”逐字对应D；A/B/C替换时间状语，考细节辨别。
  },
  {
    cefr: "B1",
    prompt: "顾客需要等多久？",
    audioScript: "前面还有两桌，大概需要等十五分钟，您可以先扫码看看菜单。",
    options: ["五分钟", "十五分钟", "三十分钟", "不用等"],
    answerIndex: 1,
    // 自查：“等十五分钟”对应B；A/C为相近时长干扰，D与“还有两桌”矛盾。
  },
  {
    cefr: "B1",
    prompt: "看内科的第一步是什么？",
    audioScript: "挂号请到一楼大厅，内科诊室在三楼301，请带好病历本。",
    options: ["到一楼大厅挂号", "直接去三楼301", "先去药房拿药", "打电话预约手术"],
    answerIndex: 0,
    // 自查：“挂号请到一楼”是流程第一步，A正确；B跳过挂号（强干扰），C/D文中无依据。
  },
  // 自查（分布）：answerIndex=[2,0,3,1,0]，覆盖A/B/C/D，不全是B；场景（菜市/快递/停水/等位/挂号）与现有火车/咖啡/天气/会议/图书馆无重复。
  // 2026-09-23 depth pass: B1-C2 block toward en parity (10→23).
  {
    cefr: "B1",
    prompt: "说话人建议怎么去机场？",
    audioScript: "现在打车去机场太堵了，你坐地铁二号线，到终点站换机场快线，一共大概四十分钟。",
    options: ["打车去", "坐机场大巴", "坐地铁二号线换机场快线", "开车走高速"],
    answerIndex: 2,
    // 自查：地铁二号线换机场快线逐字对应C；A与"太堵"矛盾，B/D文中无依据。
  },
  {
    cefr: "B1",
    prompt: "这家店的招牌菜是什么？",
    audioScript: "我们店的招牌是红烧牛肉面，不过今天的特价菜是清蒸鲈鱼，配米饭只要三十八块。",
    options: ["红烧牛肉面", "清蒸鲈鱼", "牛肉面套餐", "特价炒饭"],
    answerIndex: 0,
    // 自查：招牌=红烧牛肉面A正确；B是"特价菜"强干扰，考"招牌"与"特价"的区别。
  },
  {
    cefr: "B2",
    prompt: "公司为什么推迟新产品发布？",
    audioScript: "原定下月发布的新产品要推迟到三季度，主要是因为核心零部件的供应链还没恢复，另外测试阶段发现了几个需要修复的漏洞。",
    options: ["市场需求不足", "供应链没恢复且测试发现漏洞", "发布会场地没订到", "团队人手不够"],
    answerIndex: 1,
    // 自查：script明述两个原因（供应链+漏洞）对应B；A/C/D文中均未提及。
  },
  {
    cefr: "B2",
    prompt: "健身房对年卡会员的新规定是什么？",
    audioScript: "从下月起，年卡会员可以带一位朋友免费体验两次，不过需要提前在小程序上预约，当天临时带人就不行了。",
    options: ["随时可以免费带朋友来", "年卡会员每月可免费停卡一次", "朋友体验要收半价", "带朋友需在小程序提前预约，限两次"],
    answerIndex: 3,
    // 自查：条件=提前预约+限两次对应D；A漏掉预约条件，B/C文中无依据。
  },
  {
    cefr: "B2",
    prompt: "说话人对这封邮件的态度是什么？",
    audioScript: "这封邮件写得含糊其辞，既没有给出明确的截止日期，也没说明预算上限，我看还是先问清楚再动手比较好。",
    options: ["非常满意", "应该立即执行", "先问清楚再动手", "投诉发件人"],
    answerIndex: 2,
    // 自查："先问清楚再动手"对应C；A/B与"含糊其辞"的负面评价矛盾，D过度推断。
  },
  {
    cefr: "B2",
    prompt: "航班为什么延误？",
    audioScript: "各位旅客请注意，飞往昆明的MU5703航班因目的地机场雷雨天气延误，预计起飞时间推迟到二十一点四十分，登机口不变。",
    options: ["机械故障", "目的地机场雷雨天气", "航空管制", "机组人员不足"],
    answerIndex: 1,
    // 自查："因目的地机场雷雨天气"对应B；A/C/D为常见延误原因干扰。
  },
  {
    cefr: "C1",
    prompt: "这项政策的主要争议点是什么？",
    audioScript: "新规要求网约车司机必须持有本地户籍或居住证，支持者认为这能保障服务质量，反对者则指出这会加剧运力短缺，把兼职司机挤出市场。",
    options: ["司机须持本地户籍或居住证是否合理", "打车费用太高", "车型标准过严", "平台抽成比例"],
    answerIndex: 0,
    // 自查：争议焦点=户籍/居住证要求对应A；B/C/D为网约车常见议题干扰，文中未提。
  },
  {
    cefr: "C1",
    prompt: "说话人认为团队失败的根本原因是什么？",
    audioScript: "表面上看，项目延期是因为人手不足；但归根结底，是我们一开始就把需求范围定得太宽泛，导致后期不断返工。",
    options: ["人手不足", "预算超支", "客户要求太高", "需求范围定得太宽"],
    answerIndex: 3,
    // 自查：根本原因=需求范围对应D；A是"表面原因"强干扰，考表层与根本的区分。
  },
  {
    cefr: "C1",
    prompt: "这项技术目前的主要瓶颈是什么？",
    audioScript: "固态电池虽然理论上能量密度能翻倍，但量产的良品率始终上不去，成本下不来，短期内恐怕还只能用在高端车型上。",
    options: ["能量密度不够", "充电速度慢", "量产良品率低、成本高", "低温性能差"],
    answerIndex: 2,
    // 自查：瓶颈=良品率+成本对应C；A与"能翻倍"矛盾，B/D文中无依据。
  },
  {
    cefr: "C1",
    prompt: "说话人对远程办公的看法是什么？",
    audioScript: "远程办公确实省下了通勤时间，但长期下来，团队里那种随口一说的灵感碰撞明显少了，新人的成长速度也肉眼可见地变慢了。",
    options: ["利弊兼有，隐性成本不低", "完全支持推广", "坚决反对", "只适合大公司"],
    answerIndex: 0,
    // 自查：承认省时+指出灵感/成长损失对应A的"利弊兼有"；B/C单边评价不符，D无依据。
  },
  {
    cefr: "C2",
    prompt: "说话人如何评价这本传记？",
    audioScript: "这本传记号称要还原一个'真实'的传主，可惜作者对传主晚年的关键抉择总是语焉不详，所谓的新史料，细看也多是二手转述。",
    options: ["史料翔实客观", "文笔生动感人", "完全推翻了传统评价", "名为还原，关键处却语焉不详"],
    answerIndex: 3,
    // 自查："号称…可惜…语焉不详…二手转述"对应D的批评；A/B/C均为正面或无依据评价。
  },
  {
    cefr: "C2",
    prompt: "说话人对这项研究结论持什么态度？",
    audioScript: "这项研究的相关性发现确实有意思，但样本只有两三百人，而且是横断面数据——要说因果，恐怕还为时过早。",
    options: ["完全信服", "样本小且为横断面数据，谈因果为时过早", "样本量足够大", "研究毫无价值"],
    answerIndex: 1,
    // 自查：肯定相关性但质疑因果对应B；A/C与"为时过早"矛盾，D过度否定。
  },
  {
    cefr: "C2",
    prompt: "这场谈判僵局的症结在哪里？",
    audioScript: "谈判桌上双方都声称愿意让步，可一旦触及核心条款——也就是数据主权归谁所有——谁都不肯先松口，于是就这么耗着。",
    options: ["会议时间安排冲突", "翻译沟通不畅", "数据主权归属上无人肯先让步", "第三方调解缺席"],
    answerIndex: 2,
    // 自查：症结=数据主权归属对应C；A/B/D为常见谈判障碍干扰，文中未提。
  },
];

const zhOpenAdd = [
  {
    module: "speaking",
    cefr: "B1",
    prompt: "请用中文讲一次你参加社区活动或志愿服务的经历，包括时间、做了什么和你的感受。（约1-2分钟）",
    // 自查：B1叙事+感受，与现有“自我介绍/学中文原因”不重复；任务回应、连贯性可评分。
  },
  {
    module: "speaking",
    cefr: "B2",
    prompt: "有人认为高铁让生活更方便，也有人觉得高峰期太挤。请谈谈你的看法并举例说明。（约2分钟）",
    // 自查：B2观点论证+举例，与现有题不重复；呼应新增高铁阅读但不照搬题干。
  },
  {
    module: "writing",
    cefr: "B2",
    prompt: "请写约200字，给一位要来你家乡的朋友写一封信，推荐一个值得去的地方，并说明理由、交通和注意事项。",
    // 自查：B2应用文（推荐信），与现有“最喜欢的城市/网络影响”题意不同；任务回应、语言范围可评分。
  },
  {
    module: "writing",
    cefr: "C1",
    prompt: "请写约250字，讨论“老龄化社区如何鼓励年轻人参与互助”，提出至少两个建议并分析可能遇到的困难。",
    // 自查：C1议论+对策分析，难度高于B2；与现有题不重复，原创议题。
  },
];

const jaReadingAdd = [
  {
    cefr: "B1",
    passage:
      "先週の日曜日、私の町で夏祭りがありました。商店街にはたくさんの屋台が並び、焼きそばやかき氷が売られていました。夕方からは盆踊りが始まり、子どもからお年寄りまで輪になって踊りました。私はボランティアとしてごみ箱の前で分別の呼びかけをしました。",
    questions: [
      {
        prompt: "夏祭りはどこでありましたか？",
        options: ["学校の校庭", "商店街", "駅のホーム", "市民プール"],
        answerIndex: 1,
        // 自查：本文「商店街には…屋台が並び」对应B；A/C/D为祭り常见场所干扰。拼写语法已校对（並び・売られていました）。
      },
      {
        prompt: "夕方から何が始まりましたか？",
        options: ["盆踊り", "花火大会", "運動会", "映画上映"],
        answerIndex: 0,
        // 自查：本文「夕方からは盆踊りが始まり」对应A；B/C/D为夏日活动合理干扰。
      },
      {
        prompt: "「私」は祭りで何をしましたか？",
        options: ["焼きそばを売った", "写真を撮って売った", "ごみの分別の呼びかけをした", "盆踊りを踊った"],
        answerIndex: 2,
        // 自查：末句「ごみ箱の前で分別の呼びかけ」对应C；A/B/D为祭り参与者典型行为干扰。
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "朝のラッシュ時の電車では、リュックを前に抱える、通話を控えるといった小さな配慮が混雑の緩和につながります。一方で、優先席の利用をめぐっては意見が分かれています。空いているときは座ってもよいという人もいれば、常に空けておくべきだという人もいます。鉄道会社はポスターで協力を呼びかけていますが、専門家はルールよりも周囲への想像力が大切だと指摘しています。",
    questions: [
      {
        prompt: "筆者によると、ラッシュ時の混雑緩和につながるのは何ですか？",
        options: ["料金を上げること", "小さな配慮をすること", "車両を減らすこと", "通話を勧めること"],
        answerIndex: 1,
        // 自查：首句「小さな配慮が混雑の緩和につながります」对应B；A/C/D与文意相反或无依据。
      },
      {
        prompt: "専門家が大切だと言っているのは何ですか？",
        options: ["厳しい罰則", "優先席の撤去", "周囲への想像力", "運賃の値上げ"],
        answerIndex: 2,
        // 自查：末句「ルールよりも周囲への想像力が大切」对应C；A/B/D为交通政策常见干扰但文中未提。
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "深夜の人手不足を背景に、二十四時間営業を見直すコンビニが増えています。深夜の客は少ないものの、配送やごみ収集などの作業は夜に集中するため、店の維持にはコストがかかります。営業時間を短縮した店では店主の負担が減った一方で、終電を逃した人や夜勤の看護師から「困った」という声も上がっています。深夜の安心をどう支えるかは、店だけでなく地域全体の課題になりつつあります。",
    questions: [
      {
        prompt: "営業を見直す背景は何ですか？",
        options: ["客が多すぎること", "深夜の人手不足", "新しい法律の禁止", "電気代だけの高騰"],
        answerIndex: 1,
        // 自查：首句「深夜の人手不足を背景に」对应B；A/C/D文中无依据，C为夸大干扰。
      },
      {
        prompt: "夜に集中する作業として本文に挙げられているのはどれですか？",
        options: ["配送やごみ収集", "店員の採用面接", "値段の変更", "朝食の提供"],
        answerIndex: 0,
        // 自查：「配送やごみ収集などの作業は夜に集中」对应A；B/C/D文中未提。
      },
      {
        prompt: "営業時間を短縮した店で起きたことはどれですか？",
        options: ["店主の負担が増えた", "利用者から困ったという声が上がった", "深夜の客が急増した", "配送がなくなった"],
        answerIndex: 1,
        // 自查：「店主の負担が減った一方で…『困った』という声」对应B；A与文意相反，C/D无依据。
      },
      {
        prompt: "「深夜の安心をどう支えるか」は誰の課題だと書かれていますか？",
        options: ["店だけの課題", "国の法律だけの課題", "客の自己責任", "地域全体の課題"],
        answerIndex: 3,
        // 自查：末句「店だけでなく地域全体の課題」对应D；A为「だけでなく」误读干扰（并非"只是店的课题"），B/C曲解。
      },
      {
        prompt: "筆者の立場として最も適切なのはどれですか？",
        options: ["二十四時間営業を法律で禁止すべきだ", "時短をやめて元に戻すべきだ", "店の負担と利用者の安心の両面を考える課題だ", "コンビニはもう必要ない"],
        answerIndex: 2,
        // 自查：文章先述店主負担減、再述利用者の困り、末句収束于地域課題，对应C；A/B/D为极端主张干扰。
      },
    ],
    // 自查（不重复+分布）：题材“コンビニ営業時間見直し”与既存たろう/在宅勤務/夏祭り/電車マナー无重叠；answerIndex=[1,0,1,3,2]，A-D均有覆盖。
  },
  {
    cefr: "B2",
    passage:
      "人口減少に悩む地方自治体が、都市からの移住者を「地域おこし協力隊」として招く取り組みが広がっています。隊員は任期中、特産品の販売促進や観光案内などに携わり、任期後にその地域への定住が期待されます。実際、移住した若者が古民家を改装してカフェやゲストハウスを開く例も生まれています。一方で、任期終了後の仕事や収入への不安から、定住に至らないケースも少なくありません。招くだけでなく、移住後の生活を支える仕組みが問われています。",
    questions: [
      {
        prompt: "地域おこし協力隊のねらいとして正しいものはどれですか？",
        options: ["都市の人口を増やすこと", "地方に人を呼び込み定住を促すこと", "自治体の予算を削減すること", "特産品を海外に輸出すること"],
        answerIndex: 1,
        // 自查：「都市からの移住者を…招く」「定住が期待されます」对应B；A方向相反，C/D文中无依据。
      },
      {
        prompt: "隊員が任期中に携わる仕事はどれですか？",
        options: ["自治体の職員になる", "大学で地域研究を学ぶ", "特産品の販売促進や観光案内", "古民家の売買仲介"],
        answerIndex: 2,
        // 自查：「特産品の販売促進や観光案内などに携わり」对应C；A/B/D为联想干扰，文中未提。
      },
      {
        prompt: "移住した若者の具体例として書かれているのはどれですか？",
        options: ["古民家を改装して店を開く", "新しいマンションを建てる", "大企業の支社を設ける", "農地を売却する"],
        answerIndex: 0,
        // 自查：「古民家を改装してカフェやゲストハウスを開く」对应A；B/C/D为开发联想干扰。
      },
      {
        prompt: "定住に至らないケースの理由は何ですか？",
        options: ["地方の食事が合わないから", "任期後の仕事や収入への不安", "交通が不便すぎるから", "言葉が通じないから"],
        answerIndex: 1,
        // 自查：「任期終了後の仕事や収入への不安から」对应B；A/C/D为常见联想干扰，文中无依据。
      },
    ],
    // 自查（不重复+分布）：题材“地方移住・地域おこし”与既存たろう/在宅勤務/夏祭り/電車マナー/コンビニ无重叠；answerIndex=[1,2,0,1]。
  },
  // 自查（不重复）：既存たろう東京・在宅勤務と題材重複なし（夏祭り/電車マナー/コンビニ営業時間/地方移住）。CEFR：B1=日常叙述、B2=抽象论述・対比構造。
];

const jaListeningAdd = [
  {
    cefr: "A2",
    prompt: "割引になるのはどれですか？",
    audioScript: "本日は午後六時から、お惣菜が三割引きになります。",
    options: ["飲み物が無料", "果物が二割引き", "お弁当が半額", "お惣菜が三割引き"],
    answerIndex: 3,
    // 自查：audio「お惣菜が三割引き」逐字对应D；A/B/C为超市常见促销干扰。语法校对OK（〜から、〜になります）。
  },
  {
    cefr: "A2",
    prompt: "荷物はどこにありますか？",
    audioScript: "お荷物はマンション入口の3番ロッカーに入っています。暗証番号は8866です。",
    options: ["マンション入口の3番ロッカー", "管理人室", "自宅のドア前", "スーパーのレジ"],
    answerIndex: 0,
    // 自查：「3番ロッカーに入っています」对应A；B/C/D为宅配常见受け取り場所干扰。
  },
  {
    cefr: "B1",
    prompt: "断水はいつですか？",
    audioScript: "管理組合からのお知らせです。明日午前八時から十二時まで、点検のため断水します。",
    options: ["今夜八時から十二時まで", "今日の午前中", "明日午前八時から十二時まで", "明日の夜"],
    answerIndex: 2,
    // 自查：「明日午前八時から十二時まで」对应C；A/B/D替换时间状语考细节。2文构成符合1-2句要求。
  },
  {
    cefr: "B1",
    prompt: "待ち時間はどれくらいですか？",
    audioScript: "あと二組で、十五分ほどお待ちいただきます。先にメニューをご覧ください。",
    options: ["五分", "十五分", "三十分", "待ち時間なし"],
    answerIndex: 1,
    // 自查：「十五分ほど」对应B；A/C为相近时长干扰，D与「あと二組」矛盾。敬語（お待ちいただきます・ご覧ください）已校对。
  },
  {
    cefr: "B1",
    prompt: "内科を受ける最初の手順は何ですか？",
    audioScript: "受付は一階ロビーです。内科は三階の301番です。診察券をお持ちください。",
    options: ["一階ロビーで受付する", "直接三階に行く", "薬局で薬をもらう", "電話で手術を予約する"],
    answerIndex: 0,
    // 自查：「受付は一階ロビー」=第一步对应A；B跳过受付（强干扰），C/D无依据。
  },
  // 自查（分布）：answerIndex=[3,0,2,1,0]，覆盖全部选项，不全是B；场景（スーパー/宅配/断水/待ち時間/受付）与既存電車・注文・天気・会議・図書館无重复。
  // 2026-09-23 depth pass: B1-C2 block toward en parity (10→23).
  {
    cefr: "B1",
    prompt: "空港へはどう行くべきですか？",
    audioScript: "今タクシーで空港へ行くと渋滞に巻き込まれますよ。地下鉄二番線で終点まで行って、空港急行に乗り換えると、だいたい四十分です。",
    options: ["タクシーで", "空港バスで", "地下鉄二番線から空港急行に乗り換え", "高速道路で車で"],
    answerIndex: 2,
    // 自查：地下鉄→空港急行对应C；A与「渋滞に巻き込まれる」矛盾，B/D无依据。
  },
  {
    cefr: "B1",
    prompt: "この店の看板メニューは何ですか？",
    audioScript: "当店の看板は牛肉の醤油煮込み麺です。ただ、本日の特価メニューは蒸し魚で、ご飯付きで九百八十円です。",
    options: ["牛肉の醤油煮込み麺", "蒸し魚", "麺とご飯のセット", "特価チャーハン"],
    answerIndex: 0,
    // 自查：看板=牛肉麺对应A；B是特価メニュー强干扰，考「看板」与「特価」之别。
  },
  {
    cefr: "B2",
    prompt: "新製品の発表が延期された理由は何ですか？",
    audioScript: "来月に予定していた新製品の発表は第三四半期に延期になります。主な理由は、主要部品のサプライチェーンがまだ回復していないことと、テスト段階で修正が必要な不具合が見つかったことです。",
    options: ["市場需要の不足", "サプライチェーンの未回復とテスト不具合", "会場が確保できなかった", "人手不足"],
    answerIndex: 1,
    // 自查：script明述二因（サプライチェーン+不具合）对应B；A/C/D均无依据。
  },
  {
    cefr: "B2",
    prompt: "ジムの年間会員への新しいルールは何ですか？",
    audioScript: "来月から、年間会員の方はお連れ様一名を二回まで無料でご利用いただけます。ただし事前にアプリでのご予約が必要で、当日の同伴はできません。",
    options: ["いつでも無料で同伴できる", "年間会員は月一回休会できる", "同伴者は半額になる", "アプリで事前予約すれば二回まで無料同伴可"],
    answerIndex: 3,
    // 自查：条件=事前予約+二回まで对应D；A漏掉预约条件，B/C无依据。
  },
  {
    cefr: "B2",
    prompt: "話し手はこのメールをどう思っていますか？",
    audioScript: "このメールは書き方が曖昧で、締め切りも予算の上限もはっきりしていないんです。まず確認してから手を付けたほうがいいと思います。",
    options: ["非常に満足している", "すぐ実行すべきだ", "まず確認してから始めるべきだ", "送信者に苦情を言うべきだ"],
    answerIndex: 2,
    // 自查：「確認してから」对应C；A/B与负面评价矛盾，D过度推断。
  },
  {
    cefr: "B2",
    prompt: "便が遅れている理由は何ですか？",
    audioScript: "お客様にお知らせいたします。昆明行きMU5703便は、到着空港の雷雨のため遅れております。出発予定時刻は二十一時四十分に変更となります。なお、搭乗口に変更はございません。",
    options: ["機械の故障", "到着空港の雷雨", "航空管制", "乗務員不足"],
    answerIndex: 1,
    // 自查：「到着空港の雷雨のため」对应B；A/C/D为常见延误原因干扰。
  },
  {
    cefr: "C1",
    prompt: "この政策の主な争点は何ですか？",
    audioScript: "新しい規則では、配車サービスの運転手に地元の戸籍または居住証の保持が義務づけられます。賛成派はサービスの質の保証になると主張し、反対派は運転手不足が悪化し、副業のドライバーが締め出されると指摘しています。",
    options: ["運転手への戸籍・居住証要件の是非", "料金が高すぎること", "車両基準が厳しすぎること", "プラットフォームの手数料率"],
    answerIndex: 0,
    // 自查：争点=戸籍/居住証要件对应A；B/C/D为配車服务常见议题干扰。
  },
  {
    cefr: "C1",
    prompt: "話し手が考えるチーム失敗の根本原因は何ですか？",
    audioScript: "表面的には、プロジェクトの遅延は人手不足が原因に見えます。しかし根本的には、最初に要件の範囲を広く決めすぎたため、後半で手戻りが続いたのです。",
    options: ["人手不足", "予算超過", "顧客の要求が高すぎた", "要件範囲を広く決めすぎた"],
    answerIndex: 3,
    // 自查：根本原因=要件範囲对应D；A是「表面的」原因强干扰，考表层/根本之别。
  },
  {
    cefr: "C1",
    prompt: "この技術の現時点での主なボトルネックは何ですか？",
    audioScript: "全固体電池は理論上エネルギー密度を倍にできますが、量産の歩留まりがなかなか上がらず、コストも下がらないため、当面は高級車向けに限られそうです。",
    options: ["エネルギー密度の不足", "充電速度の遅さ", "量産歩留まりとコスト", "低温性能"],
    answerIndex: 2,
    // 自查：瓶颈=歩留まり+コスト对应C；A与「倍にできる」矛盾，B/D无依据。
  },
  {
    cefr: "C1",
    prompt: "話し手のリモートワークへの見方はどれですか？",
    audioScript: "リモートワークで通勤時間は確かに浮きました。でも長い目で見ると、何気ない会話から生まれるアイデアが明らかに減って、新人の成長スピードも目に見えて落ちています。",
    options: ["利点と隠れたコストの両方がある", "全面的に支持している", "断固として反対", "大企業にしか適さない"],
    answerIndex: 0,
    // 自查：省时+灵感/成长损失对应A的双面评价；B/C片面，D无依据。
  },
  {
    cefr: "C2",
    prompt: "話し手はこの伝記をどう評価していますか？",
    audioScript: "この伝記は『真実』の主人公を描くと謳っていますが、晩年の重要な決断については歯切れが悪く、新しい史料とされるものもよく見れば二手の引用がほとんどです。",
    options: ["史料が詳細で客観的", "文章が感動的", "従来の評価を完全に覆した", "還元を謳いながら肝心な点で歯切れが悪い"],
    answerIndex: 3,
    // 自查：「謳っていますが…歯切れが悪く…二手の引用」对应D的批判；A/B/C均无依据。
  },
  {
    cefr: "C2",
    prompt: "話し手のこの研究への態度はどれですか？",
    audioScript: "この研究が見つけた相関は確かに興味深いです。ただ、標本は二三百人しかなく、しかも横断データです。因果関係を語るには時期尚早でしょう。",
    options: ["完全に納得している", "標本が小さく横断データのため因果は時期尚早", "標本は十分だ", "研究に価値がない"],
    answerIndex: 1,
    // 自查：肯定相関+质疑因果对应B；A/C与「時期尚早」矛盾，D过度否定。
  },
  {
    cefr: "C2",
    prompt: "交渉が膠着している原因は何ですか？",
    audioScript: "交渉の席では双方とも歩み寄る姿勢を見せています。しかし核心条項、つまりデータ主権の帰属に触れると、どちらも先に譲ろうとせず、平行線のままです。",
    options: ["日程調整の問題", "通訳の行き違い", "データ主権の帰属で互いに譲らない", "第三者調停の不在"],
    answerIndex: 2,
    // 自查：症结=データ主権帰属对应C；A/B/D为常见谈判障碍干扰。
  },
];

const jaOpenAdd = [
  {
    module: "speaking",
    cefr: "B1",
    prompt: "地域のお祭りや行事に参加した経験について話してください（いつ・何をしたか・感想）。約1〜2分。",
    // 自查：B1体験叙述，与既存自己紹介/学習理由不重复；呼应夏祭り読解但要求个人经历。
  },
  {
    module: "speaking",
    cefr: "B2",
    prompt: "電車のマナーについて、あなたが大切だと思うことを二つ挙げ、理由とともに話してください。約2分。",
    // 自查：B2意見+理由，与既存题不重复；電車マナー読解的口语延伸。
  },
  {
    module: "writing",
    cefr: "B2",
    prompt: "200字程度で、あなたの故郷を訪ねる友人への手紙を書き、おすすめの場所・行き方・注意点を紹介してください。",
    // 自查：B2手紙文（案内），与既存好きな都市/オンライン学習不重复。
  },
  {
    module: "writing",
    cefr: "C1",
    prompt: "250字程度で「高齢化が進む地域で若者の参加を促すにはどうすればよいか」について、二つの提案と予想される課題を論じてください。",
    // 自查：C1議論+課題分析，难度最高；原创议题，与既存不重复。表記（高齢化・促す・予想される）已校对。
  },
];

// EngLearn pack KO+ES 加深片段（原创）
// 粘贴方法：把下面 6 个 const 的数组内容分别追加到 scripts/generate-zh-ko-packs.mjs 的
// koReading / koListening / koOpen / esReading / esListening / esOpen 数组尾部，然后 npm run generate-packs
// Schema 同 generate-zh-ko-packs.mjs: reading {cefr, passage, questions:[{prompt, options[4], answerIndex}]}
// listening {prompt(+cefr 可选), audioScript, options[4], answerIndex}, open {module, prompt, cefr}
// 全原创，不抄真题；题材避开现有（KO: 서울/재택근무/기차/카페/날씨/회의/도서관 / ES: Madrid-metro/teletrabajo/tren/café/tiempo/reunión/biblioteca）

// ============ KO READING 新增：2篇 x 5题（B1 전통시장 / B2 지하철 예절） ============
const koReadingNew = [
  {
    cefr: "B1",
    passage:
      "지난 토요일 오후에 저는 친구와 함께 남대문시장에 갔습니다. 남대문시장은 600년 역사를 가진 한국에서 가장 오래된 전통시장 중 하나입니다. 시장 입구에는 옷과 신발 가게가 많았고, 안쪽에는 먹거리 골목이 있었습니다. 저는 온누리상품권으로 2만 원어치 김과 미역을 샀습니다. 상품권을 사용하면 10퍼센트 할인된 가격으로 살 수 있어서 좋았습니다. 상인 아주머니는 덤으로 멸치를 조금 더 주셨습니다. 친구는 시장에서 파는 호떡과 어묵을 먹으면서 사진을 많이 찍었습니다. 집에 돌아오는 길에 저는 전통시장이 대형마트보다 정이 많다는 생각이 들었습니다.",
    questions: [
      {
        prompt: "주인공은 언제 시장에 갔나요?",
        options: ["토요일 오후", "일요일 아침", "금요일 저녁", "월요일 오전"],
        answerIndex: 0,
      },
      {
        prompt: "남대문시장에 대한 설명으로 맞는 것은?",
        options: [
          "작년에 새로 생긴 시장이다",
          "주로 전자제품을 파는 곳이다",
          "600년 역사를 가진 오래된 시장이다",
          "밤에만 여는 야시장이다",
        ],
        answerIndex: 2,
      },
      {
        prompt: "주인공은 무엇을 샀나요?",
        options: ["옷과 신발", "김과 미역", "호떡과 어묵", "과일과 채소"],
        answerIndex: 1,
      },
      {
        prompt: "온누리상품권의 장점은 무엇인가요?",
        options: [
          "어디서든 현금처럼 쓸 수 있다",
          "포인트가 두 배로 쌓인다",
          "배달비가 무료가 된다",
          "10퍼센트 할인된 가격으로 살 수 있다",
        ],
        answerIndex: 3,
      },
      {
        prompt: "시장에서 돌아오며 주인공은 어떻게 느꼈나요?",
        options: [
          "대형마트보다 정이 많다고 느꼈다",
          "가격이 너무 비싸다고 느꼈다",
          "상인들이 불친절하다고 느꼈다",
          "먹거리가 부족하다고 느꼈다",
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "서울의 출퇴근 시간 지하철은 세계에서 가장 혼잡한 교통수단 중 하나로 꼽힙니다. 좁은 칸 안에서 모두가 편하게 가려면 작은 배려가 필요합니다. 먼저 노약자석과 임산부 배려석은 비어 있더라도 필요한 사람을 위해 비워 두는 것이 좋습니다. 통화는 짧게 하고 목소리를 낮춰야 하며, 동영상을 볼 때는 반드시 이어폰을 사용해야 합니다. 또한 백팩은 앞으로 메거나 내려놓아야 뒤에 선 사람이 편합니다. 타는 곳에서는 내리는 사람을 먼저 기다린 뒤 두 줄로 서서 타야 합니다. 이러한 예절은 법이 아니라 시민들의 약속이지만, 결국 모든 승객의 이동 시간을 줄이고 스트레스를 낮춥니다.",
    questions: [
      {
        prompt: "이 글의 목적은 무엇인가요?",
        options: [
          "지하철 요금 인상을 알린다",
          "지하철 예절을 제안한다",
          "새 노선 개통을 홍보한다",
          "관광 명소를 소개한다",
        ],
        answerIndex: 1,
      },
      {
        prompt: "'꼽힙니다'의 의미로 가장 가까운 것은?",
        options: ["잊힙니다", "평가됩니다", "밀립니다", "없어집니다"],
        answerIndex: 1,
      },
      {
        prompt: "백팩에 대한 예절로 맞는 것은?",
        options: [
          "앞으로 메거나 내려놓는다",
          "항상 등에 메고 있는다",
          "좌석 위에 올려놓는다",
          "문 앞에 놓고 내린다",
        ],
        answerIndex: 0,
      },
      {
        prompt: "탈 때 지켜야 할 순서는?",
        options: [
          "타는 사람이 먼저 탄다",
          "한 줄로 빨리 탄다",
          "뛰어가서 먼저 자리를 잡는다",
          "내리는 사람을 기다린 뒤 두 줄로 탄다",
        ],
        answerIndex: 3,
      },
      {
        prompt: "필자의 주장으로 가장 적절한 것은?",
        options: [
          "예절은 법이므로 위반하면 벌금을 내야 한다",
          "예절은 약속이지만 모두의 시간을 줄이고 스트레스를 낮춘다",
          "혼잡 시간에는 예절보다 속도가 중요하다",
          "노약자석은 비어 있으면 누구나 앉아야 한다",
        ],
        answerIndex: 1,
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "도심 한가운데 방치된 옛 철길을 공원으로 바꾸는 도시 재생 사업이 주목받고 있습니다. 철길 위에 산책로와 작은 정원을 조성하고 주말마다 시장과 공연을 열자, 낡은 철길은 지역 명소로 거듭났습니다. 상권이 살아나면서 주변 가게들의 매출도 늘었습니다. 그러나 임대료가 오르자 오래 살던 주민들이 다른 곳으로 밀려나는 젠트리피케이션 문제가 나타났습니다. 성공적인 재생이 지역 주민과 함께 가려면 어떤 장치가 필요할지 고민이 깊어지고 있습니다.",
    questions: [
      {
        prompt: "이 사업은 무엇을 공원으로 바꾸었나요?",
        options: ["버려진 학교", "방치된 옛 철길", "오래된 공장", "낡은 주차장"],
        answerIndex: 1,
        // 自查：首句“방치된 옛 철길을 공원으로”对应B；A/C/D为城市更新常见对象干扰，文中无依据。
      },
      {
        prompt: "철길이 지역 명소가 된 이유로 맞는 것은?",
        options: ["해외 관광객이 몰려와서", "산책로와 정원, 주말 행사가 생겨서", "철길이 다시 개통돼서", "대형 백화점이 들어서서"],
        answerIndex: 1,
        // 自查：“산책로와 작은 정원을 조성하고 주말마다 시장과 공연”对应B；A/C/D无依据。
      },
      {
        prompt: "젠트리피케이션 문제로 나타난 현상은?",
        options: ["상권이 몰락하는 것", "공원이 더러워지는 것", "교통이 혼잡해지는 것", "원래 주민이 밀려나는 것"],
        answerIndex: 3,
        // 自查：“오래 살던 주민들이 다른 곳으로 밀려나는”对应D；A/B/C为城市问题联想干扰。
      },
      {
        prompt: "글쓴이가 말하는 앞으로의 과제는?",
        options: ["재생의 성공과 정주민 보호의 균형", "철길을 원래대로 복원하는 것", "관광객 수를 제한하는 것", "주변 상권을 규제하는 것"],
        answerIndex: 0,
        // 自查：末句“성공적인 재생이 지역 주민과 함께 가려면”对应A；B/C/D为政策干扰，文中无依据。
      },
    ],
    // 自查（不重复+分布）：题材“도시 재생·젠트리피케이션”与既存민수/재택근무/남대문시장/지하철 예절无重叠；answerIndex=[1,1,3,0]。
  },
];
// KO reading 自查（每题）：
// R1Q1 answerIndex 0=토요일 오후, passage 첫 문장과 일치.干扰: 일요일/금요일/월요일 모두 시간 표현,合理但错。cefr B1事实定位。现有민수/재택근무无重复。
// R1Q2 answerIndex 2=600년 역사, passage第二句。干扰: 새로 생김/전자제품/야시장 모두 시장 유형 오해,合理。B1。
// R1Q3 answerIndex 1=김과 미역, passage "2만 원어치 김과 미역"。干扰: 옷·신발(입구 가게), 호떡·어묵(친구가 먹음), 과일·채소(미등장)——需细读主体区分，合理。B1。
// R1Q4 answerIndex 3=10% 할인, passage 명시。干扰: 현금/포인트/배달 모두 상품권 연상 오해。B1。
// R1Q5 answerIndex 0=정이 많다,末句。干扰: 비싸다/불친절/부족——与温情基调相反，需理解态度。B1。
// R2Q1 answerIndex 1=예절 제안,全文主旨。干扰: 요금/노선/관광——교통 지문 흔한 오답 방향。B2主旨推断。
// R2Q2 answerIndex 1=평가됩니다, '꼽히다=손꼽히다' B2 어휘 추론。干扰: 잊히다/밀리다/없어지다 형태·의미近似。B2。
// R2Q3 answerIndex 0=앞으로 메거나 내려놓는다, passage 명시。干扰 3개 모두 실제 민폐 행동,규칙 오해 유도。B2细节。
// R2Q4 answerIndex 3=내리는 사람 먼저+두 줄, passage 명시。干扰: 먼저 타기/한 줄/뛰어가기——흔한 위반 행동。B2。
// R2Q5 answerIndex 1=법이 아닌 약속+효과,末句 압축。干扰: 벌금/속도 우선/누구나 앉기——필자 주장과 정반대。B2态度推断。
// 答案分布 reading 10题：0,2,1,3,0,1,1,0,3,1 → 0x3,1x4,2x1,3x2。分散但2偏少，可接受；若要更匀可把R2Q2改为answer 2（需同步改选项顺序），当前保留因为“평가됩니다”放index1最自然。

// ============ KO LISTENING 新增：5题（避开 기차/카페/날씨/회의/도서관） ============
const koListeningNew = [
  {
    cefr: "A2",
    prompt: "약국은 토요일 언제까지 연나요?",
    audioScript:
      "안녕하세요, 여기는 서울약국입니다. 평일에는 아침 아홉 시부터 저녁 아홉 시까지 엽니다. 토요일에는 아침 아홉 시부터 오후 한 시까지 엽니다. 일요일은 쉽니다.",
    options: ["오후 한 시까지", "저녁 아홉 시까지", "밤 열두 시까지", "토요일은 쉽니다"],
    answerIndex: 0,
  },
  {
    cefr: "A2",
    prompt: "생일 파티 장소는 어디인가요?",
    audioScript:
      "민준아, 내 생일 파티는 이번 주 금요일 저녁 일곱 시야. 장소는 우리 집이 아니라 학교 앞 떡볶이 가게 2층이야. 선물은 안 가져와도 돼.",
    options: ["우리 집", "학교 앞 떡볶이 가게 2층", "학교 교실", "공원"],
    answerIndex: 1,
  },
  {
    cefr: "B1",
    prompt: "바뀐 진료 예약은 언제, 어디인가요?",
    audioScript:
      "김지훈 님, 내일 오전 열 시 삼십 분 예약이셨죠? 의사 선생님 일정 때문에 오후 두 시로 바꿔야 합니다. 3층 내과로 오시면 됩니다.",
    options: [
      "내일 오전 10시 30분, 2층 외과",
      "내일 오전 10시 30분, 3층 내과",
      "내일 오후 2시, 2층 외과",
      "내일 오후 2시, 3층 내과",
    ],
    answerIndex: 3,
  },
  {
    cefr: "B1",
    prompt: "중고 거래 조건으로 맞는 것은?",
    audioScript:
      "안녕하세요, 중고 의자 팝니다 글 보고 연락했어요. 내일 오후 다섯 시에 시청역 5번 출구 앞에서 만날 수 있을까요? 현금은 3만 원 가져갈게요.",
    options: [
      "내일 오후 5시, 시청역 5번 출구, 3만 원",
      "내일 오전 5시, 시청역 5번 출구, 3만 원",
      "내일 오후 5시, 시청역 3번 출구, 5만 원",
      "모레 오후 5시, 시청역 5번 출구, 3만 원",
    ],
    answerIndex: 0,
  },
  {
    cefr: "B2",
    prompt: "관리사무소 공지 내용으로 옳은 것은?",
    audioScript:
      "관리사무소에서 알립니다. 다음 주부터 음식물 쓰레기는 일요일을 제외하고 저녁 여덟 시 이후에 배출해 주십시오. 위반 시 과태료가 부과되며, 늦은 밤 복도 소음도 자제해 주시기 바랍니다.",
    options: [
      "음식물 쓰레기는 매일 아침에 버린다",
      "일요일에도 저녁 8시 이후에 버린다",
      "위반하면 과태료가 부과된다",
      "복도 소음은 신경 쓰지 않아도 된다",
    ],
    answerIndex: 2,
  },
  // 2026-09-23 depth pass: B1-C2 block toward en parity (10→23).
  {
    cefr: "B1",
    prompt: "공항까지 어떻게 가는 게 좋습니까?",
    audioScript:
      "지금 택시 타고 공항 가면 막혀요. 지하철 2호선 타고 종점까지 간 다음 공항철도로 갈아타면 한 사십 분 걸려요.",
    options: [
      "택시로",
      "공항버스로",
      "지하철 2호선에서 공항철도로 환승",
      "고속도로로 자가 운전",
    ],
    answerIndex: 2,
  },
  {
    cefr: "B1",
    prompt: "이 가게의 대표 메뉴는 무엇입니까?",
    audioScript:
      "저희 가게 대표 메뉴는 소고기탕면이에요. 오늘 특가는 생선찜으로, 밥 포함 만 오천 원입니다.",
    options: ["소고기탕면", "생선찜", "면과 밥 세트", "특가 볶음밥"],
    answerIndex: 0,
  },
  {
    cefr: "B1",
    prompt: "내일 회의가 어디로 옮겨졌습니까?",
    audioScript:
      "내일 회의는 원래 3층 소회의실이었는데, 참석자가 늘어서 1층 대강당으로 옮겼어요. 시간은 그대로 오후 두 시입니다.",
    options: ["3층 소회의실", "1층 대강당", "2층 회의실", "온라인 회의"],
    answerIndex: 1,
  },
  {
    cefr: "B2",
    prompt: "신제품 발표가 연기된 이유는 무엇입니까?",
    audioScript:
      "다음 달로 예정됐던 신제품 발표가 3분기로 미뤄졌습니다. 핵심 부품 공급망이 아직 회복되지 않은 데다, 테스트 단계에서 수정해야 할 결함이 몇 건 발견됐기 때문입니다.",
    options: [
      "시장 수요 부족",
      "공급망 미회복과 테스트 결함",
      "행사장 확보 실패",
      "인력 부족",
    ],
    answerIndex: 1,
  },
  {
    cefr: "B2",
    prompt: "헬스장 연간 회원에 대한 새 규정은 무엇입니까?",
    audioScript:
      "다음 달부터 연간 회원은 동반자 한 명을 두 번까지 무료로 데려올 수 있습니다. 다만 앱으로 사전 예약이 필요하고, 당일 동반은 불가능합니다.",
    options: [
      "언제든 무료 동반 가능",
      "연간 회원은 월 1회 무료 일시정지",
      "동반자는 반값",
      "앱 사전 예약 시 두 번까지 무료 동반",
    ],
    answerIndex: 3,
  },
  {
    cefr: "B2",
    prompt: "화자가 이 이메일에 대해 어떻게 생각합니까?",
    audioScript:
      "이 이메일은 표현이 애매해서 마감 기한도, 예산 상한도 명확하지 않아요. 먼저 확인하고 손을 대는 게 좋겠어요.",
    options: [
      "매우 만족한다",
      "즉시 실행해야 한다",
      "먼저 확인한 뒤 시작해야 한다",
      "발신자에게 항의해야 한다",
    ],
    answerIndex: 2,
  },
  {
    cefr: "C1",
    prompt: "이 정책의 주요 쟁점은 무엇입니까?",
    audioScript:
      "새 규정은 차량 호출 서비스 기사에게 현지 호적이나 거주증 보유를 의무화했습니다. 찬성 측은 서비스 질을 보장할 수 있다고 하고, 반대 측은 운전 인력 부족이 심화되고 부업 기사들이 밀려날 것이라고 지적합니다.",
    options: [
      "기사의 호적·거주증 요건의 타당성",
      "요금이 너무 비싸다는 점",
      "차량 기준이 너무 까다롭다는 점",
      "플랫폼 수수료율",
    ],
    answerIndex: 0,
  },
  {
    cefr: "C1",
    prompt: "화자가 보는 팀 실패의 근본 원인은 무엇입니까?",
    audioScript:
      "겉으로는 프로젝트 지연이 인력 부족 때문처럼 보이지만, 근본적으로는 처음에 요구사항 범위를 너무 넓게 잡아서 후반부에 재작업이 이어진 겁니다.",
    options: [
      "인력 부족",
      "예산 초과",
      "고객의 과도한 요구",
      "요구사항 범위를 지나치게 넓게 잡음",
    ],
    answerIndex: 3,
  },
  {
    cefr: "C1",
    prompt: "이 기술의 현재 주요 병목은 무엇입니까?",
    audioScript:
      "전고체 배터리는 이론상 에너지 밀도를 두 배로 높일 수 있지만, 양산 수율이 좀처럼 오르지 않고 원가도 내려가지 않아 당분간은 고급 차종에나 쓰일 겁니다.",
    options: ["에너지 밀도 부족", "충전 속도", "양산 수율과 원가", "저온 성능"],
    answerIndex: 2,
  },
  {
    cefr: "C1",
    prompt: "화자의 재택근무에 대한 견해는 무엇입니까?",
    audioScript:
      "재택근무로 통근 시간은 확실히 아꼈지만, 오래 두고 보니 무심코 나누는 대화에서 나오는 아이디어가 눈에 띄게 줄었고, 신입의 성장 속도도 눈에 보이게 느려졌어요.",
    options: [
      "장점과 숨은 비용이 공존한다",
      "전면적으로 지지한다",
      "완강히 반대한다",
      "대기업에만 적합하다",
    ],
    answerIndex: 0,
  },
  {
    cefr: "C2",
    prompt: "화자는 이 전기를 어떻게 평가합니까?",
    audioScript:
      "이 전기는 '실제' 주인공을 복원한다고 표방하지만, 말년의 중요한 결단에 대해서는 늘 어물쩍 넘어가고, 새로운 사료라는 것도 자세히 보면 대부분 이차 인용입니다.",
    options: [
      "사료가 상세하고 객관적이다",
      "문장이 감동적이다",
      "기존 평가를 완전히 뒤집었다",
      "복원을 표방하지만 핵심 대목이 불분명하다",
    ],
    answerIndex: 3,
  },
  {
    cefr: "C2",
    prompt: "화자의 이 연구에 대한 태도는 무엇입니까?",
    audioScript:
      "이 연구가 찾아낸 상관관계는 흥미롭지만, 표본이 겨우 이백여 명이고 게다가 횡단면 자료라 인과관계를 논하기엔 아직 이릅니다.",
    options: [
      "완전히 납득한다",
      "표본이 작고 횡단면 자료라 인과 논증은 시기상조다",
      "표본이 충분하다",
      "연구에 가치가 없다",
    ],
    answerIndex: 1,
  },
  {
    cefr: "C2",
    prompt: "협상이 교착된 이유는 무엇입니까?",
    audioScript:
      "협상 테이블에서 양측 모두 양보 의사를 밝히고 있지만, 핵심 조항, 즉 데이터 주권의 귀속 문제에 들어가면 어느 쪽도 먼저 물러서지 않아 평행선을 달리고 있습니다.",
    options: [
      "일정 조율 문제",
      "통역상의 오해",
      "데이터 주권 귀속에서 양측 모두 양보를 거부",
      "제3자 중재의 부재",
    ],
    answerIndex: 2,
  },
];
// KO listening 自查：
// L1 A2 answer 0=오후 한 시, script "토요일…오후 한 시까지"。干扰: 평일시간(저녁9시)/밤12시/토요일휴무——평일·일요일 정보 혼동 유도。无拼写错。现有无약국题。
// L2 A2 answer 1=떡볶이 가게 2층, script 명시 "우리 집이 아니라"。干扰: 우리 집(부정됨)/교실/공원。无重复（现有주말=도서관）。
// L3 B1 answer 3=오후2시+3층 내과, 시간·장소 2요소 결합 4지선다——부분 정답(오전/외과) 함정 2개。B1 정보 통합。现有회의(오후3시2층)와 시간·층수 다름,의미 중복 없음。
// L4 B1 answer 0=내일 오후5시+5번출구+3만원, 숫자 3요소。干扰: 오전/3번출구/5만원/모레——숫자 바꿔치기。B1。
// L5 B2 answer 2=과태료, script末句。형식 '옳은 것은' 긍정 질문, 나머지 3개는 정반대 진술。B2 공지 이해。现有无관리사무소题。
// 答案分布 listening：0,1,3,0,2 → 0x2,1x1,2x1,3x1，分散OK。

// ============ KO OPEN 新增：4题（speaking2/writing2） ============
const koOpenNew = [
  {
    module: "speaking",
    prompt: "한국어로 전통시장 방문 경험을 1분 정도 말해 보세요. 무엇을 샀고, 가격이 어땠으며, 기분이 어땠는지 포함하세요.",
    cefr: "B1",
  },
  {
    module: "speaking",
    prompt: "지하철에서 지켜야 할 예절 중 가장 중요하다고 생각하는 것을 하나 고르고, 이유와 자신의 경험을 들어 설명해 보세요.",
    cefr: "B2",
  },
  {
    module: "writing",
    prompt: "약 150자로 동네 축제나 시장에 다녀온 후기를 쓰세요. 언제, 누구와, 무엇을 했는지 포함하세요.",
    cefr: "B1",
  },
  {
    module: "writing",
    prompt: "약 200자로 도시의 출퇴근 혼잡 문제를 해결할 방법을 제안하고, 그 방법의 장단점을 쓰세요.",
    cefr: "B2",
  },
];
// KO open 自查：现有open=자기소개A2/배우는이유B1/좋아하는도시B1/온라인학습B2，本组传统市场speakingB1/지하철예절speakingB2/축제후기writingB1/혼잡해결writingB2无重复；cefr与长度/抽象度匹配（B1经验描述150字，B2论证200字）；拼写自查：'온누리'无，prompt中 띄어쓰기·조사 정상。

// ============ ES READING 新增：2篇 x 5题（B1 fiesta local / B2 transporte） ============
const esReadingNew = [
  {
    cefr: "B1",
    passage:
      "El sábado pasado fui con una amiga a la Fiesta de la Cosecha de Valleverde, un pueblo pequeño de mi región. La fiesta celebra el final del verano con un pasacalles de música y baile por la calle principal. En la plaza había un mercado de artesanía con queso, miel y pan. Yo compré queso y miel por veinte euros con un bono local. Con el bono pagué un diez por ciento menos, y la vendedora me regaló un poco de membrillo. Mi amiga comió churros con chocolate y sacó muchas fotos. Al volver a casa pensé que la fiesta del pueblo es más familiar que un centro comercial.",
    questions: [
      {
        prompt: "¿Cuándo fue la protagonista a la fiesta?",
        options: ["El sábado pasado", "El domingo pasado", "El viernes pasado", "El lunes pasado"],
        answerIndex: 0,
      },
      {
        prompt: "¿Qué es el pasacalles?",
        options: [
          "Una tienda nueva",
          "Un desfile de música y baile",
          "Un tipo de queso",
          "Un mercado nocturno",
        ],
        answerIndex: 1,
      },
      {
        prompt: "¿Qué compró la protagonista?",
        options: ["Ropa y zapatos", "Churros y chocolate", "Queso y miel", "Fruta y verdura"],
        answerIndex: 2,
      },
      {
        prompt: "¿Qué ventaja tiene el bono local?",
        options: [
          "Se puede usar como dinero en todas partes",
          "Da el doble de puntos",
          "El envío es gratis",
          "Se paga un diez por ciento menos",
        ],
        answerIndex: 3,
      },
      {
        prompt: "¿Cómo se sintió al volver a casa?",
        options: [
          "La fiesta del pueblo es más familiar que un centro comercial",
          "Todo era demasiado caro",
          "Los vendedores eran antipáticos",
          "Había poca comida",
        ],
        answerIndex: 0,
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "El metro de Madrid en hora punta es uno de los transportes más llenos del mundo. Para viajar cómodos en un vagón estrecho hacen falta pequeños gestos de civismo. Primero, es mejor dejar libres los asientos reservados para mayores y embarazadas, aunque estén vacíos. Las llamadas deben ser cortas y en voz baja, y para ver vídeos hay que usar auriculares. Además, la mochila se lleva delante o se deja en el suelo para no molestar a quien está detrás. Al subir, hay que esperar a que bajen los pasajeros y entrar en dos filas. Estas normas no son una ley, sino un acuerdo entre ciudadanos, pero al final reducen el tiempo de viaje y el estrés de todos.",
    questions: [
      {
        prompt: "¿Cuál es el objetivo del texto?",
        options: [
          "Anunciar una subida del billete",
          "Proponer normas de civismo",
          "Promocionar una línea nueva",
          "Presentar lugares turísticos",
        ],
        answerIndex: 1,
      },
      {
        prompt: "¿Qué significa «hora punta»?",
        options: [
          "La hora con más viajeros",
          "La hora más barata",
          "La hora sin servicio",
          "La hora de la noche",
        ],
        answerIndex: 0,
      },
      {
        prompt: "¿Qué se debe hacer con la mochila?",
        options: [
          "Llevarla siempre a la espalda",
          "Ponerla en el asiento",
          "Llevarla delante o dejarla en el suelo",
          "Dejarla en la puerta",
        ],
        answerIndex: 2,
      },
      {
        prompt: "¿Cuál es el orden correcto para subir?",
        options: [
          "Subir primero sin esperar",
          "Entrar en una fila y correr",
          "Correr para coger sitio",
          "Esperar a que bajen y entrar en dos filas",
        ],
        answerIndex: 3,
      },
      {
        prompt: "¿Qué defiende el autor?",
        options: [
          "Las normas son una ley y hay multa",
          "La velocidad es más importante que el civismo",
          "Los asientos reservados los usa cualquiera",
          "Son un acuerdo que reduce el tiempo y el estrés de todos",
        ],
        answerIndex: 3,
      },
    ],
  },
  {
    cefr: "B2",
    passage:
      "En los últimos años, la compra de ropa de segunda mano ha pasado de ser una opción minoritaria a una tendencia generalizada entre los jóvenes. El auge de las aplicaciones de reventa ha facilitado el intercambio de prendas usadas, mientras que la preocupación por el impacto ambiental de la moda rápida ha reforzado el cambio de hábitos. Sin embargo, algunos expertos advierten de que la facilidad para comprar de forma impulsiva también se traslada al mercado de segunda mano, por lo que el beneficio real para el planeta dependerá de que se compren menos prendas en total, no solo más baratas.",
    questions: [
      {
        prompt: "¿Qué ha cambiado en los últimos años según el texto?",
        options: ["La ropa de segunda mano se ha popularizado", "Se han cerrado muchas tiendas de ropa", "Los jóvenes solo compran ropa nueva", "La moda rápida ha desaparecido"],
        answerIndex: 0,
        // 自查：首句“ha pasado de…a una tendencia generalizada”对应A；B/C/D与文意相反或无依据。
      },
      {
        prompt: "¿Qué factores impulsan esta tendencia según el texto?",
        options: ["Subvenciones del gobierno", "Apps de reventa y preocupación ambiental", "La falta de tiendas físicas", "Campañas de marcas de lujo"],
        answerIndex: 1,
        // 自查：“aplicaciones de reventa…preocupación por el impacto ambiental”对应B；A/C/D为联想干扰。
      },
      {
        prompt: "¿Qué advierten algunos expertos?",
        options: ["La ropa usada es poco higiénica", "Las apps cobran comisiones altas", "La compra impulsiva también pasa a la segunda mano", "Los jóvenes no saben combinar prendas"],
        answerIndex: 2,
        // 自查：“la facilidad para comprar de forma impulsiva también se traslada”对应C；A/B/D无依据。
      },
      {
        prompt: "¿De qué depende el beneficio real para el planeta?",
        options: ["De comprar menos prendas en total", "De vender toda la ropa vieja", "De subir el precio de la moda rápida", "De exportar ropa a otros países"],
        answerIndex: 0,
        // 自查：末句“dependerá de que se compren menos prendas en total”对应A；B/C/D为环保政策联想干扰。
      },
    ],
    // 自查（不重复+分布）：题材“ropa de segunda mano”与既存Carlos/teletrabajo/fiesta de la cosecha/metro无重叠；answerIndex=[0,1,2,0]。
  },
];
// ES reading 自查（拼写/重音）：
// R1Q1 answer 0=El sábado pasado（sábado重音✓），首句定位。干扰domingo/viernes/lunes合理。B1。避开现有teletrabajo题。
// R1Q2 answer 1=desfile de música y baile，文中有定义。干扰tienda/queso/nocturno皆市场语义邻项。B1。música✓。
// R1Q3 answer 2=queso y miel（veinte euros—数字题干未直接问价格，防送分；干扰ropa/zapatos=入口错位，churros=朋友行为主体混淆，fruta=未出现）。B1。
// R1Q4 answer 3=diez por ciento menos（por ciento分写✓）。干扰puntos/envío/todas partes为bono常见误解。B1。
// R1Q5 answer 0=más familiar（más重音✓，familar非formal）。干扰caro/antipáticos/poca—与末句态度相反。B1。
// R2Q1 answer 1=Proponer normas de civismo主旨。干扰billete/línea/turísticos为交通文本常见跑题项。B2。
// R2Q2 answer 0=hora con más viajeros词汇推理（hora punta非字面“尖”）。B2。
// R2Q3 answer 2=delante o en el suelo细节。干扰均为真实失礼行为。B2。
// R2Q4 answer 3=Esperar…dos filas细节+顺序。B2。
// R2Q5 answer 3=acuerdo…reduce tiempo y estrés（末句压缩，含redu…动词变位✓）。干扰ley/multa（与“no son una ley”相反）/velocidad/asientos—作者立场反转项。B2。
// 答案分布 reading 10题：0,1,2,3,0,1,0,2,3,3 → 0x3,1x2,2x2,3x3，分散OK。

// ============ ES LISTENING 新增：5题（避开 tren/café/tiempo/reunión/biblioteca） ============
const esListeningNew = [
  {
    cefr: "A2",
    prompt: "¿Hasta qué hora abre la farmacia los sábados?",
    audioScript:
      "Hola, aquí Farmacia Central. Abrimos de lunes a viernes de nueve a nueve, los sábados de nueve a una y los domingos cerramos.",
    options: ["Hasta la una", "Hasta las nueve", "Hasta las doce", "No abre los sábados"],
    answerIndex: 0,
  },
  {
    cefr: "A2",
    prompt: "¿Dónde es la fiesta de cumpleaños?",
    audioScript:
      "¡Hola, Pablo! Mi fiesta es este viernes a las siete de la tarde. No será en mi casa, sino en el segundo piso del bar de la plaza. No traigas regalo.",
    options: ["En mi casa", "En el segundo piso del bar de la plaza", "En clase", "En el parque"],
    answerIndex: 1,
  },
  {
    cefr: "B1",
    prompt: "¿Cuál es el cambio de la cita médica?",
    audioScript:
      "Señor Ruiz, su cita de mañana a las diez y media tiene que pasar a las dos de la tarde por un cambio de turno. Venga a la tercera planta, consulta de medicina interna.",
    options: [
      "Mañana a las 10:30, segunda planta, cirugía",
      "Mañana a las 10:30, tercera planta, medicina interna",
      "Mañana a las 14:00, segunda planta, cirugía",
      "Mañana a las 14:00, tercera planta, medicina interna",
    ],
    answerIndex: 3,
  },
  {
    cefr: "B1",
    prompt: "¿Cuál es la condición de la compra de segunda mano?",
    audioScript:
      "Hola, vi tu anuncio de la silla de segunda mano. ¿Podemos vernos mañana a las cinco delante de la salida cinco de la estación del Ayuntamiento? Llevaré treinta euros en efectivo.",
    options: [
      "Mañana a las cinco, salida cinco, treinta euros",
      "Mañana a las cinco de la mañana, salida cinco, treinta euros",
      "Mañana a las cinco, salida tres, cincuenta euros",
      "Pasado mañana a las cinco, salida cinco, treinta euros",
    ],
    answerIndex: 0,
  },
  {
    cefr: "B2",
    prompt: "Según el aviso, ¿qué es correcto?",
    audioScript:
      "Aviso de la administración: desde la próxima semana, la basura orgánica se saca después de las ocho de la tarde, menos los domingos. Habrá multa si no se cumple y se ruega evitar ruidos en el pasillo por la noche.",
    options: [
      "La basura se saca por la mañana",
      "Los domingos también se saca a las ocho",
      "Si no se cumple hay multa",
      "No importa el ruido en el pasillo",
    ],
    answerIndex: 2,
  },
  // 2026-09-23 depth pass: B1-C2 block toward en parity (10→23).
  {
    cefr: "B1",
    prompt: "¿Cómo debería ir al aeropuerto?",
    audioScript:
      "Si vas en taxi al aeropuerto ahora te vas a quedar atascado. Coge la línea dos del metro hasta la terminal y cambia al exprés del aeropuerto; en total son unos cuarenta minutos.",
    options: [
      "En taxi",
      "En el autobús del aeropuerto",
      "Línea dos del metro y luego el exprés del aeropuerto",
      "En coche por la autopista",
    ],
    answerIndex: 2,
  },
  {
    cefr: "B1",
    prompt: "¿Cuál es el plato estrella del restaurante?",
    audioScript:
      "Nuestro plato estrella son los tallarines con ternera estofada. El especial de hoy, eso sí, es el pescado al vapor, con arroz incluido por quince euros.",
    options: [
      "Los tallarines con ternera",
      "El pescado al vapor",
      "El menú de tallarines",
      "El arroz frito",
    ],
    answerIndex: 0,
  },
  {
    cefr: "B1",
    prompt: "¿Adónde se ha trasladado la reunión de mañana?",
    audioScript:
      "La reunión de mañana era en la salita de la tercera planta, pero como hay más asistentes, la hemos movido al salón de actos de la primera. La hora sigue siendo las dos de la tarde.",
    options: [
      "La salita de la tercera planta",
      "El salón de actos de la primera planta",
      "La sala de juntas de la segunda planta",
      "Se hará en línea",
    ],
    answerIndex: 1,
  },
  {
    cefr: "B2",
    prompt: "¿Por qué se ha aplazado el lanzamiento del producto?",
    audioScript:
      "El lanzamiento previsto para el mes que viene se aplaza al tercer trimestre: la cadena de suministro de los componentes clave aún no se ha recuperado y en fase de pruebas han aparecido varios fallos que hay que corregir.",
    options: [
      "Falta de demanda",
      "La cadena de suministro no se ha recuperado y hay fallos en las pruebas",
      "No se consiguió el recinto",
      "Falta de personal",
    ],
    answerIndex: 1,
  },
  {
    cefr: "B2",
    prompt: "¿Cuál es la nueva norma del gimnasio para socios anuales?",
    audioScript:
      "A partir del mes que viene, los socios anuales pueden traer a un acompañante gratis dos veces, siempre que reserven antes en la aplicación; el mismo día no se podrá.",
    options: [
      "Pueden traer acompañantes gratis cuando quieran",
      "Los socios anuales pueden pausar un mes gratis",
      "El acompañante paga la mitad",
      "Con reserva previa en la app, dos acompañamientos gratis",
    ],
    answerIndex: 3,
  },
  {
    cefr: "B2",
    prompt: "¿Qué opina el hablante de este correo?",
    audioScript:
      "Este correo está redactado de forma ambigua: no indica la fecha límite ni el techo presupuestario. Mejor aclararlo antes de ponerse manos a la obra.",
    options: [
      "Está muy satisfecho",
      "Hay que ejecutarlo ya",
      "Mejor aclararlo antes de empezar",
      "Hay que quejarse al remitente",
    ],
    answerIndex: 2,
  },
  {
    cefr: "C1",
    prompt: "¿Cuál es el principal punto de controversia de la norma?",
    audioScript:
      "La nueva norma obliga a los conductores de VTC a tener empadronamiento o residencia local. Sus defensores dicen que garantiza la calidad del servicio; los detractores advierten de que agravará la escasez de conductores y expulsará a quienes lo hacen a tiempo parcial.",
    options: [
      "El requisito de residencia local para conductores",
      "Que el precio es demasiado alto",
      "Que los estándares de vehículo son muy estrictos",
      "La comisión de las plataformas",
    ],
    answerIndex: 0,
  },
  {
    cefr: "C1",
    prompt: "¿Cuál es, según el hablante, la causa raíz del fracaso del equipo?",
    audioScript:
      "En apariencia, el retraso del proyecto se debe a la falta de personal; pero en el fondo, el problema es que definimos un alcance de requisitos demasiado amplio, lo que provocó rehaceres continuos al final.",
    options: [
      "La falta de personal",
      "El sobrecoste",
      "Las exigencias del cliente",
      "Un alcance de requisitos demasiado amplio",
    ],
    answerIndex: 3,
  },
  {
    cefr: "C1",
    prompt: "¿Cuál es el principal cuello de botella de esta tecnología?",
    audioScript:
      "Las baterías de estado sólido pueden duplicar la densidad energética en teoría, pero el rendimiento de la producción en masa no despega y el coste no baja, así que a corto plazo se limitarán a los modelos de gama alta.",
    options: [
      "La densidad energética es baja",
      "La carga es lenta",
      "El rendimiento de producción y el coste",
      "El rendimiento en frío",
    ],
    answerIndex: 2,
  },
  {
    cefr: "C1",
    prompt: "¿Qué opina el hablante del teletrabajo?",
    audioScript:
      "El teletrabajo sí ahorra el tiempo de desplazamiento, pero a la larga se nota que faltan esas chispas de ideas que salen en conversaciones de pasillo, y los nuevos tardan visiblemente más en crecer.",
    options: [
      "Tiene ventajas pero también costes ocultos",
      "Lo apoya totalmente",
      "Está totalmente en contra",
      "Solo sirve a grandes empresas",
    ],
    answerIndex: 0,
  },
  {
    cefr: "C2",
    prompt: "¿Cómo valora el hablante esta biografía?",
    audioScript:
      "Esta biografía presume de retratar al personaje 'real', pero ante las decisiones clave de sus últimos años el autor siempre se queda en vaguedades, y lo que llama nuevas fuentes resultan ser, vistas de cerca, citas de segunda mano.",
    options: [
      "Las fuentes son detalladas y objetivas",
      "La prosa es conmovedora",
      "Revierte por completo la valoración tradicional",
      "Presume de rigor pero es vaga en lo esencial",
    ],
    answerIndex: 3,
  },
  {
    cefr: "C2",
    prompt: "¿Qué actitud tiene el hablante hacia este estudio?",
    audioScript:
      "La correlación que halla el estudio es interesante, pero la muestra apenas supera los doscientos y además son datos transversales; hablar de causalidad me parece prematuro.",
    options: [
      "Lo acepta por completo",
      "Muestra pequeña y datos transversales: la causalidad es prematura",
      "La muestra es suficiente",
      "El estudio no tiene valor",
    ],
    answerIndex: 1,
  },
  {
    cefr: "C2",
    prompt: "¿Dónde está el punto de bloqueo de la negociación?",
    audioScript:
      "En la mesa ambas partes dicen estar dispuestas a ceder, pero en cuanto se toca la cláusula nuclear —a quién pertenece la soberanía de los datos— ninguna quiere moverse primero, y así seguimos.",
    options: [
      "El conflicto de agendas",
      "La mala interpretación",
      "La soberanía de los datos: ninguno cede primero",
      "La ausencia de un mediador",
    ],
    answerIndex: 2,
  },
];
// ES listening 自查：
// L1 A2 answer 0=Hasta la una（una无重音✓）。干扰lun-vie/domingos信息混淆。拼写：farmacía→farmacia✓（无重音才对）。无重复（现有无farmacia）。
// L2 A2 answer 1=segundo piso…（sino否定前项防送分）。cumpleaños合写✓。现有fin de semana=biblioteca不同。
// L3 B1 answer 3=14:00+tercera+interna（时间地点科室三要素组合，部分正确陷阱2个）。médica✓。现有reunión=15:00二楼不同。
// L4 B1 answer 0=mañana+cinco+salida cinco+treinta（数字三要素换位陷阱：mañana/a.m./tres/cincuenta/pasado mañana）。estación✓。
// L5 B2 answer 2=multa（administración重音✓，orgánica✓）。肯定问法+3个反向陈述。现有无comunidad题。
// 答案分布 listening：0,1,3,0,2 → 0x2,1x1,2x1,3x1，分散OK。

// ============ ES OPEN 新增：4题（speaking2/writing2） ============
const esOpenNew = [
  {
    module: "speaking",
    prompt: "Habla en español ~1 min sobre una visita a un mercado o fiesta local: qué compraste, qué precios había y cómo te sentiste.",
    cefr: "B1",
  },
  {
    module: "speaking",
    prompt: "Elige la norma de transporte público que te parezca más importante y explícala con razones y una experiencia propia.",
    cefr: "B2",
  },
  {
    module: "writing",
    prompt: "Escribe ~150 palabras con la reseña de una fiesta o mercado de tu barrio: cuándo, con quién y qué hiciste.",
    cefr: "B1",
  },
  {
    module: "writing",
    prompt: "Escribe ~200 palabras con soluciones para el tráfico en hora punta y sus ventajas e inconvenientes.",
    cefr: "B2",
  },
];
// ES open 自查：现有open=preséntateA2/ciudadB1/por quéB1/onlineB2，本组mercado-fiesta speakingB1/transporte speakingB2/reseña writingB1/tráfico writingB2无重复；cefr与篇幅匹配；拼写自查：reseña✓、tráfico✓、público✓、música无误用、¿?齐全。

// ============ 总自查 ============
// 数量：KO reading 2篇10题(listening 5/open 4)；ES reading 2篇10题(listening 5/open 4)。“2篇5题”按每篇5题足量交付（≥任一解读）。
// options均为4个，answerIndex逐题核对原文；干扰项≥2个合理但错（主体混淆/数字换位/态度反转/邻域概念）。
// cefr：B1事实定位短句篇~150词，B2主旨/词汇推理/立场篇~150词；listening A2x2+B1x2+B2x1；open B1经验/B2论证。
// 去重：KO避开서울通勤/재택근무/부산행기차/커피머핀/비우산/오후3시회의/도서관；ES避开Madrid-metro/teletrabajo/Barcelona-tren/café-muffin/paraguas/reunión-15h/biblioteca-examen。
// 答案分布：KO全15 MCQ=0x5,1x5,2x2,3x3；ES全15 MCQ=0x5,1x3,2x3,3x4——无连续4题同值，无全员1（现有pack通病），分散达标。
// 原创： Valleverde Fiesta de la Cosecha / 남대문시장当日虚构游记均为虚构原创，非真题； `npm run generate-packs` 未运行，未改 data/packs。

// —— Vocabulary deepening: +30 real bank-verified words (band 2 then band 3,
// ordered by rank) + 10 pseudowords per language, keeping the 3:1 design.
// Indices 40-49 land on C1, 50-79 on C2 via cefr(i).
const zhWordsAdd = [
  { word: "开车", fake: false },
  { word: "歧视", fake: false },
  { word: "元素", fake: false },
  { word: "扮演", fake: false },
  { word: "透明", fake: false },
  { word: "心脏", fake: false },
  { word: "老实", fake: false },
  { word: "台风", fake: false },
  { word: "图案", fake: false },
  { word: "实习", fake: false },
  { word: "兑换", fake: false },
  { word: "欺负", fake: false },
  { word: "采集", fake: false },
  { word: "康复", fake: false },
  { word: "无视", fake: false },
  { word: "掩饰", fake: false },
  { word: "探测", fake: false },
  { word: "水源", fake: false },
  { word: "轻微", fake: false },
  { word: "预见", fake: false },
  { word: "库存", fake: false },
  { word: "祝贺", fake: false },
  { word: "概率", fake: false },
  { word: "注意力", fake: false },
  { word: "消防", fake: false },
  { word: "豪华", fake: false },
  { word: "镜子", fake: false },
  { word: "迟到", fake: false },
  { word: "早餐", fake: false },
  { word: "生病", fake: false },
  { word: "歧试", fake: true },
  { word: "元愫", fake: true },
  { word: "心赃", fake: true },
  { word: "合风", fake: true },
  { word: "图安", fake: true },
  { word: "实刁", fake: true },
  { word: "投拆", fake: true },
  { word: "段炼", fake: true },
  { word: "钱抱", fake: true },
  { word: "透朋", fake: true },
  // 2026-09-23 depth pass: +30 real advanced words +10 pseudowords (keeps 3:1).
  { word: "权衡", fake: false },
  { word: "妥协", fake: false },
  { word: "酝酿", fake: false },
  { word: "悬殊", fake: false },
  { word: "勘察", fake: false },
  { word: "敷衍", fake: false },
  { word: "忌讳", fake: false },
  { word: "颠簸", fake: false },
  { word: "斡旋", fake: false },
  { word: "诙谐", fake: false },
  { word: "斟酌", fake: false },
  { word: "枢纽", fake: false },
  { word: "跋涉", fake: false },
  { word: "摊贩", fake: false },
  { word: "赡养", fake: false },
  { word: "肇事", fake: false },
  { word: "拘泥", fake: false },
  { word: "诬陷", fake: false },
  { word: "佐证", fake: false },
  { word: "悖论", fake: false },
  { word: "甄别", fake: false },
  { word: "履历", fake: false },
  { word: "蓦然", fake: false },
  { word: "跻身", fake: false },
  { word: "豁免", fake: false },
  { word: "坎坷", fake: false },
  { word: "缄默", fake: false },
  { word: "缜密", fake: false },
  { word: "亵渎", fake: false },
  { word: "譬如", fake: false },
  // Pseudowords: real characters in non-word combos or near-miss glyphs.
  { word: "权横", fake: true },
  { word: "妥胁", fake: true },
  { word: "酝踉", fake: true },
  { word: "悬珠", fake: true },
  { word: "勘擦", fake: true },
  { word: "敷延", fake: true },
  { word: "忌违", fake: true },
  { word: "颠跛", fake: true },
  { word: "斡旅", fake: true },
  { word: "恢谐", fake: true },
  // 2026-09-23 depth pass 2: +30 real +10 pseudowords (keeps 3:1).
  { word: "磋商", fake: false },
  { word: "篡改", fake: false },
  { word: "威慑", fake: false },
  { word: "更迭", fake: false },
  { word: "掣肘", fake: false },
  { word: "揶揄", fake: false },
  { word: "觊觎", fake: false },
  { word: "囹圄", fake: false },
  { word: "趔趄", fake: false },
  { word: "龃龉", fake: false },
  { word: "侥幸", fake: false },
  { word: "迂回", fake: false },
  { word: "搁浅", fake: false },
  { word: "舆论", fake: false },
  { word: "舞弊", fake: false },
  { word: "督导", fake: false },
  { word: "磨砺", fake: false },
  { word: "契合", fake: false },
  { word: "颁布", fake: false },
  { word: "仲裁", fake: false },
  { word: "瑕疵", fake: false },
  { word: "青睐", fake: false },
  { word: "雏形", fake: false },
  { word: "陷阱", fake: false },
  { word: "搁置", fake: false },
  { word: "流逝", fake: false },
  { word: "匮乏", fake: false },
  { word: "演绎", fake: false },
  { word: "推诿", fake: false },
  { word: "勾当", fake: false },
  // Pseudowords: near-miss glyphs; none are real words.
  { word: "磋伤", fake: true },
  { word: "纂改", fake: true },
  { word: "威摄", fake: true },
  { word: "更跌", fake: true },
  { word: "掣时", fake: true },
  { word: "揶榆", fake: true },
  { word: "凯觎", fake: true },
  { word: "囹悟", fake: true },
  { word: "趔趋", fake: true },
  { word: "龃龆", fake: true },
  // 2026-09-23 depth pass 3: +30 real +10 pseudowords (keeps 3:1).
  { word: "弹劾", fake: false },
  { word: "赦免", fake: false },
  { word: "驱逐", fake: false },
  { word: "通缉", fake: false },
  { word: "审判", fake: false },
  { word: "辩护", fake: false },
  { word: "证词", fake: false },
  { word: "阴谋", fake: false },
  { word: "叛乱", fake: false },
  { word: "起义", fake: false },
  { word: "同盟", fake: false },
  { word: "领土", fake: false },
  { word: "主权", fake: false },
  { word: "外交", fake: false },
  { word: "谈判", fake: false },
  { word: "签署", fake: false },
  { word: "审议", fake: false },
  { word: "表决", fake: false },
  { word: "公投", fake: false },
  { word: "否决", fake: false },
  { word: "制裁", fake: false },
  { word: "干预", fake: false },
  { word: "掠夺", fake: false },
  { word: "垄断", fake: false },
  { word: "倾销", fake: false },
  { word: "蔓延", fake: false },
  { word: "检疫", fake: false },
  { word: "潜伏", fake: false },
  { word: "迸发", fake: false },
  { word: "晦涩", fake: false },
  // Pseudowords: near-miss glyphs; none are real words.
  { word: "弹刻", fake: true },
  { word: "郝免", fake: true },
  { word: "驱遂", fake: true },
  { word: "通辑", fake: true },
  { word: "审半", fake: true },
  { word: "辩扩", fake: true },
  { word: "证祠", fake: true },
  { word: "阴某", fake: true },
  { word: "叛乩", fake: true },
  { word: "签暑", fake: true },
  // 2026-09-23 depth pass 4: +15 real +5 pseudowords (keeps 3:1; 220 total ≈ en 219).
  { word: "拘留", fake: false },
  { word: "引渡", fake: false },
  { word: "缓刑", fake: false },
  { word: "假释", fake: false },
  { word: "腐败", fake: false },
  { word: "渎职", fake: false },
  { word: "贪污", fake: false },
  { word: "贿赂", fake: false },
  { word: "检举", fake: false },
  { word: "立案", fake: false },
  { word: "侦查", fake: false },
  { word: "起诉", fake: false },
  { word: "庭审", fake: false },
  { word: "量刑", fake: false },
  { word: "上诉", fake: false },
  // Pseudowords: near-miss glyphs; none are real words.
  { word: "拘遛", fake: true },
  { word: "引度", fake: true },
  { word: "缓形", fake: true },
  { word: "假择", fake: true },
  { word: "渎积", fake: true },
];
const koWordsAdd = [
  { word: "기기", fake: false },
  { word: "사원", fake: false },
  { word: "진리", fake: false },
  { word: "생애", fake: false },
  { word: "임기", fake: false },
  { word: "항공사", fake: false },
  { word: "간부", fake: false },
  { word: "수소", fake: false },
  { word: "보정", fake: false },
  { word: "추후", fake: false },
  { word: "갱신", fake: false },
  { word: "무인", fake: false },
  { word: "비밀번호", fake: false },
  { word: "오토바이", fake: false },
  { word: "의의", fake: false },
  { word: "응모", fake: false },
  { word: "개정안", fake: false },
  { word: "캠핑", fake: false },
  { word: "후원자", fake: false },
  { word: "뺨", fake: false },
  { word: "농부", fake: false },
  { word: "벚꽃", fake: false },
  { word: "안개", fake: false },
  { word: "코끼리", fake: false },
  { word: "메달", fake: false },
  { word: "버섯", fake: false },
  { word: "딸기", fake: false },
  { word: "약국", fake: false },
  { word: "사슴", fake: false },
  { word: "달걀", fake: false },
  { word: "사원음", fake: true },
  { word: "생애솟", fake: true },
  { word: "임기릿", fake: true },
  { word: "항공샤", fake: true },
  { word: "간부돈", fake: true },
  { word: "수소캠", fake: true },
  { word: "보정킷", fake: true },
  { word: "추후론", fake: true },
  { word: "의의뭇", fake: true },
  { word: "개정앟", fake: true },
  // 2026-09-23 depth pass: +30 real advanced words +10 pseudowords (keeps 3:1).
  { word: "중재", fake: false },
  { word: "양보", fake: false },
  { word: "타협", fake: false },
  { word: "격차", fake: false },
  { word: "절차", fake: false },
  { word: "허용", fake: false },
  { word: "금지", fake: false },
  { word: "성실", fake: false },
  { word: "근거", fake: false },
  { word: "명예", fake: false },
  { word: "위반", fake: false },
  { word: "유지", fake: false },
  { word: "제한", fake: false },
  { word: "촉진", fake: false },
  { word: "감독", fake: false },
  { word: "번영", fake: false },
  { word: "우려", fake: false },
  { word: "갈등", fake: false },
  { word: "훼손", fake: false },
  { word: "반영", fake: false },
  { word: "모순", fake: false },
  { word: "축적", fake: false },
  { word: "완화", fake: false },
  { word: "잠정", fake: false },
  { word: "담보", fake: false },
  { word: "면제", fake: false },
  { word: "철저", fake: false },
  { word: "신중", fake: false },
  { word: "격려", fake: false },
  { word: "협상", fake: false },
  // Pseudowords: plausible Hangul combos that are not real words.
  { word: "중재곤", fake: true },
  { word: "양보흠", fake: true },
  { word: "타협릿", fake: true },
  { word: "격차늠", fake: true },
  { word: "절차뭇", fake: true },
  { word: "허용캄", fake: true },
  { word: "금지롯", fake: true },
  { word: "성실팟", fake: true },
  { word: "근거휸", fake: true },
  { word: "명예즙", fake: true },
  // 2026-09-23 depth pass 2: +30 real +10 pseudowords (keeps 3:1).
  { word: "규제", fake: false },
  { word: "부패", fake: false },
  { word: "위임", fake: false },
  { word: "조정", fake: false },
  { word: "분쟁", fake: false },
  { word: "타당", fake: false },
  { word: "소홀", fake: false },
  { word: "침해", fake: false },
  { word: "유예", fake: false },
  { word: "담합", fake: false },
  { word: "편견", fake: false },
  { word: "역행", fake: false },
  { word: "정밀", fake: false },
  { word: "실추", fake: false },
  { word: "폐지", fake: false },
  { word: "규탄", fake: false },
  { word: "심사", fake: false },
  { word: "격하", fake: false },
  { word: "억제", fake: false },
  { word: "파기", fake: false },
  { word: "징계", fake: false },
  { word: "유착", fake: false },
  { word: "기소", fake: false },
  { word: "변론", fake: false },
  { word: "탄핵", fake: false },
  { word: "준수", fake: false },
  { word: "위조", fake: false },
  { word: "선임", fake: false },
  { word: "쟁점", fake: false },
  { word: "도출", fake: false },
  // Pseudowords: plausible Hangul combos that are not real words.
  { word: "규제혹", fake: true },
  { word: "부패숏", fake: true },
  { word: "위임툇", fake: true },
  { word: "조정휸", fake: true },
  { word: "분쟁퓻", fake: true },
  { word: "타당쐈", fake: true },
  { word: "소홀뇻", fake: true },
  { word: "침해퐀", fake: true },
  { word: "유예뇽", fake: true },
  { word: "담합퓾", fake: true },
  // 2026-09-23 depth pass 3: +30 real +10 pseudowords (keeps 3:1).
  { word: "헌법", fake: false },
  { word: "재판", fake: false },
  { word: "증언", fake: false },
  { word: "음모", fake: false },
  { word: "반란", fake: false },
  { word: "동맹", fake: false },
  { word: "영토", fake: false },
  { word: "주권", fake: false },
  { word: "외교", fake: false },
  { word: "서명", fake: false },
  { word: "심의", fake: false },
  { word: "표결", fake: false },
  { word: "거부", fake: false },
  { word: "제재", fake: false },
  { word: "개입", fake: false },
  { word: "약탈", fake: false },
  { word: "독점", fake: false },
  { word: "검역", fake: false },
  { word: "발발", fake: false },
  { word: "잠복", fake: false },
  { word: "암시", fake: false },
  { word: "상속", fake: false },
  { word: "유산", fake: false },
  { word: "집행", fake: false },
  { word: "판결", fake: false },
  { word: "원고", fake: false },
  { word: "피고", fake: false },
  { word: "소송", fake: false },
  { word: "항소", fake: false },
  { word: "구속", fake: false },
  // Pseudowords: plausible Hangul combos that are not real words.
  { word: "헌볍", fake: true },
  { word: "재퍈", fake: true },
  { word: "증엊", fake: true },
  { word: "음뫄", fake: true },
  { word: "반릏", fake: true },
  { word: "동맹퓲", fake: true },
  { word: "영톳", fake: true },
  { word: "주권퉞", fake: true },
  { word: "외규", fake: true },
  { word: "서멍", fake: true },
  // 2026-09-23 depth pass 4: +15 real +5 pseudowords (keeps 3:1; 220 total ≈ en 219).
  { word: "구류", fake: false },
  { word: "인도", fake: false },
  { word: "가석방", fake: false },
  { word: "부정", fake: false },
  { word: "횡령", fake: false },
  { word: "뇌물", fake: false },
  { word: "고발", fake: false },
  { word: "입건", fake: false },
  { word: "수사", fake: false },
  { word: "공소", fake: false },
  { word: "공판", fake: false },
  { word: "양형", fake: false },
  { word: "상고", fake: false },
  { word: "심리", fake: false },
  { word: "소집", fake: false },
  // Pseudowords: plausible Hangul combos that are not real words.
  { word: "구륐", fake: true },
  { word: "인돝", fake: true },
  { word: "가석발", fake: true },
  { word: "부정퓏", fake: true },
  { word: "횡렋", fake: true },
];
const jaWordsAdd = [
  { word: "酸", fake: false },
  { word: "国立", fake: false },
  { word: "驚く", fake: false },
  { word: "政党", fake: false },
  { word: "新鮮", fake: false },
  { word: "喜ぶ", fake: false },
  { word: "削減", fake: false },
  { word: "共感", fake: false },
  { word: "冷凍", fake: false },
  { word: "落ちる", fake: false },
  { word: "まもなく", fake: false },
  { word: "祈り", fake: false },
  { word: "中断", fake: false },
  { word: "前者", fake: false },
  { word: "吸う", fake: false },
  { word: "月刊", fake: false },
  { word: "小規模", fake: false },
  { word: "合宿", fake: false },
  { word: "入居", fake: false },
  { word: "穏やか", fake: false },
  { word: "遅刻", fake: false },
  { word: "じっくり", fake: false },
  { word: "借りる", fake: false },
  { word: "景色", fake: false },
  { word: "踊る", fake: false },
  { word: "直す", fake: false },
  { word: "贈り物", fake: false },
  { word: "運ぶ", fake: false },
  { word: "祝日", fake: false },
  { word: "絵画", fake: false },
  { word: "驚くき", fake: true },
  { word: "政冶", fake: true },
  { word: "新鮮み", fake: true },
  { word: "共感る", fake: true },
  { word: "削減い", fake: true },
  { word: "中折", fake: true },
  { word: "月刋", fake: true },
  { word: "入剧", fake: true },
  { word: "穏やから", fake: true },
  { word: "贈り物ね", fake: true },
  // 2026-09-23 depth pass: +30 real advanced words +10 pseudowords (keeps 3:1).
  { word: "仲裁", fake: false },
  { word: "妥協", fake: false },
  { word: "醸成", fake: false },
  { word: "格差", fake: false },
  { word: "手順", fake: false },
  { word: "許可", fake: false },
  { word: "禁止", fake: false },
  { word: "誠実", fake: false },
  { word: "根拠", fake: false },
  { word: "名誉", fake: false },
  { word: "違反", fake: false },
  { word: "維持", fake: false },
  { word: "促進", fake: false },
  { word: "監督", fake: false },
  { word: "繁栄", fake: false },
  { word: "懸念", fake: false },
  { word: "葛藤", fake: false },
  { word: "毀損", fake: false },
  { word: "反映", fake: false },
  { word: "矛盾", fake: false },
  { word: "蓄積", fake: false },
  { word: "緩和", fake: false },
  { word: "暫定", fake: false },
  { word: "担保", fake: false },
  { word: "免除", fake: false },
  { word: "徹底", fake: false },
  { word: "慎重", fake: false },
  { word: "奨励", fake: false },
  { word: "邂逅", fake: false },
  { word: "履行", fake: false },
  // Pseudowords: kanji near-misses or stray kana; none are real words.
  { word: "仲栽", fake: true },
  { word: "妥脅", fake: true },
  { word: "醸戊", fake: true },
  { word: "格査", fake: true },
  { word: "手準", fake: true },
  { word: "許呵", fake: true },
  { word: "金止", fake: true },
  { word: "誠芙", fake: true },
  { word: "根拘", fake: true },
  { word: "名養", fake: true },
  // 2026-09-23 depth pass 2: +30 real +10 pseudowords (keeps 3:1).
  { word: "規制", fake: false },
  { word: "腐敗", fake: false },
  { word: "委任", fake: false },
  { word: "調整", fake: false },
  { word: "紛争", fake: false },
  { word: "怠慢", fake: false },
  { word: "侵害", fake: false },
  { word: "猶予", fake: false },
  { word: "談合", fake: false },
  { word: "偏見", fake: false },
  { word: "緻密", fake: false },
  { word: "廃止", fake: false },
  { word: "糾弾", fake: false },
  { word: "審査", fake: false },
  { word: "降格", fake: false },
  { word: "抑止", fake: false },
  { word: "破棄", fake: false },
  { word: "懲戒", fake: false },
  { word: "癒着", fake: false },
  { word: "起訴", fake: false },
  { word: "弁論", fake: false },
  { word: "弾劾", fake: false },
  { word: "遵守", fake: false },
  { word: "偽造", fake: false },
  { word: "選任", fake: false },
  { word: "論点", fake: false },
  { word: "導出", fake: false },
  { word: "閑静", fake: false },
  { word: "巧妙", fake: false },
  { word: "露出", fake: false },
  // Pseudowords: kanji near-misses; none are real words.
  { word: "規剌", fake: true },
  { word: "腐拝", fake: true },
  { word: "委壬", fake: true },
  { word: "猶于", fake: true },
  { word: "談恰", fake: true },
  { word: "偏貝", fake: true },
  { word: "廃上", fake: true },
  { word: "糾殫", fake: true },
  { word: "審差", fake: true },
  { word: "弾刻", fake: true },
  // 2026-09-23 depth pass 3: +30 real +10 pseudowords (keeps 3:1).
  { word: "憲法", fake: false },
  { word: "裁判", fake: false },
  { word: "証言", fake: false },
  { word: "陰謀", fake: false },
  { word: "反乱", fake: false },
  { word: "同盟", fake: false },
  { word: "領土", fake: false },
  { word: "主権", fake: false },
  { word: "外交", fake: false },
  { word: "交渉", fake: false },
  { word: "署名", fake: false },
  { word: "審議", fake: false },
  { word: "表決", fake: false },
  { word: "否決", fake: false },
  { word: "制裁", fake: false },
  { word: "介入", fake: false },
  { word: "略奪", fake: false },
  { word: "独占", fake: false },
  { word: "検疫", fake: false },
  { word: "発生", fake: false },
  { word: "潜伏", fake: false },
  { word: "暗示", fake: false },
  { word: "相続", fake: false },
  { word: "遺産", fake: false },
  { word: "執行", fake: false },
  { word: "判決", fake: false },
  { word: "原告", fake: false },
  { word: "被告", fake: false },
  { word: "訴訟", fake: false },
  { word: "控訴", fake: false },
  // Pseudowords: kanji near-misses; none are real words.
  { word: "憲怯", fake: true },
  { word: "裁半", fake: true },
  { word: "証盲", fake: true },
  { word: "陰某", fake: true },
  { word: "領上", fake: true },
  { word: "主椎", fake: true },
  { word: "外父", fake: true },
  { word: "署各", fake: true },
  { word: "審義", fake: true },
  { word: "判快", fake: true },
  // 2026-09-23 depth pass 4: +15 real +5 pseudowords (keeps 3:1; 220 total ≈ en 219).
  { word: "拘留", fake: false },
  { word: "引渡", fake: false },
  { word: "仮釈放", fake: false },
  { word: "不正", fake: false },
  { word: "横領", fake: false },
  { word: "賄賂", fake: false },
  { word: "告発", fake: false },
  { word: "立件", fake: false },
  { word: "捜査", fake: false },
  { word: "公判", fake: false },
  { word: "量刑", fake: false },
  { word: "上告", fake: false },
  { word: "審理", fake: false },
  { word: "召喚", fake: false },
  { word: "汚職", fake: false },
  // Pseudowords: kanji near-misses; none are real words.
  { word: "拘溜", fake: true },
  { word: "引菠", fake: true },
  { word: "横颈", fake: true },
  { word: "賄路", fake: true },
  { word: "告荒", fake: true },
];
const esWordsAdd = [
  { word: "enfermo", fake: false },
  { word: "aventura", fake: false },
  { word: "débil", fake: false },
  { word: "instante", fake: false },
  { word: "básico", fake: false },
  { word: "matemáticas", fake: false },
  { word: "campamento", fake: false },
  { word: "cuenca", fake: false },
  { word: "ascenso", fake: false },
  { word: "seminario", fake: false },
  { word: "columnas", fake: false },
  { word: "escritora", fake: false },
  { word: "exploración", fake: false },
  { word: "derivados", fake: false },
  { word: "enamorada", fake: false },
  { word: "divertida", fake: false },
  { word: "funda", fake: false },
  { word: "conversión", fake: false },
  { word: "disolución", fake: false },
  { word: "complicidad", fake: false },
  { word: "algodón", fake: false },
  { word: "exilio", fake: false },
  { word: "pistola", fake: false },
  { word: "conectar", fake: false },
  { word: "explorar", fake: false },
  { word: "leal", fake: false },
  { word: "dragón", fake: false },
  { word: "rechazar", fake: false },
  { word: "honestidad", fake: false },
  { word: "verificar", fake: false },
  { word: "dévil", fake: true },
  { word: "instannte", fake: true },
  { word: "matemátiquas", fake: true },
  { word: "campamanto", fake: true },
  { word: "cuensa", fake: true },
  { word: "seminerio", fake: true },
  { word: "colummnas", fake: true },
  { word: "exploracíon", fake: true },
  { word: "derivadus", fake: true },
  { word: "complecidad", fake: true },
  // 2026-09-23 depth pass: +30 real advanced words +10 pseudowords (keeps 3:1).
  { word: "mediación", fake: false },
  { word: "consenso", fake: false },
  { word: "disputa", fake: false },
  { word: "umbral", fake: false },
  { word: "escrutinio", fake: false },
  { word: "prudente", fake: false },
  { word: "riguroso", fake: false },
  { word: "obsoleto", fake: false },
  { word: "férreo", fake: false },
  { word: "ambiguo", fake: false },
  { word: "verosímil", fake: false },
  { word: "paradoja", fake: false },
  { word: "empatía", fake: false },
  { word: "hostilidad", fake: false },
  { word: "inminente", fake: false },
  { word: "precario", fake: false },
  { word: "rescate", fake: false },
  { word: "veto", fake: false },
  { word: "trama", fake: false },
  { word: "sigilo", fake: false },
  { word: "destreza", fake: false },
  { word: "avalancha", fake: false },
  { word: "regate", fake: false },
  { word: "escasez", fake: false },
  { word: "cosecha", fake: false },
  { word: "albañil", fake: false },
  { word: "bisagra", fake: false },
  { word: "cimientos", fake: false },
  { word: "enigma", fake: false },
  { word: "faceta", fake: false },
  // Pseudowords: letter/accent swaps producing plausible non-words.
  { word: "mediasión", fake: true },
  { word: "consenzo", fake: true },
  { word: "umbrel", fake: true },
  { word: "escrutonio", fake: true },
  { word: "rigurozo", fake: true },
  { word: "absaleto", fake: true },
  { word: "ambibuo", fake: true },
  { word: "berosímil", fake: true },
  { word: "paradoxa", fake: true },
  { word: "sigillo", fake: true },
  // 2026-09-23 depth pass 2: +30 real +10 pseudowords (keeps 3:1).
  { word: "agravio", fake: false },
  { word: "dictamen", fake: false },
  { word: "enmienda", fake: false },
  { word: "litigio", fake: false },
  { word: "merma", fake: false },
  { word: "peritaje", fake: false },
  { word: "quiebra", fake: false },
  { word: "recurso", fake: false },
  { word: "salvedad", fake: false },
  { word: "trance", fake: false },
  { word: "usura", fake: false },
  { word: "confidencia", fake: false },
  { word: "desenlace", fake: false },
  { word: "empeño", fake: false },
  { word: "fragancia", fake: false },
  { word: "gestoría", fake: false },
  { word: "hallazgo", fake: false },
  { word: "impedimento", fake: false },
  { word: "juerga", fake: false },
  { word: "legado", fake: false },
  { word: "navaja", fake: false },
  { word: "oleada", fake: false },
  { word: "plagio", fake: false },
  { word: "quiste", fake: false },
  { word: "rebaja", fake: false },
  { word: "saqueo", fake: false },
  { word: "tanteo", fake: false },
  { word: "utopía", fake: false },
  { word: "vereda", fake: false },
  { word: "yunque", fake: false },
  // Pseudowords: letter/accent swaps producing plausible non-words.
  { word: "agravío", fake: true },
  { word: "dictame", fake: true },
  { word: "enmiendia", fake: true },
  { word: "litigío", fake: true },
  { word: "mérma", fake: true },
  { word: "peritaj", fake: true },
  { word: "quíebra", fake: true },
  { word: "recuerso", fake: true },
  { word: "salbedad", fake: true },
  { word: "usurra", fake: true },
  // 2026-09-23 depth pass 3: +30 real +10 pseudowords (keeps 3:1).
  { word: "constitución", fake: false },
  { word: "juicio", fake: false },
  { word: "testimonio", fake: false },
  { word: "conspiración", fake: false },
  { word: "rebelión", fake: false },
  { word: "alianza", fake: false },
  { word: "territorio", fake: false },
  { word: "soberanía", fake: false },
  { word: "diplomacia", fake: false },
  { word: "firma", fake: false },
  { word: "deliberación", fake: false },
  { word: "votación", fake: false },
  { word: "referéndum", fake: false },
  { word: "sanción", fake: false },
  { word: "intervención", fake: false },
  { word: "expolio", fake: false },
  { word: "monopolio", fake: false },
  { word: "cuarentena", fake: false },
  { word: "estallido", fake: false },
  { word: "latente", fake: false },
  { word: "indicios", fake: false },
  { word: "herencia", fake: false },
  { word: "ejecución", fake: false },
  { word: "sentencia", fake: false },
  { word: "demandante", fake: false },
  { word: "demandado", fake: false },
  { word: "apelación", fake: false },
  { word: "secuestro", fake: false },
  { word: "cónclave", fake: false },
  { word: "amnistía", fake: false },
  // Pseudowords: letter/accent swaps producing plausible non-words.
  { word: "juissio", fake: true },
  { word: "testimoño", fake: true },
  { word: "conspirazión", fake: true },
  { word: "revelión", fake: true },
  { word: "aliança", fake: true },
  { word: "territorío", fake: true },
  { word: "soberanio", fake: true },
  { word: "diplomazia", fake: true },
  { word: "deliberazión", fake: true },
  { word: "monopolío", fake: true },
  // 2026-09-23 depth pass 4: +15 real +5 pseudowords (keeps 3:1; 220 total ≈ en 219).
  { word: "detención", fake: false },
  { word: "extradición", fake: false },
  { word: "corrupción", fake: false },
  { word: "malversación", fake: false },
  { word: "soborno", fake: false },
  { word: "denuncia", fake: false },
  { word: "imputación", fake: false },
  { word: "indagación", fake: false },
  { word: "fiscalía", fake: false },
  { word: "veredicto", fake: false },
  { word: "absolución", fake: false },
  { word: "condena", fake: false },
  { word: "indulto", fake: false },
  { word: "reclusión", fake: false },
  { word: "testigo", fake: false },
  // Pseudowords: letter/accent swaps producing plausible non-words.
  { word: "detenzión", fake: true },
  { word: "extradicion", fake: true },
  { word: "malversazión", fake: true },
  { word: "sobornno", fake: true },
  { word: "denuncía", fake: true },
];
// Original assessment expansion (2026-09-22), CC BY-SA 4.0.
// Append only: historical IDs, options and answer keys remain byte-identical.
zhGrammar.push(
  { cefr: "B1", prompt: "这道题连老师___没做出来，更别说我了。", options: ["都", "才", "再", "把"], answerIndex: 0 },
  { cefr: "B1", prompt: "___你已经决定了，我就尊重你的选择。", options: ["尽管", "既然", "除非", "无论"], answerIndex: 1 },
  { cefr: "B1", prompt: "他把钥匙忘在家里了，___进不了门。", options: ["然而", "否则", "因此", "尽管"], answerIndex: 2 },
  { cefr: "B1", prompt: "___有多忙，她每天都练习写字。", options: ["由于", "既然", "只有", "无论"], answerIndex: 3 },
);
// Gitea #16/#17: corrected replacements for the retired zh grammar items above.
// Retired rows stay byte-stable for historical session replay; replacements are
// appended only, carry `replaces` lineage and receive new sequential IDs.
zhGrammar.push(
  { cefr: "A1", prompt: "我___他三年了。", options: ["认识", "知道", "见面", "说"], answerIndex: 0, replaces: "zh-gra-006" },
  { cefr: "A2", prompt: "我从来没___这部电影。", options: ["看了", "看过", "看着", "看"], answerIndex: 1, replaces: "zh-gra-014" },
  { cefr: "A2", prompt: "他把名字___在纸上了。", options: ["写了", "写着", "写", "写过"], answerIndex: 2, replaces: "zh-gra-017" },
);
koGrammar.push(
  { cefr: "B1", prompt: "한국에 온 ___ 벌써 일 년이 되었어요.", options: ["지", "줄", "수", "적"], answerIndex: 0 },
  { cefr: "B1", prompt: "잊어버리지 ___ 수첩에 적어 두세요.", options: ["않지만", "않도록", "않느라고", "않더니"], answerIndex: 1 },
  { cefr: "B1", prompt: "이 음식을 먹어 본 ___이 없어요.", options: ["지", "수", "적", "때"], answerIndex: 2 },
  { cefr: "B1", prompt: "길이 막힐___ 봐 평소보다 일찍 출발했어요.", options: ["수록", "텐데", "지만", "까"], answerIndex: 3 },
);
jaGrammar.push(
  { cefr: "B1", prompt: "忘れない___、大事な予定を手帳に書いています。", options: ["ように", "ためで", "そうで", "ことに"], answerIndex: 0 },
  { cefr: "B1", prompt: "「明日は雪が降ります」と予報士が言っていました。伝聞の表現にすると「明日は雪が___そうです」。", options: ["降って", "降る", "降り", "降ったら"], answerIndex: 1 },
  { cefr: "B1", prompt: "医者に、しばらく運動を___ように言われました。", options: ["控えて", "控えた", "控える", "控えます"], answerIndex: 2 },
  { cefr: "B1", prompt: "明日は休みなので、早く起きる必要は___。", options: ["いません", "できません", "なりません", "ありません"], answerIndex: 3 },
);
esGrammar.push(
  { cefr: "B1", prompt: "No creo que Marta ___ la respuesta; nunca ha estudiado este tema.", options: ["sepa", "sabe", "saber", "sabrá"], answerIndex: 0 },
  { cefr: "B1", prompt: "Cuando ___ a casa esta noche, te llamaré.", options: ["llegaba", "llegue", "llegué", "llegando"], answerIndex: 1 },
  { cefr: "B1", prompt: "Busco un piso que ___ balcón; todavía no he encontrado ninguno.", options: ["tiene", "tuvo", "tenga", "tener"], answerIndex: 2 },
  { cefr: "B2", prompt: "Si me lo hubieras dicho ayer, te ___ ayudado.", options: ["había", "haya", "habré", "habría"], answerIndex: 3 },
);
// Original grammar depth (2026-09-22), CC BY-SA 4.0. Append only.
// One B1 point per language: result, contrast, purpose, simultaneous or concessive.
// Answer positions rotate 0/1/2/3. Historical rows above stay byte-stable.
zhGrammar.push(
  { cefr: "B1", prompt: "作业还没写___，所以他还不能出去玩。", options: ["完", "住", "着", "开"], answerIndex: 0 },
  { cefr: "B1", prompt: "___今天下雨，比赛还是照常进行。", options: ["因为", "虽然", "如果", "既然"], answerIndex: 1 },
  { cefr: "B1", prompt: "她___赶上第一班车，六点就出了门。", options: ["关于", "通过", "为了", "根据"], answerIndex: 2 },
  { cefr: "B1", prompt: "他喜欢___走路___听播客。", options: ["只有…才", "因为…所以", "虽然…但是", "一边…一边"], answerIndex: 3 },
);
koGrammar.push(
  { cefr: "B1", prompt: "아이가 실수로 주스를 쏟아___.", options: ["버렸어요", "봤어요", "있겠어요", "드렸어요"], answerIndex: 0 },
  { cefr: "B1", prompt: "어머니는 뉴스를 ___ 아침을 준비해요.", options: ["들으러", "들으면서", "들을수록", "듣도록"], answerIndex: 1 },
  { cefr: "B1", prompt: "면접에 늦지 않___ 한 시간 일찍 집을 나섰어요.", options: ["아서", "지만", "으려고", "으면서"], answerIndex: 2 },
  { cefr: "B1", prompt: "아무리 일이 많아___ 독서는 빠뜨리지 않아요.", options: ["서", "러", "면", "도"], answerIndex: 3 },
);
jaGrammar.push(
  { cefr: "B1", prompt: "うっかり大切なファイルを消して___。", options: ["しまいました", "おきました", "みました", "ありました"], answerIndex: 0 },
  { cefr: "B1", prompt: "音楽を___、同時に宿題も進めています。", options: ["聞いて", "聞きながら", "聞いたら", "聞くと"], answerIndex: 1 },
  { cefr: "B1", prompt: "明日の発表に備えて、昨夜は早く寝て___。", options: ["みました", "しまいました", "おきました", "ありました"], answerIndex: 2 },
  { cefr: "B1", prompt: "彼は薬を飲んだ___、まだ熱があります。", options: ["から", "ので", "たら", "のに"], answerIndex: 3 },
);
esGrammar.push(
  { cefr: "B1", prompt: "De niño, ___ al parque todos los domingos.", options: ["iba", "fui", "iré", "vaya"], answerIndex: 0 },
  { cefr: "B1", prompt: "Estudio español ___ trabajar en México el año que viene.", options: ["por", "para", "desde", "hacia"], answerIndex: 1 },
  { cefr: "B1", prompt: "No puedo salir: ___ de empezar a llover.", options: ["termino", "acabé", "acabo", "acababa"], answerIndex: 2 },
  { cefr: "B1", prompt: "A Luis ___ perdieron las llaves en el tren.", options: ["lo", "le se", "se lo", "se le"], answerIndex: 3 },
);

// Original grammar depth (2026-09-23), CC BY-SA 4.0. Append only.
// First B2/C1 points per language — packs previously capped at B1, so the
// adaptive assessment could not separate advanced learners on grammar.
// Answer positions rotate 0/1/2/3 to keep the newest-keys convention.
zhGrammar.push(
  { cefr: "B2", prompt: "他___拒绝这个职位，是因为要照顾家人。", options: ["之所以", "既然", "虽然", "不但"], answerIndex: 0 },
  // 自查：“之所以…是因为”因果框架，A正确；B/C/D均不能接“是因为”。
  { cefr: "B2", prompt: "___参加过培训的员工，都可以申请这次外派。", options: ["只有", "凡是", "即使", "不仅"], answerIndex: 1 },
  // 自查：“凡是…都”表全称范围，B正确；A需“只有…才”，C需“即使…也”，D“不仅”需递进分句。
  { cefr: "C1", prompt: "___他怎么解释，大家都不相信。", options: ["即使", "虽然", "任凭", "因为"], answerIndex: 2 },
  // 自查：“任凭…都”无条件让步，C正确；A需“也”、B需“但/却”呼应，D语义不合。
  { cefr: "B2", prompt: "他宁可自己加班，___让团队周末赶工。", options: ["只好", "也却", "反而", "也不"], answerIndex: 3 },
  // 自查：“宁可…也不”取舍结构，D正确；A“只好”不呼应宁可，B非词，C方向相反。
);
koGrammar.push(
  { cefr: "B2", prompt: "기차가 끊겼으니 버스로 갈 수___.", options: ["밖에 없어요", "해도 돼요", "려나요", "는 거예요"], answerIndex: 0 },
  // 自查：“갈 수밖에 없어요”（只能坐大巴）A正确；B/C/D语法不接或语义不通。
  { cefr: "B2", prompt: "너무 서두르면 실수하기 ___.", options: ["봐도 돼요", "기 마련이에요", "려고 해요", "는 게 좋아요"], answerIndex: 1 },
  // 自查：“-기 마련이다”（往往会）B正确；A/C语法不通，D“하기는 게 좋아요”不接。
  { cefr: "C1", prompt: "너무 빨리 먹으면 체하기 ___.", options: ["나 봐요", "해도 돼요", "십상이에요", "려고 해요"], answerIndex: 2 },
  // 自查：“-기 십상이다”（很容易会）C正确；A需“-나 보다”，B/D不接。
  { cefr: "B2", prompt: "많이 연습할___ 실력이 늘어요.", options: ["서도", "려니", "는데", "수록"], answerIndex: 3 },
  // 自查：“-을수록”（越…越）D正确；A/B/C均为错误黏着形式。
);
jaGrammar.push(
  { cefr: "B2", prompt: "有名な店だからといって、いつもおいしい___.", options: ["とは限らない", "わけにはいかない", "ことになっている", "べきではない"], answerIndex: 0 },
  // 自查：“〜とは限らない”（未必）A正确；B/C/D句意或接续不成立。
  { cefr: "B2", prompt: "締め切りが迫っているので、残業してでも仕上げ___.", options: ["がちだ", "ざるを得ない", "かねない", "っぱなしだ"], answerIndex: 1 },
  // 自查：“仕上げざるを得ない”（不得不完成）B正确；A“容易完成”语义不合，C“可能无法完成”方向相反，D不接。
  { cefr: "C1", prompt: "この繊細な味は、この店___のものだ。", options: ["だけあって", "ともあれ", "ならでは", "なりに"], answerIndex: 2 },
  // 自查：“〜ならでは”（独有）C正确；A/B/D位置或接续不成立。
  { cefr: "B2", prompt: "説明書を読んだ___、実際に操作するのは難しい。", options: ["ところが", "うえに", "ばかりに", "ものの"], answerIndex: 3 },
  // 自查：“読んだものの”（虽然读了但）D正确；A不接动词た形此位，B方向相反，C“正因为读了”语义不通。
);
esGrammar.push(
  { cefr: "B2", prompt: "Te lo explico despacio para que lo ___ bien.", options: ["entiendas", "entiendes", "entenderás", "entendiste"], answerIndex: 0 },
  // 自查：“para que + 虚拟式”表目的，entiendas 正确；B/C/D直陈或过去时不接 para que 目的句。
  { cefr: "B2", prompt: "No saldremos a menos que ___ de llover.", options: ["deja", "deje", "dejará", "dejaba"], answerIndex: 1 },
  // 自查：“a menos que + 虚拟式”=除非雨停，deje 正确；A/C直陈不接，D时态不合。
  { cefr: "C1", prompt: "Por muy difícil que ___ el problema, hay que resolverlo.", options: ["es", "será", "sea", "siendo"], answerIndex: 2 },
  // 自查：“por muy…que”让步须虚拟式 sea；A/B直陈不合法，D副动词不接。
  { cefr: "B2", prompt: "Cuando era niño, ___ al río a pescar.", options: ["suelo ir", "solía irme", "soliera ir", "solía ir"], answerIndex: 3 },
  // 自查：“solía ir”（过去常常去）D正确；A现在时不合“era niño”，B多出me语义偏，C为不存在形式。
);

// Original grammar depth (2026-09-23), CC BY-SA 4.0. Append only.
// Second B2/C1 pass — keeps the newest-keys rotation 0/1/2/3.
zhGrammar.push(
  { cefr: "B2", prompt: "___你亲自道歉，否则他不会原谅你。", options: ["除非", "即使", "虽然", "因为"], answerIndex: 0 },
  // 自查：“除非…否则”唯一条件框架，A正确；B需“也”、C需“但”呼应，D因果不通。
  { cefr: "B2", prompt: "他工作太忙，___忘了吃饭。", options: ["以便", "以至于", "以免", "不如"], answerIndex: 1 },
  // 自查：“以至于”引出结果，B正确；A为目的、C为避免、D为取舍，均不合结果句。
  { cefr: "C1", prompt: "___别的不说，单看价格就很划算。", options: ["除了", "即使", "撇开", "因为"], answerIndex: 2 },
  // 自查：“撇开…不说”让步引题，C正确；A需“之外”、B/D不接此结构。
  { cefr: "B2", prompt: "___花钱请人修，___自己动手试试。", options: ["不但…而且", "虽然…但是", "因为…所以", "与其…不如"], answerIndex: 3 },
  // 自查：“与其…不如”表取舍，D正确；A使两句矛盾，B/C逻辑不通。
);
koGrammar.push(
  { cefr: "C1", prompt: "주말에 쉬___ 더 바빠졌어요.", options: ["기는커녕", "으면서", "려고", "는데도"], answerIndex: 0 },
  // 自查：“-기는커녕”（别说…反而）A正确；B/C/D或语法不通或语义相反。
  { cefr: "C1", prompt: "어떤 학생은 열심히 하___, 어떤 학생은 전혀 하지 않아요.", options: ["려나 해서", "는가 하면", "더라고 해서", "는다면서"], answerIndex: 1 },
  // 自查：“-는가 하면”（一方面…另一方面）B正确；A/C/D均为错误黏着形式。
  { cefr: "B2", prompt: "갑자기 비가 오는 ___ 약속에 늦었어요.", options: ["때문에", "덕분에", "바람에", "탓에"], answerIndex: 2 },
  // 自查：“-는 바람에”（因意外而）C正确；A不接动名词形，B褒贬相反，D需“온 탓에”。
  { cefr: "B2", prompt: "전화___ 문자___ 편한 방법으로 연락 주세요.", options: ["거나…거나", "부터…까지", "이며…이며", "든지…든지"], answerIndex: 3 },
  // 自查：“-(이)든지…든지”（或者…或者）D正确；A不接名词，B表范围不通，C为书面连词不接此句。
);
jaGrammar.push(
  { cefr: "C1", prompt: "この一年、どれほど苦労した___.", options: ["ことか", "ものか", "ばかりか", "どころか"], answerIndex: 0 },
  // 自查：“〜ことか”（感叹）A正确；B“ものか”表强烈否定方向相反，C/D不接此位。
  { cefr: "B2", prompt: "その話を聞いて、笑わ___.", options: ["ないでもない", "ずにはいられない", "ざるを得ない", "ないではおく"], answerIndex: 1 },
  // 自查：“笑わずにはいられない”（不禁笑了）B正确；A语义不接“話を聞いて”，C“被迫笑”不合，D非语法形。
  { cefr: "C1", prompt: "問題を解決する___、委員会が設置された。", options: ["べき", "もの", "べく", "こと"], answerIndex: 2 },
  // 自查：“〜べく”（为了…书面目的）C正确；A需接名词前，B/D不接此结构。
  { cefr: "C1", prompt: "彼は泣か___、目を真っ赤にしていた。", options: ["ざるを得なく", "ないものか", "るまいに", "んばかりに"], answerIndex: 3 },
  // 自查：“泣かんばかりに”（简直要哭出来）D正确；A/B/C接续不成立。
);
esGrammar.push(
  { cefr: "B2", prompt: "Cuando llegué a casa, ellos ya ___ la cena.", options: ["habían terminado", "terminan", "terminarán", "hubieran terminado"], answerIndex: 0 },
  // 自查：先于过去的动作用过去完成时 habían terminado；B/C时态冲突，D虚拟式不接 ya+直陈。
  { cefr: "B2", prompt: "___ me preocupa es la falta de tiempo.", options: ["El que", "Lo que", "Que", "Lo cual"], answerIndex: 1 },
  // 自查：“Lo que + 动词”名词化主语，B正确；A“el que”指代阳性单数不合，C/D不接句首。
  { cefr: "C1", prompt: "El autor ___ libro ganó el premio vendrá mañana.", options: ["que", "donde", "cuyo", "quien"], answerIndex: 2 },
  // 自查：“cuyo”关系所有格唯一成立，C正确；A/B/D均不能表所属。
  { cefr: "B2", prompt: "Ni ___ me llamó para disculparse.", options: ["apenas", "tan", "aun", "siquiera"], answerIndex: 3 },
  // 自查：“ni siquiera”（连…都不）D正确；A/B/C不接 ni+直陈此结构。
);

// Original grammar depth (2026-09-23), CC BY-SA 4.0. Append only.
// Third B2/C1 pass — keeps the newest-keys rotation 0/1/2/3.
zhGrammar.push(
  { cefr: "B2", prompt: "___火车就要开了，他还在排队买票。", options: ["眼看", "既然", "虽然", "除非"], answerIndex: 0 },
  // 自查：“眼看…就”表即将发生，A正确；B/C/D均不接此句。
  { cefr: "B2", prompt: "___你提醒我，不然我就忘了。", options: ["因为", "幸亏", "虽然", "如果"], answerIndex: 1 },
  // 自查：“幸亏…不然”侥幸转折，B正确；A因果倒错，C让步不接，D与“不然”重复冲突。
  { cefr: "C1", prompt: "他以健康___代价换来了事业的成功。", options: ["作", "当", "为", "成"], answerIndex: 2 },
  // 自查：“以…为代价”固定搭配，C正确；A“作代价”非规范，B/D不接。
  { cefr: "B2", prompt: "___困难再大，我们也要完成任务。", options: ["既然", "虽然", "因为", "哪怕"], answerIndex: 3 },
  // 自查：“哪怕…也”让步假设，D正确；A/C不接“也”让步，B“虽然…也”不搭配。
);
koGrammar.push(
  { cefr: "B2", prompt: "내일부터 운동하___.", options: ["기로 했어요", "기가 해요", "려고만 해요", "는데요"], answerIndex: 0 },
  // 自查：“-기로 하다”（决定）A正确；B/C/D黏着形式不接或语义不通。
  { cefr: "B2", prompt: "이 식당은 맛있을 ___ 가격도 저렴해요.", options: ["까닭에", "뿐만 아니라", "바람에", "통에"], answerIndex: 1 },
  // 自查：“-(으)ㄹ 뿐만 아니라”（不仅…而且）B正确；A/C/D均为原因接续，不接并列。
  { cefr: "C1", prompt: "날씨가 좋___ 산책하기 딱 좋아요.", options: ["서", "니까", "기에", "지만"], answerIndex: 2 },
  // 自查：“-기에”（书面因果）C正确；A需“-아서”形，B需“좋으니까”形，D转折不合。
  { cefr: "B2", prompt: "마침 너한테 전화하___.", options: ["려고만 해", "는 중이야", "려면 말이야", "려던 참이야"], answerIndex: 3 },
  // 自查：“-려던 참이다”（正打算）D正确；A/B/C或语法不通或语义不接“마침”。
);
jaGrammar.push(
  { cefr: "C1", prompt: "このまま雨が降り続けば、洪水になる___.", options: ["おそれがある", "わけがない", "はずがない", "ものがある"], answerIndex: 0 },
  // 自查：“〜おそれがある”（有…之虞）A正确；B/C表不可能方向相反，D不接此义。
  { cefr: "C1", prompt: "そのご要望にはお応え___.", options: ["がちです", "かねます", "っぽいです", "ざるを得ません"], answerIndex: 1 },
  // 自查：“お応えかねます”（难以满足・敬语谦辞）B正确；A/C接续不通，D“被迫满足”语义不合。
  { cefr: "B2", prompt: "席に座った___、電話が鳴った。", options: ["最中", "うち", "途端", "一方"], answerIndex: 2 },
  // 自查：“座った途端”（刚坐下就）C正确；A需动词持续形，B/D不接此位。
  { cefr: "C1", prompt: "忙しくて、結局旅行には行か___.", options: ["ないでもなかった", "ずにはいられなかった", "ざるを得なかった", "ずじまいだった"], answerIndex: 3 },
  // 自查：“行かずじまい”（终究没去成）D正确；A双重否定=去了，B/C均表去了，方向相反。
);
esGrammar.push(
  { cefr: "B2", prompt: "Había mucha niebla, ___ el vuelo se retrasó.", options: ["de modo que", "para que", "aunque", "a pesar de"], answerIndex: 0 },
  // 自查：“de modo que”表结果，A正确；B为目的方向相反，C让步不合，D需接名词。
  { cefr: "C1", prompt: "Me trata ___ su propio hijo.", options: ["como era", "como si fuera", "siendo", "aunque fuera"], answerIndex: 1 },
  // 自查：“como si + 虚拟”表比喻，B正确；A缺虚拟，C不接比喻义，D让步方向相反。
  { cefr: "B2", prompt: "___ llegar a casa, me llamó.", options: ["Para", "Por", "Al", "De"], answerIndex: 2 },
  // 自查：“al + 不定式”表时间（一…就），C正确；A/B/D不接此结构。
  { cefr: "B2", prompt: "Necesito la respuesta ___.", options: ["lo antes", "tan antes", "antes cuanto", "cuanto antes"], answerIndex: 3 },
  // 自查：“cuanto antes”（尽快）固定搭配，D正确；A需“posible”搭配，B/C非词序。
);

// Original grammar depth (2026-09-23), CC BY-SA 4.0. Append only.
// Fourth B2/C1 pass — keeps the newest-keys rotation 0/1/2/3.
zhGrammar.push(
  { cefr: "B2", prompt: "时间不早了，我们___早点回去___。", options: ["还是…的好", "宁可…也要", "与其…不如", "不仅…而且"], answerIndex: 0 },
  // 自查：“还是…的好”建议句式，A正确；B/C取舍框架方向不合，D递进不接。
  { cefr: "B2", prompt: "你如果对这个感兴趣，___先去试一试。", options: ["不必", "不妨", "不要", "不敢"], answerIndex: 1 },
  // 自查：“不妨”表建议尝试，B正确；A“不必”语义相反（无需尝试），C/D语气不合。
  { cefr: "C1", prompt: "这部作品早已___广大读者所喜爱。", options: ["被", "受", "为", "让"], answerIndex: 2 },
  // 自查：“为…所”书面被动固定结构，C正确；A“被…所”为冗余误用，B/D不接所字结构。
  { cefr: "C1", prompt: "你这样拖下去，___要出问题。", options: ["只要", "只管", "只有", "只怕"], answerIndex: 3 },
  // 自查：“只怕”表担忧推断，D正确；A/C为条件词，B为放任义，均不接此义。
);
koGrammar.push(
  { cefr: "B2", prompt: "이번에 일본에서 일하게 ___.", options: ["됐어요", "했어요", "있어요", "봤어요"], answerIndex: 0 },
  // 自查：“-게 되다”（变得要…）A正确；B为使役不合主语，C/D不接此结构。
  { cefr: "B2", prompt: "한국에 온 ___ 벌써 삼 년이에요.", options: ["때", "지", "중", "동안"], answerIndex: 1 },
  // 自查：“-(으)ㄴ 지”（自…以来）B正确；A需“때에”结构，C/D不接 지난 시간 표현。
  { cefr: "B2", prompt: "늦을까 ___ 일찍 나왔어요.", options: ["어서", "려고", "봐서", "지만"], answerIndex: 2 },
  // 自查：“-을까 봐서”（担心会…而）C正确；A因果不通，B目的不合，D转折不接。
  { cefr: "C1", prompt: "도시는 편리한 ___ 스트레스도 많아요.", options: ["대신", "따라", "마당", "한편"], answerIndex: 3 },
  // 自查：“-는 한편”（一方面）D正确；A表替代、B表跟随、C非语法形，均不接两面叙述。
);
jaGrammar.push(
  { cefr: "B2", prompt: "試験の前だから、遊んでいる___.", options: ["わけにはいかない", "はずがない", "べきだ", "ことだ"], answerIndex: 0 },
  // 自查：“〜わけにはいかない”（不能只顾着）A正确；B“不可能在玩”方向相反，C/D不接ている形。
  { cefr: "C1", prompt: "この歌を聞く___、故郷を思い出す。", options: ["とともに", "につけ", "に対して", "に関して"], answerIndex: 1 },
  // 自查：“〜につけ”（每当…就）B正确；A表同时并进语义不合，C/D为对象・関係介词不接此义。
  { cefr: "B2", prompt: "暑い日は冷たいビール___.", options: ["にすぎない", "に違いない", "に限る", "におよばない"], answerIndex: 2 },
  // 自查：“〜に限る”（最好是）C正确；A“不过是”义不合，B“一定是”不接此语境，D敬语不合。
  { cefr: "C1", prompt: "驚いた___、彼はもう帰国していた。", options: ["ものに", "わけに", "ところに", "ことに"], answerIndex: 3 },
  // 自查：“〜ことに”（令人惊讶的是）D正确；A/B/C均为非该固定形式的近形干扰。
);
esGrammar.push(
  { cefr: "B2", prompt: "Su éxito tiene mucho que ___ con su esfuerzo.", options: ["ver", "haber", "dar", "estar"], answerIndex: 0 },
  // 自查：“tener que ver con”（与…有关）固定搭配，A正确；B/C/D不接此习语。
  { cefr: "B2", prompt: "El tren tardó dos horas ___ llegar.", options: ["de", "en", "para", "a"], answerIndex: 1 },
  // 自查：“tardar en + 不定式”（花了…才）B正确；A/C/D均不接 tardar 此结构。
  { cefr: "B2", prompt: "No solo llegó tarde, ___ no avisó.", options: ["pero", "aunque", "sino que", "porque"], answerIndex: 2 },
  // 自查：“no solo…sino que”递进固定搭配，C正确；A不与no solo连用，B/D逻辑不合。
  { cefr: "B2", prompt: "No abrirán ___ las nueve.", options: ["desde", "con", "hacia", "hasta"], answerIndex: 3 },
  // 自查：“no…hasta”（直到…才）D正确；A/B/C与否定不合此时间义。
);

zhWords.push(...zhWordsAdd);
koWords.push(...koWordsAdd);
jaWords.push(...jaWordsAdd);
esWords.push(...esWordsAdd);
zhReading.push(...zhReadingAdd);
zhListening.push(...zhListeningAdd);
zhOpen.push(...zhOpenAdd);
jaReading.push(...jaReadingAdd);
jaListening.push(...jaListeningAdd);
jaOpen.push(...jaOpenAdd);
koReading.push(...koReadingNew);
koListening.push(...koListeningNew);
koOpen.push(...koOpenNew);
esReading.push(...esReadingNew);
esListening.push(...esListeningNew);
esOpen.push(...esOpenNew);

// Each language gains a fifth speaking task and a fifth writing task.
zhOpen.push(
  { module: "speaking", cefr: "B2", prompt: "你和朋友原计划周末去爬山，但天气预报说会下雨。请用两分钟比较改去博物馆和推迟出行这两个方案，考虑费用和大家的时间，并说明你的建议。" },
  { module: "writing", cefr: "B2", prompt: "你租住的房间最近连续几晚受到楼上装修噪声的影响。请给房东写一封约250字的邮件，说明具体情况和对你的影响，提出两个可行的解决办法，并礼貌地约定回复时间。" },
);
jaOpen.push(
  { module: "speaking", cefr: "B2", prompt: "旅行当日の朝、予約していた列車が運休になりました。友人と高速バスで行くか、旅行を翌週に延期するか相談します。費用と予定への影響を比べ、自分の提案を二分程度で説明してください。" },
  { module: "writing", cefr: "B2", prompt: "大学が共同自習室を予約制にする案を検討しています。学生の立場から、予約制の利点と問題点を挙げ、公平に利用できる具体的なルールを提案する意見文を400字程度で書いてください。" },
);
koOpen.push(
  { module: "speaking", cefr: "B2", prompt: "동네 도서관이 운영 시간을 밤 10시까지 늘리는 방안을 검토하고 있습니다. 이용자와 직원의 입장에서 장단점을 비교하고, 자신의 의견과 절충안을 2분 정도로 말해 보세요." },
  { module: "writing", cefr: "B2", prompt: "빌린 집의 난방이 자주 고장 나지만 아직 수리가 끝나지 않았습니다. 집주인에게 보낼 이메일을 350~450자로 쓰세요. 고장 상황과 생활에 미친 영향을 설명하고, 수리 일정과 수리가 늦어질 경우의 대안을 정중하게 요청하세요." },
);
esOpen.push(
  { module: "speaking", cefr: "B2", prompt: "Tu barrio dispone de un pequeño presupuesto para organizar una actividad: un taller de reparación de bicicletas o un club de lectura. Compara a quién beneficiaría cada opción, qué recursos harían falta y cómo repartirías las tareas entre voluntarios. Defiende tu propuesta durante unos dos minutos." },
  { module: "writing", cefr: "B2", prompt: "Has recibido una mesa comprada por internet con una pieza rota. Ya has enviado fotos, pero la tienda solo ofrece un descuento para otra compra. Escribe una reclamación formal de 180 a 220 palabras: explica lo ocurrido, justifica por qué la oferta no resuelve el problema y solicita una solución con un plazo concreto." },
);

const PACK_CONFIG = [
  ["zh", { prefix: "zh", words: zhWords, grammar: zhGrammar, reading: zhReading, listening: zhListening, open: zhOpen }],
  ["ko", { prefix: "ko", words: koWords, grammar: koGrammar, reading: koReading, listening: koListening, open: koOpen }],
  ["ja", { prefix: "ja", words: jaWords, grammar: jaGrammar, reading: jaReading, listening: jaListening, open: jaOpen }],
  ["es", { prefix: "es", words: esWords, grammar: esGrammar, reading: esReading, listening: esListening, open: esOpen }],
];

for (const [lang, cfg] of PACK_CONFIG) {
  const pack = {
    vocab: buildVocab(lang, cfg.words, cfg.prefix),
    grammar: buildGrammar(lang, cfg.grammar, cfg.prefix),
    reading: buildReading(lang, cfg.reading, cfg.prefix),
    listening: buildListening(lang, cfg.listening, cfg.prefix),
    open: buildOpen(lang, cfg.open, cfg.prefix),
  };
  out(lang, "vocabulary.json", pack.vocab);
  out(lang, "grammar.json", pack.grammar);
  out(lang, "reading.json", pack.reading);
  out(lang, "listening.json", pack.listening);
  out(lang, "open.json", pack.open);
  const total =
    pack.vocab.length +
    pack.grammar.length +
    pack.reading.length +
    pack.listening.length +
    pack.open.length;
  console.log(`${lang}: ${total} items`);
}

console.log("Done. English pack remains in data/packs/en/");