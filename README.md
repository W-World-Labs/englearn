# EngLearn

Original application code is MIT licensed; learning content and third-party
materials retain their separate licenses. See [LICENSE](LICENSE),
[NOTICE.md](NOTICE.md) and [public source scope](PUBLIC_SOURCE.md).

This source distribution preserves the complete original application checks.
Historical validation notes below describe the original releases, not acceptance
of this export. Seventy Edge-service examination MP3s are withheld pending
redistribution rights; their existing integrity/playback checks remain. Public
CI validates source and the existing checks independent of those inputs. Full
recording goldens, the complete test suite and product/browser acceptance remain
**HOLD**, separately from source-check/build results.

Adaptive language learning with an exam centre at `/exams`: IELTS Academic
computer-test practice, TOPIK Korean, HSK Chinese and JLPT Japanese practice. Includes CEFR
assessments, a dedicated multilingual vocabulary test, graded grammar courses, an open
textbook reader, a daily learning workbench, knowledge profiles, graded reading/listening,
and W-ID account records.

## Version 0.17.0

Course and exam catalogues now use plain rows with one link per entry. Courses
are grouped by stage; exam levels and saved attempts remain visible. Decorative
badges, colour-coded tiles, repeated lesson previews and generic growth hints
are removed. The same row styles serve all three catalogues without a new
component or runtime state.

The latest UI follow-up makes each IELTS daily task a single named action with
its duration, removes repeated home summaries and generic learning hints, and
adds a retry when the account status cannot be checked. Learning choices show
selection, keyboard focus and correct answers; long navigation labels wrap
within their item. No dependencies, API contracts or saved-record formats change.
Local typecheck and production build pass; browser acceptance is performed by
the product owner, separately from the existing CI/CD release gates.

The learning interface now uses a warm cream and sage palette, clearer buttons,
quieter cards and phone navigation with safe-area spacing. Home focuses on the
next learning activity directly: English learners set their IELTS goal on the
first visit, then see their daily tasks and can continue saved work from the
same learning journal. Other course languages use the existing daily workbench.
Language settings and backups share one disclosure; XP goals, weekly activity,
skill modules and achievements live in Growth (`/history`). Courses, vocabulary
and exams remain in their respective navigation sections.
Radio controls keep a visible keyboard focus and an accessible group label, and
animations respect reduced-motion preferences.

Assessment feedback no longer rerolls encouragement or resets a dismissal timer
on each elapsed-time render. Feedback stays stable until Continue is selected.
Participation XP is labelled as practice, and the attempt deduction appears only
when an attempt was actually available to lose. A real-browser regression checks
correct and incorrect answers across clock ticks and verifies that XP is not
repeated. Five ambiguous English grammar items are retired from new assessments;
original text, option order and answer keys remain resolvable for existing records.
See `data/packs/README.md` for the targeted content audit.

Validation: typecheck, 583 unit tests, production build, real assessment browser
regression and layouts at 320, 390 and 1440 pixels. Run the assessment browser
check with `ENGLEARN_TEST_URL` and `ENGLEARN_PLAYWRIGHT_MODULE` set, using
`node scripts/test-assessment-feedback.mjs` against a registered test listener.

## Version 0.16.0

Completed daily practice, delayed checks, reading and listening activities now
appear in Practice history with their score, answers and timestamp, alongside
course lessons and recall rounds. Existing saved activities are included without
migration. The home lesson CTA opens Courses; unfinished activities still resume
from the home card. Active daily practice no longer shows resume/discard controls.

This release also prevents caching authentication responses and hardens release
verification and rollback. Runtime/build dependency updates remove reported
production dependency vulnerabilities; seven advisories remain in the Tailwind
build-tool chain. Validation: typecheck, 575 tests and production build passed.

## Stack

- TanStack Start (React + Vite + file routes under `src/app/`)
- API routes in `src/app/api/*` (sessions, scoring, W-ID auth callbacks)
- Tailwind UI in `components/`
- Item banks under `data/`: `vocabulary/bank-v1.json`, generated packs in
  `packs/{en,es,ja,ko,zh}/`, and per-family JSON for exams/learning/ielts

## Source of truth

Application code and tests in this repository own the implementation. Operators
configure their own runtime and identity realm; no production deployment record
is included in this distribution.

## Open-source and open-content policy

Only introduce third-party projects with an explicit open-source licence and
learning materials with an explicit open-content licence or public-domain status
that permits our intended use, modification and redistribution. Retain source,
author, licence, pinned revision/version and modification notices, and satisfy
attribution/share-alike obligations. Check content and asset licences separately
from a repository's code licence. Free access or a public repository alone is not
permission to reuse its contents. Material with unknown or incompatible terms
is not added. Original learning content is published under CC BY-SA 4.0.

The library contains open learning resources. Commercial textbook recommendations
and purchase links were removed in v0.12.1, following the product owner's policy.
See [content provenance](data/learning/README.md) and the public attribution files.

## Local development

Node 22.12+ (see `.nvmrc`), TanStack Start + Vite. W-ID authentication uses the
public `@w-id/sdk` 1.3.86 release tarball, pinned in `package.json` and
`package-lock.json` with its exact integrity value. Its full Node/server source is
W-World-Labs/w-id-node commit `d2e3d3e05383a55167af584a838b4649010810ef`.

```bash
cd englearn
npm ci
npm run dev -- --host 127.0.0.1
npm run typecheck
npm test -- --exclude lib/api/exams-audio.test.ts
npm test -- lib/api/exams-audio.test.ts -t 'reports an unavailable recording|serves an empty response for a zero-byte asset'
npm run build
```

Register local runtime listeners in Radar before starting them. There is no
need to change production resources to build or run unit tests.

Operator-run deployment examples (systemd and Caddy) live under `deploy/baseline/`.
Read `PUBLIC_SOURCE.md` before redistributing learning material or audio.
Browser telemetry and feedback are disabled by default. To enable the existing
platform bootstrap, export `W_RADAR_BOOTSTRAP_URL` (HTTPS, no URL credentials),
`W_RADAR_SDK_CODE`, `W_RADAR_WORKSPACE_ID` and `W_RADAR_PROJECT_ID` before building.
Only those public bootstrap settings enter the browser bundle; identity secrets
remain server-side. Network/error auto-capture and URL-query collection are off.

### External examination recordings and full checks

`data/exams/audio.json` remains the original 70-clip mapping. Every withheld
`public/exam-assets/audio/<file>` path and expected SHA256 is listed separately
in `public-files.json` under `withheld_assets`. Those recordings are external
private inputs: this repository provides no download, credentials or right to
redistribute them, and does not replace them with generated or silent audio.

The existing input configuration is the manifest plus that directory under the
application's working directory; there is no new audio environment switch. If
you already hold authorized matching copies, place them at the listed paths.
Keep them private and out of Git. The unchanged audio handler allows only the
manifest entries and returns HTTP 503 while a recording is unavailable.

The PUBLIC source workflow explicitly runs the other 67 original Vitest files,
then name-selects the two original unavailable/empty-recording cases in
`lib/api/exams-audio.test.ts`. The file and all four cases remain unchanged. Its
two byte/hash/Range goldens need the withheld MP3s and remain **HOLD**, visibly
unselected in that second run. No `it.skip`, `continue-on-error` or lowered
assertion is introduced. After authorized inputs are available, the original
full entrypoint is still:

```bash
npm test
```

The existing `node scripts/test-exam-upgrade.mjs` browser/playback check also
remains **HOLD**, requires those inputs and its documented running test server
and browser configuration. A passing source workflow does not pass these full
goldens, browser playback, real SSO or production acceptance.

## Reinforcement and portable materials (v0.12)

`/learn?tab=review` offers recall practice across grammar/vocabulary cards in
five languages. Reveal answers before self-rating; pick weak/due/all cards and a
6/12/20-card target bounded by the actual available cards. Mixed-concept rounds
resume after refresh and save to the W-ID journal alongside unit practice.
Self-ratings support spaced review and never alter ability-test results.

`/learn?tab=materials` builds selected, searched, staged or weak/due packs of up to
160 cards in one language. Vocabulary results preselect missed/unknown words.
Export a printable workbook with optional separate answers, quick reference or
same-sheet cut-and-fold cards, in A4, Letter or A5. Use browser print to save PDF.
A standalone HTML file includes offline recall with no network assets, plus
export/restore of completed and unfinished practice. Plain UTF-8 text and Anki
TSV provide other portable formats. Native device file sharing falls back to a
download. Explanation/pack-control languages are English and Chinese.

Offline result JSON is previewed before importing into the current account or
guest browser. Restoring an unfinished recall requires explicit selection;
identical completed rounds are skipped and conflicting records are rejected.
This result import is separate from the full learning-backup JSON. Corrupt local
records remain exportable before an explicit reset. HTML scripts need a browser;
some mobile file-preview apps do not execute them.

[BREAKING CHANGE / CONTRACT IMPACT] Optional `reviews` and `reviewDraft` extend
`/api/learning/journal`, with a 5 MB body limit and 1,000 recall-round cap. Existing
unit events, drafts and bookmarks remain compatible; clients may not remove saved
recall history. Consumer: this app's learning workspace. See OpenAPI 1.1 in
[openapi.learning.json](openapi.learning.json). No runtime dependencies added.

## Graded learning and open books (v0.11)

`/learn` now offers 120 original lessons and 480 practice questions in English,
Chinese, Japanese, Korean and Spanish, arranged into three stages. English has
24 lessons each. Learners read a short explanation,
practise four questions, review the answers and return on a scheduled date.
Stage/search filters, unfinished-round continuation and paginated practice history
connect the learning flow. W-ID saves the owner-scoped journal across devices;
guests keep a separate browser copy. Explanations are available in English and
Chinese. These stages are a teaching sequence, not validated proficiency ratings.

The open library includes the unchanged 340-page _Brehe’s Grammar Anatomy_
(CC BY-SA 4.0), with a text reader, original PDF view, explicit page bookmarks and
download fallback. The text edition simplifies layout; use the original for diagrams.
Original course content is downloadable under CC BY-SA 4.0.
The SM-2 implementation is reused from MIT-licensed `viendinhcom/supermemo`.
Source pins, attribution, limits and verification commands are in
[data/learning/README.md](data/learning/README.md).

[BREAKING CHANGE / CONTRACT IMPACT] Additive learning-journal and public-book
endpoints; consumer is this app's learning workspace. Existing examination and
identity contracts are unchanged. See [openapi.learning.json](openapi.learning.json).

## Account-based learning arrangements (v0.13)

Signed-in learners see a personal plan in `/learn`: a suggested
practice stage, up to three lessons, due recall and up to twelve vocabulary words.
The five learning languages have separate evidence. W-ID establishes identity;
LingoLearn derives the arrangement from that account's existing grammar assessments,
vocabulary tests and learning journal, without using administrator or organization
claims as ability or access. New learners can start gently or take a grammar-only
diagnostic. Manual stage selection remains available.

Recent performance across distinct concepts adjusts the suggested difficulty.
Repeatedly completing the same lesson or self-rating recall does not promote a
stage. Grammar and vocabulary remain separate. A plan is practice guidance, not a
certified language level. See [the rules and evidence limits](data/learning/README.md#account-based-arrangements-v013).
Failed evidence reads offer retry and manual learning instead of assigning a false
beginner profile. Account/language changes discard stale responses. The learning
workspace recomputes with current local answers; existing cloud status indicates
whether those answers have reached the account. A fresh device uses saved records.

No additional third-party code, content, dependency, provider credentials or service
was added. Plans reuse the existing attributed open learning collection.
[BREAKING CHANGE / CONTRACT IMPACT] Additive, authenticated, read-only
`GET /api/learning/plan?language=...`, documented in `openapi.learning.json` v1.2.
Consumers: this app's home page and learning workspace. Existing journal, assessment,
exam and W-ID contracts remain unchanged; no stored record migration.

`node scripts/test-learning-plan.mjs` validates real loopback SDK sessions, actual
adaptive grammar scores, language/account isolation, delayed responses, failures,
manual choice, practice-based advancement, clean-device restoration and five
interface translations at 320–1440 px. Use the browser environment below.

## Starting a learning activity

From v0.10, the home page places the five available language banks first, followed
by vocabulary testing, a short vocabulary/grammar assessment and the exam matching
the selected language. Search accepts translated/native language names; unavailable
languages are explicitly labeled. Interface and learning language remain independent.
The entry flow has English, simplified/traditional Chinese, Japanese, Korean, Spanish
and Arabic copy, with the existing English fallback for other interface locales.

`/test` defaults to vocabulary + grammar; single-skill links keep their selection.
An unfinished assessment must be continued or explicitly abandoned before replacement.
Transient resume failures and login failures preserve the browser bookmark and offer
a retry. Successful continuation restores the original learning language; confirmed
404s clear stale bookmarks. A selected language still reaches creation when device
storage is unavailable, though browser persistence then cannot work.

Contract impact: `POST /api/session` now returns 422 (`unsupported_learning_language`)
for a well-formed language without a bank, and 400 (`invalid_learning_language`) for
malformed language values. Neither creates a record. Omitted/null language still
means English, and server default modules remain six for compatibility. The additive
`GET /api/session` field `learningLanguage` identifies the original course. See
`openapi.session.json` (1.1). Existing sessions/results are not rewritten; the legacy
English-bank fallback remains only for reading/continuing old records. Their old
labels are not newly validated measurements of the requested language.

Run `node scripts/test-learning-start.mjs` with the browser environment below for
responsive layouts, native-name search, unavailable banks, language choice with
blocked device storage, short/single-skill presets and continuation under failures.
It mocks assessment endpoints in isolated browsers and is safe on public builds;
API tests separately verify real bank selection, rejection without writes and legacy
record preservation.

## Vocabulary size reference test

`/vocabulary` is a dedicated, untimed meaning-choice test for English, Chinese,
Japanese, Korean and Spanish. It is linked from the main navigation, home page,
exam centre and generic vocabulary results. Unsupported learning languages
require an explicit supported-language selection. Definitions are available in
Chinese or English independently of the app interface.

The 1500-item bank has four frequency strata per language. New v2 tests use dynamic
length: quick 12–30, detailed 20–40 questions. Require 3/5 answers per band first,
then select the band with greatest predicted information gain. Stop when the
within-model uncertainty target is met, further information is small, or the cap
is reached. Reports distinguish those reasons and retain remaining uncertainty.
Four choices plus “I don’t know”, keyboard 1–4/0, locked-answer review and refresh
recovery are supported. Reports contain actual question counts, the difficulty
path, per-band accuracy, recognition-evidence labels and word-list export. From
v0.9, a sequential comparison with the uniform four-choice guessing baseline must
support recognition before showing a count or range, including in old reports.
Insufficient evidence is not zero vocabulary; words and observed accuracy remain
available. Quick results can prepare a detailed test with the same language and
definitions, retaining the existing attempt until explicit replacement. The UI
warns that repeated words from the same bank cannot independently measure growth.
The bank is uncalibrated; simulations do not establish real-user accuracy or 90%
coverage. Shorter tests trade some estimation precision for fewer questions.
See `data/vocabulary/README.md` for rules, thresholds, simulation results and sources.

Guest mode retains the current browser attempt. W-ID-derived sessions reuse the
existing atomic account store and revision-based sync with a separate
`ENGLEARN_DATA_DIR/vocabulary-attempts/<hashed-user>/` namespace. Multiple tests,
paginated history, offline recovery, conflict backups, cross-device continuation
and immutable submissions use `GET/POST /api/vocabulary/attempts`, documented in
`openapi.vocabulary.json` (v1.2). New records include `adaptive.version=2` and an
immutable 200-item pool (pre-expansion 40/80/120/160-item pools stay resumable); `questions` grows until the first stopping point. History
`total` means the cap (30/40) while running and the actual count after completion;
`adaptiveVersion` distinguishes the rules. Server replay rejects both premature
submission and unnecessary questions after a stopping point. v1 adaptive and
legacy fixed-stratum records retain their original rules without migration. The existing data-directory backup covers this data.
No new service, runtime dependency, provider key or database is required.

Contract impact: generic assessment results no longer populate the optional
legacy `modules[].vocabularySize` field using the old theta-to-size curve. Old
records still deserialize; their heuristic number is no longer shown as a
current vocabulary measurement. Generic vocabulary recognition and CEFR module
scores remain available; the result page links to the dedicated size test.
Existing language exam and W-ID contracts are unchanged.

With the registered local test server and the Playwright environment described
below, run `node scripts/test-vocabulary-browser.mjs` for responsive layouts,
all five languages, refresh recovery, results/export and unsupported-language
handling. `node scripts/test-vocabulary-cloud.mjs` uses isolated real SDK sessions
for cross-browser continuation, offline/revision conflicts, history, account
isolation and expired-login recovery; it refuses public targets.

## IELTS computer practice

The `/ielts` route follows the official IELTS Inspera familiarisation interface:
candidate detail confirmation, headphone check, instructions, independently
scrolling panes with a draggable divider, bottom Part/question navigation,
previous/next controls, Options (text size and contrast), passage selection
menus for highlights and notes, matching tables, heading drag/drop, inline
completion fields and writing word counts. Exam controls are in English;
the lobby and help support Chinese and English.

On 2026-11-07 the reading and writing workspaces were compared directly with
the official [reading](https://ielts.inspera.com/player/?assessmentRunId=189731922&context=exam)
and [writing](https://ielts.inspera.com/player/?assessmentRunId=205993150&context=exam)
samples linked by IELTS.org. Header placement, visible
independent scrollbars, Options submenus and desktop writing-box height follow
those references. LingoLearn branding, licensed practice material and mobile
adaptations remain distinct. This is a visual reference match, not a claim that
every screen or real test-centre configuration is identical.

Academic Practice 01 contains 40 listening questions, 40 reading questions and
two original writing tasks. Listening plays once on a wall-clock timeline,
including 30-second previews and a final 120-second answer check. The bundled
synthetic recordings are shorter than an official test: approximately 23
minutes including previews/review. Reading and Writing each allow 60 minutes.
Full mode moves through Listening → Reading → Writing and locks submitted
sections. Time continues across refreshes, closed tabs and the lobby; restoring
an expired attempt advances through any elapsed sections. Audio restores at
the current test time, so leaving can mean missing part of a recording. The
public `/api/ielts/audio?part=1..4` endpoint supports byte ranges for seeking;
run from the repository root or the standalone `.output` directory so
`public/ielts-assets` is available.

Academic Practice 02 (`academic-practice-02-v1`) adds a second full set behind
a lobby picker: 40 listening questions over four original scripts with locally
synthesized single-narrator recordings (~23 minutes including previews/review),
40 reading questions over three passages adapted from the same CC BY 4.0
`LuchoBazz/ielts-ai-dataset` collection (one Band 9 piece substituted for an
overlapping urban theme), and two original writing tasks (Marrowgate library
line chart; tourist-tax discussion). Drafts, attempts and history are isolated
per set; opening another set's record switches the workspace to that set. Old
Practice 01 records, sessions and answer keys are unchanged.

[BREAKING CHANGE / CONTRACT IMPACT] `openapi.ielts.json` v1.1: `ExamSession`
and `Summary` carry `examId` (`academic-practice-01-v1` |
`academic-practice-02-v1`); `/api/ielts/audio` takes an optional `set`
(`01` default, `02`). Consumers: this app's IELTS workspace. Existing records
replay unchanged; unknown exam IDs are rejected without writes.

Answers, flags, highlights and notes save locally under a signed-in-user (or
guest) key. W-ID users also save to their account every two seconds and on
submission, with multiple attempts, paginated history and cross-device recovery.
The UI distinguishes local and account saves. Outages preserve the browser copy;
version conflicts require a local backup before loading the account version.
Starting another attempt waits for account acknowledgement of the previous one.
Guests retain the latest browser attempt and can download their answer sheet.
Objective answers are checked against accepted variants and word limits. Bands
are practice estimates, not calibrated results.
Writing provides word counts and a self-review checklist, without an IELTS
writing score or an overall band. Speaking is a separate examiner-led test and
is not part of this computer-test workspace.

The account API contract is `openapi.ielts.json` (`GET/POST /api/ielts/attempts`).
Records are owned by the verified W-ID `sub`, including when the user is a
platform administrator. They use the existing file-store architecture, under
`ENGLEARN_DATA_DIR/ielts-attempts/<hashed-user>/` (default: `data/`). Run one
Node writer and mount this directory on persistent storage with backups;
ephemeral deployments or multiple worker processes are not supported by this
file-store implementation. Writes use atomic replacement and mode 0600 files.
No external identity or platform contracts change.

W-ID requires an explicit `W_ID_SSO_URL` (or `W_ID_BASE_URL`),
`W_ID_CLIENT_ID`, `W_ID_CLIENT_SECRET`, `JWT_SECRET` and an
`ENGLEARN_PUBLIC_URL` (or explicit `W_ID_REDIRECT_URI`) matching the registered
OAuth callback. Use Radar-owned startup configuration when deploying. Unit
checks exercise the real SDK session signer/verifier and a mocked identity
provider exchange; they do not establish that production SSO is operational.

Browser regression checks use an existing Playwright installation against an
already running, registered local server:

```bash
ENGLEARN_TEST_URL=http://127.0.0.1:<registered-port> \
ENGLEARN_PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
node scripts/test-ielts-browser.mjs
```

Screenshots and the downloaded practice answer sheet go to
`/tmp/englearn-ielts-acceptance` (override with `ENGLEARN_TEST_OUTPUT`). The
guest checks stub identity and telemetry and do not send learner data to production.
`scripts/test-ielts-ui.mjs` uses the same environment variables to check the
English/Chinese lobby at 320–1440 px, review filters and empty states, keyboard
focus when jumping between questions, and the writing source table. Its isolated
guest fixtures stay in the test browser; screenshots default to
`/tmp/englearn-ui/acceptance`.
`scripts/test-ielts-cloud.mjs` additionally exercises real local API/cookie
authentication with isolated test accounts. Start the registered local server with
its documented test configuration and use the same environment for that script.

## JLPT Japanese module

`/jlpt` covers N5–N1 with ten original short papers, 20 questions each
(each level has a second set without listening audio):
kanji readings, vocabulary use, grammar, starred sentence-order questions,
reading and listening. N5–N3 separate vocabulary, grammar/reading and listening;
N2/N1 combine language knowledge and reading before listening. Each section has
its own clock and locks on submission. First-set mixed practice lasts
23/27/32/35/42 minutes from N5 to N1. There is no writing or speaking section.

The Japanese interface includes Japanese explanations alongside English and
Chinese. Answer choices display as 1–4 (three choices for selected listening
items), while the existing A–D storage values remain compatible. Vocabulary
warm-ups, mobile layouts, marking, refresh recovery, downloadable answer sheets
and correction rounds reuse the shared practice workspace. W-ID accounts retain
multiple attempts and support cross-device recovery and conflict resolution.

JLPT adds 25 built-in listening recordings and a headphone check, using
ja-JP-NanamiNeural and ja-JP-KeitaNeural. The shared catalogue now contains
26 TOPIK/HSK/JLPT papers, 430 questions and 70 MP3s. Generate only the Japanese
assets by appending `--family jlpt` to the authoring command below; existing
other-family assets and manifest entries are preserved.

These are original, shortened web drills, not official past papers, a full
exam, or an official computer-delivered JLPT. Accuracy is not a scaled score
or pass prediction, and the difficulty has not been calibrated. The official
[section guide](https://www.jlpt.jp/e/guideline/testsections.html),
[sample question types](https://www.jlpt.jp/samples/forlearners.html) and
[FAQ](https://www.jlpt.jp/e/faq/index.html) were checked on 2026-09-07.
No official questions or recordings are reproduced.

Use `node scripts/test-jlpt-browser.mjs` with the Playwright environment below
for responsive Japanese/Chinese/English layouts, numerical answers, review,
refresh recovery, correction integrity, section transitions and real audio.
`ENGLEARN_TEST_EXAM=jlpt node scripts/test-ielts-cloud.mjs` verifies the real
local account API, cross-browser recovery, offline/conflicting edits, history,
account isolation and expired-session recovery using isolated SDK sessions.
The cloud test requires the local test configuration and refuses public targets.

## TOPIK and HSK modules

`/topik` covers TOPIK I/II and `/hsk` covers HSK 1–6. Each level has two original
short mixed practice papers (second sets without listening audio), individual listening/reading/writing drills where
applicable, and vocabulary/grammar warm-ups. The sixteen papers contain 230
questions in `data/exams/`. These are shortened skill exercises, not complete
official papers or calibrated level predictions. Both are available from `/exams`.

The workspace supports timed sections, question navigation, review flags,
refresh recovery, objective answer checking, explanations and downloadable
answer sheets. Chinese word-order questions accept listed grammatical variants;
open writing has character counts and review guidance but no automatic grade.
HSK 6 includes a shortened summary exercise: read for 90 seconds, then write
with the source hidden. Chinese, English and Korean interface messages are
available; explanations are authored in Chinese and English. Questions remain
in the language being learned.

Listening includes 44 bundled synthetic MP3 recordings: all 42 listening
questions and two headphone checks. It works without installing Chinese/Korean
system voices and supports pause, replay, seeking and 0.75×/1×/1.25× speed.
The headphone check requires actual playback completion and learner confirmation.
Unavailable audio shows an error and retry; timed practice continues during an
audio outage. These are listening drills, not official recordings or an official
playback timeline. The public `GET/HEAD /api/exams/audio` endpoint supports byte
ranges and restricts requests to known assets in `data/exams/audio.json`.

The workspace provides unanswered/marked navigation filters, completion progress,
a larger text option, and submission checks with direct links back to unfinished
questions. Long source material and answers use separate desktop columns; TOPIK
chart writing uses a semantic table. Review includes section summaries and an
untimed correction round for incorrect/blank objective questions, with feedback
and further rounds for remaining mistakes. Correction results stay in memory
until leaving that round; they never change the original answer sheet or score.

The optional authoring command is
`uv run --with edge-tts==7.2.8 --with mutagen==1.47.0 python scripts/generate-exam-audio.py`.
It sends only original question scripts to Microsoft Edge's online speech service,
with bounded timeouts and one retry, and writes checked MP3s plus an integrity
manifest. This is an authoring tool, not an application dependency. Builds and
production use checked-in audio and make no external speech requests. Voice and
asset attribution is in `public/exam-assets/README.md`.

W-ID account saving reuses the IELTS atomic record store and sync workflow,
including separate account ownership, multiple attempts, offline recovery and
revision conflicts. The additive contract is `openapi.exams.json`, for
`GET/POST /api/exams/{family}/attempts` (`family`: `topik`, `hsk` or `jlpt`). Records
live under `ENGLEARN_DATA_DIR/language-exam-attempts/<hashed-user>/` and are
included in the existing data-directory deployment backup. The same single
Node writer requirement applies. IELTS paths and records remain compatible.

Against a registered local test server, use the same Playwright environment as
above with `node scripts/test-language-exams.mjs` for guest/UI and real playback
checks. `node scripts/test-exam-upgrade.mjs` checks navigation, corrections, table
layouts, and decoding/duration/non-silent waveforms for all 70 MP3s. Use
`ENGLEARN_TEST_EXAM=hsk node scripts/test-ielts-cloud.mjs` and
`ENGLEARN_TEST_EXAM=topik node scripts/test-ielts-cloud.mjs` for SDK-cookie,
account isolation, cross-browser recovery and conflict checks. These cloud
checks require the script's isolated local test configuration and refuse public
targets.

The skill references were checked on 2026-09-07:

- [NIIED TOPIK format](https://www.niied.go.kr/web/NIIED/contents/niiedEng/eng_topikOverview)
  and [official IBT tutorial](https://www.topik.go.kr/asset/vendor/tutorial/exam2/listen_exam.html).
  The short papers reference current IBT skills, with fewer questions and shorter
  writing targets than the official test.
- [Official HSK level information](https://www.chinesetest.cn/HSK/1) for levels
  1–6 (HSK 2.0), with [HSK 3.0 announcements](https://www.chinesetest.cn/notice)
  linked separately in the product. These sets do not claim to implement HSK 3.0.

All TOPIK/HSK questions are original LingoLearn material. The product is
independent of the examination bodies; speaking is not included.

## Source attribution

- Reading passages and questions: [sifu-ewu/ielts-reading-mock-test](https://github.com/sifu-ewu/ielts-reading-mock-test),
  revision `f90eeb3597b99440b97e308a31c2c7b715540b4e`, MIT (© 2026 sifu-ewu).
  Adapted into the local question format; license in `public/ielts-assets/MIT-reading.txt`.
- Listening questions, transcripts and MP3 files: [LuchoBazz/ielts-ai-dataset](https://github.com/LuchoBazz/ielts-ai-dataset),
  revision `cba645115e62eccabfe03cb70e9488646b57c290`,
  `datasets/practice-drills/listening/ielts-listening-band-8.0-test-001`, CC BY 4.0.
  Question format adapted and a terminal map added from the supplied transcript;
  recordings unchanged. License in `public/ielts-assets/CC-BY-4.0.txt`.
- Writing interaction reference: [Arittra95/computer-based-ielts-writing-test-interface](https://github.com/Arittra95/computer-based-ielts-writing-test-interface),
  revision `5936c1cae71c7cc9e189a8864bdf14ba71d2cfa7`, Apache-2.0; no source copied.
- Interface and flow reference: [official IELTS Academic familiarisation resources](https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test),
  inspected 2026-09-07. [Candidate feedback](https://www.reddit.com/r/IELTS/comments/1juaixz/)
  informed navigation and editing practice; the official interface is the primary
  reference. This independent product is not affiliated with IELTS.

## Layout

| Path               | Role                                |
| ------------------ | ----------------------------------- |
| `src/app/`         | Routes, API handlers, pages         |
| `components/`      | UI and learning widgets             |
| `lib/`             | i18n, gamification, scoring helpers |
| `data/`            | Static item content                 |
| `deploy/baseline/` | Example service and edge snippets   |

## Operator-run deployment examples

This public source does not deploy the maintained application. `deploy/baseline/`
contains systemd and Caddy examples for an operator's own host. Supply your own
OAuth issuer/client, model-provider credentials, persistent data directory and
HTTPS origin. Keep runtime records and secret environment files outside Git.

`scripts/deploy-baseline.sh` requires an explicit `ENGLEARN_DEPLOY_TARGET`; it
retains release identity, backups, atomic switching, health checks and rollback.
`scripts/verify-public-release.sh` requires `ENGLEARN_PUBLIC_HOSTS`. Neither is
run by public source CI. Source validation, packaging, operator deployment and
real browser/account acceptance are separate outcomes.

## Daily workbench (v0.15)

`/learn?tab=ielts` connects IELTS preparation to the existing account learning
journal. Enter an overall target, a per-skill minimum, recent self-reported bands,
a test date and a daily budget. The planner calculates a feasible score vector
using official overall-band rounding and gives concrete skill tasks whose
minutes sum to that budget. Short days rotate tied priorities; all four skills
appear for budgets of at least 60 minutes. The date selects foundation, timed
practice or rehearsal guidance; this is a transparent scheduling heuristic,
not a calibrated estimate of the time needed to reach a band.

The preparation workspace opens on today's tasks, with a compact target summary
and explicit goal setup on first use. Speaking, writing and mistake review have
separate views; switching views preserves in-page timers, recordings and drafts.
Method explanations and references expand on demand. Recording lifetime, draft
replacement warnings and the distinction between targets and assessed bands stay
beside the relevant controls.

Reading/listening tasks open the existing English comprehension practice;
recall and grammar links reuse the learning workbench. Completed IELTS papers
can be read from the current browser and the latest completed attempt in the
account's 50 most recent cloud records. Learners select a cause for each missed
question and retry it when due (one day after a miss, three after a correct
repeat). Known-question repeats and self-checked daily completion are kept
separate from unseen learning evidence and never change the original exam.

The speaking desk has original prompts for Parts 1–3, a wall-clock timer and
optional microphone recording, playback and download. Audio stays in the tab
and is released on leaving; it is not saved in the journal or uploaded. The
writing desk reuses both licensed practice sets, Task 1 data tables and the
existing word counter, adding an independent timer and saved draft/rewrite
fields. Changing a task requires confirming text loss; download drafts first.
Neither desk assigns an automatic writing/speaking band.

[BREAKING CHANGE / CONTRACT IMPACT] Learning API v1.4.0 adds optional
`StudyJournal.ieltsPrep`. Existing journals remain readable; an older client
that omits an already saved preparation extension receives 409, preventing
silent deletion. The existing W-ID ownership checks, revision conflict flow,
browser backup and cloud save status apply. Preparation settings and writing
drafts are account data; guest work stays in its existing browser namespace.

Method reference: [Sera's preparation discussion, 2026-11-02](https://x.com/Seramikimiki/status/2117319245180829775),
read on 2026-11-05. The implementation independently applies ideas about goals,
concrete practice and error diagnosis; it includes no copied article text,
images, paid lessons or score guarantees. Rounding and practice-format facts
were checked against [official IELTS scoring](https://ielts.org/take-a-test/your-results/ielts-scoring-in-detail),
[speaking](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-speaking)
and [writing](https://ielts.org/take-a-test/test-types/ielts-academic-test/ielts-academic-format-writing).

`/learn` offers 5/15/30 minute resumable plans, concept evidence, original variation
exercises and unseen delayed checks. The bank now includes 1440 variation questions
(six practice + six reserved per concept) and 90 comprehension questions. New
activities use two-question rounds, prefer unseen items and space reserved
batches by three days; saved drafts keep their original questions. The catalog moved to `/learn?tab=courses`.
Reading/listening includes 15 original texts with replayable open-model narration,
sentence explanations and words saved into recall. Supported exam errors link to
related micro-lessons; weekly results and owner-scoped question reports complete
the learning loop. All new content is CC BY-SA 4.0.

See [rules, provenance and the FSRS evaluation](data/learning/README.md) and
[the additive API contract](openapi.learning.json). Existing exam scores, login
ownership and cloud conflict handling remain compatible.

## Assessment privacy and stability fixes

[BREAKING CHANGE / CONTRACT IMPACT] Assessment history no longer lists the
shared guest record store. Signed-in accounts see only their own results;
guests can reopen a report using its saved session link. History and report
responses disable caching. The unused server-function loaders were removed
because they bypassed ownership checks. See `openapi.session.json` v1.2.0.

[BREAKING CHANGE / CONTRACT IMPACT] `/api/respond` now accepts only the pending
question and validates the answer against its format. `/api/score` requires the
session ID, pending open-question ID and answer text (at most 20,000 characters).
Malformed requests return 400; stale questions return 409. Scored drafts remain
resumable until submission, and a score applies only to the text evaluated.
Late provider responses cannot overwrite committed work. Legacy scored drafts
remain readable. See `openapi.session.json` v1.3.0.

[BREAKING CHANGE / CONTRACT IMPACT] Cloud progress uploads now reject invalid
field types with 400 before writing. Partial first-sync snapshots receive
complete defaults, unknown top-level fields are discarded, and paid-attempt IDs
remain bounded to 200. Progress writes atomically replace the private file;
corrupt stores raise an error and remain untouched for recovery. See
`openapi.progress.json` v1.0.0.

[BREAKING CHANGE / CONTRACT IMPACT] Browser progress is now partitioned by
account. Unowned legacy browser progress stays on the device and is not
automatically uploaded into a signed-in account. Progress mutations accept an
optional `X-LingoLearn-Account` header and return 403 if that subject differs
from the session cookie. Daily XP/current streak and weekly XP are merged only
within their respective periods, retaining the newer period when devices
disagree. See `openapi.progress.json` v1.1.0.

[BREAKING CHANGE / CONTRACT IMPACT] IELTS updates return 409 when an existing
attempt changes its paper (`examId`), preserving the original scoring keys.
Language-exam uploads accept valid batches of multiple completed sections after
offline use; saved earlier sections remain immutable. See `openapi.ielts.json`
v1.1.1 and `openapi.exams.json` v1.3.1.

Cloud retry and reconnect now restore the acknowledged revision before saving;
late history responses cannot replace newer saved drafts. Workbench updates keep
checked answers immutable when a batch completes an activity and starts the next.
Corrupt assessment stores must be preserved successfully before a replacement
store is written, with unique recovery filenames for repeated failures.

[BREAKING CHANGE / CONTRACT IMPACT] Account-scoped browser requests now bind
both reads and writes to the tab's verified account through
`X-LingoLearn-Account`. A different session cookie returns 403 before accessing
that account's records; an empty header represents a guest. This covers
assessment sessions/history/results, exam and vocabulary attempts, learning
journals/plans/feedback, and progress. Cookie-only API clients remain compatible.
See session v1.5.0, learning/exams v1.3.2, IELTS v1.1.2, vocabulary v1.2.1,
and progress v1.2.0 in the matching `openapi.*.json` contracts.

[BREAKING CHANGE / CONTRACT IMPACT] Generic assessment item responses no longer
include the server-only `isPseudoword` answer key. Vocabulary grading continues
to use the original server bank; saved answers and scoring algorithms are unchanged.

Progress replacement writes are serialized and coalesced to the latest snapshot;
an account merge waits for an outstanding write. Course crowns merge by module,
so partial updates and offline sync retain results from other modules. PUT keeps
incoming-module precedence; POST keeps existing server modules on conflicts.
