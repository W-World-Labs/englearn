# Graded grammar courses and open library

The canonical original content is `data/learning/grammar-v1.json`, directly
imported by `lib/learning/catalog.ts` and downloadable under CC BY-SA 4.0.
The library download serializes that same source directly; public assets are not
imported as application modules. There are 120 lessons and 480 three-choice practice questions: all five languages
have 8 lessons per stage. The stages
are foundation, intermediate and advanced. Titles/rules are English and Chinese;
examples and questions use the target language. The learning UI has English,
Chinese, Japanese, Korean and Spanish copy; other UI locales use English fallback.

These are short, independently authored concept lessons, not a reproduction of
a commercial textbook or a comprehensive accredited syllabus. No empirical calibration,
CEFR certification or independent native-speaker editorial review is claimed.
Stable IDs and choice order are part of the journal scoring contract. Future
answer-key changes require a content version and explicit record compatibility;
do not silently reinterpret saved answer indexes.

## Admission policy

The product uses open-source projects and open learning content only for new
third-party additions. Confirm a source's explicit licence for the exact revision
and each reused asset, including commercial use, modification and redistribution
rights required by the feature. Preserve authorship, source links, licence text,
change notices and any share-alike conditions. A code licence does not automatically
license books, questions, recordings or images in that repository. Public-domain
status must be established for the intended use; free-to-read or unspecified
licensing is not sufficient. Follow separately credited exceptions rather than
assuming a work's overall licence covers every asset. Record sources here and in
the public/exported attribution. Original courses remain CC BY-SA 4.0.

v0.12.1 removes commercial textbook recommendations and purchase links. The
existing open textbook, original courses, vocabulary bank and licensed SM-2 code
remain available with their attribution.

## Material reused

- **Brehe’s Grammar Anatomy**, Steven Brehe, University System of Georgia /
  University of North Georgia Press. The publisher PDF front matter explicitly
  grants CC BY-SA 4.0. The original PDF is redistributed unchanged, retaining its
  attribution and notices. It is an English grammar reference, not a graded ESL
  series. 340 PDF pages, 2,237,132 bytes. Publisher:
  https://ung.edu/university-press/books/grammar-anatomy.php . Original file:
  https://web.ung.edu/media/university-press/brehes-grammar-anatomy.pdf . SHA-256:
  `c757c4641bc390b2ba787adb4b6db65148eb88b0ad7056857b97e10a154168b7`.
- **viendinhcom/supermemo**, MIT, copyright 2020 Vien Dinh. Reused `src/main.ts`
  at commit `8093cde2b80dd5433236e035d35fca2db7abaeab` in
  `lib/learning/supermemo.ts`, with formatting/provenance comments but no algorithm
  change. Full copyright/license in `public/library/supermemo-LICENSE.txt`.
  https://github.com/viendinhcom/supermemo . No new runtime package dependency.

All source/license checks above were made on 2026-09-08. Public attribution:
`public/library/ATTRIBUTION.txt`. CC BY-SA permits redistribution/adaptation,
including commercial reuse, subject to attribution, change notices and share-alike
conditions; retain any separately credited third-party exceptions in the book.
https://creativecommons.org/licenses/by-sa/4.0/ . The course license covers the
original lesson content; it does not change the license of the application.

## Evaluated, not copied

- `pretzelai/openlingo`: repository/license inspected (MIT). Its progressive
  units and short explanations informed the interaction direction. No code or
  teaching content copied. https://github.com/pretzelai/openlingo
- `ArtCC/freelingo`: AGPL-3.0 license inspected. No code copied; the existing
  application stack already supports these learning flows.
- KPU Academic Grammar and other NC/ND textbooks were not selected for adapted
  commercial course distribution. Free-to-read pages are not assumed open-licensed.

## Learning records and review schedule

`/learn` provides stage filters, search, a lecture/practice view, due reviews,
paginated answer history and an open-book reader. Each lesson has four questions
with immediate answers/rule feedback. The learner controls the pace. Book page
controls save a 1-based PDF-page bookmark. The default text reader loads a 340-page
text edition extracted using `pdftotext -layout`, retaining page boundaries.
The reader and PDF download use the explicit streaming API: the Vite/Nitro
development static handler was observed to repeat a 64 KiB chunk in large files,
despite reporting the correct length. Full-body digest checks guard this path. This
CC BY-SA adaptation omits graphics/typographic details and may contain extraction
errors; the unchanged PDF is the reference. The optional native PDF viewer's internal
scroll is not observable. Download/open-in-tab fallback is also available.

One `grammar-v1` journal per W-ID sub lives in the existing persistent data volume,
namespace `learning-journals`; guests use a separate browser key. It contains an
append-only completed-event list, a replaceable unfinished round and a bookmark.
The atomic owner-scoped store and revision-based cloud hook are shared with exams.
Unknown request fields are stripped. Existing events and original start time
cannot be rewritten; offline batches can append. A conflict preserves browser
work and exports it before adopting the account copy. W-ID expiry/storage failures
show retry/login/export actions. Guest learning is not silently imported into a
signed-in account. The 10,000-unit-round cap and 5 MB request bound are explicit.
Backups are exportable JSON; full-journal backup import/merge is not included. Portable recall results use the separate format below.

Scheduling is practice support, not a vocabulary/ability estimate: four correct
answers map to SM-2 grade 4, three correct to grade 3, and lower scores to grade 2.
The first successful review is due after one day, then six days. Later intervals
follow SM-2, bounded to 365 days, with easiness capped at 3 (SM-2 minimum 1.3).
Successful repetitions before the due time do not extend it or increment the SM-2
repetition state. A weak round resets the sequence and brings review to the next
day. Dates are derived from immutable events. Practice does not modify exam or
vocabulary measurements, paid entitlements or organization membership.

## Validation

`npm test` covers course shape, lifecycle/replay, due dates, repetition bounds,
future/corrupt records, request limits, account isolation, revisions, storage errors,
and the public PDF digest/ranges/HEAD. Existing assessment/exam tests cover regressions.
`node scripts/test-learning-browser.mjs` checks guest flows, layout, answer history,
resume, page bookmarking, PDF download, due queues and blocked browser storage.
`node scripts/test-learning-cloud.mjs` checks actual local SDK-signed account sessions
and cloud persistence. Use the isolated loopback configuration documented by
`scripts/test-ielts-cloud.mjs`; do not use fake credentials against production.
Set `ENGLEARN_PLAYWRIGHT_MODULE` to an installed Playwright module if needed.

[BREAKING CHANGE / CONTRACT IMPACT] Additive `/api/learning/journal` and
`/api/library/book`, documented in `openapi.learning.json`. Consumer: this app's
learning workspace. Existing assessment, vocabulary, exam and W-ID APIs unchanged.

## Recall and portable materials (v0.12)

`lib/learning/cards.ts` reuses the existing 288 original grammar questions and
200 original vocabulary definitions: 488 stable cards. No original lesson or
vocabulary ID, question, choice index or scoring rule was rewritten. Grammar
cards retain their course stage. Vocabulary stage is only a coarse frequency-band
filter (band 0 foundation, bands 1–2 intermediate, band 3 advanced), not a CEFR
estimate or evidence of what a learner knows. Each pack contains one language,
1–160 cards, and English or Chinese explanations/controls. The app's primary
navigation supports EN/ZH/JA/KO/ES, with some secondary help using English fallback.

Unit answers and recall self-ratings feed per-card schedules. A wrong unit answer
or latest recall rating 0 marks a difficult card; date-based due cards are also
available. A 6/12/20 target uses only available unique cards and mixes concepts.
Ratings 0/1/2 map to SM-2 grades 2/3/4; earlier successful practice does not extend
the due date. Completed recall rounds are append-only, up to 1,000 per journal.
The recall draft coexists with an unfinished course lesson. Stable chronological
replay supports older offline records. The original whole-lesson queue remains
separately labelled; practising some cards does not complete a whole lesson.

The design uses retrieval and spacing as practice principles, supported by the
IES practice guide _Organizing Instruction and Study to Improve Student Learning_:
https://ies.ed.gov/ncee/wwc/PracticeGuide/1 . It does not claim an experimentally
validated optimum round length, calibrated ability, or measured learning gains
from this implementation. Self-ratings do not change test scores.

HTML exports inline content, styles and recall controls, with a CSP blocking
network connections/resources and no account identifiers. HTML-escaped content
and script-safe JSON protect the embedded document. Offline rounds prioritize
unseen/difficult cards, retain a checked prefix, and export completed **and
unfinished** results. They do not run a background reminder service. Local file
storage varies by browser; export JSON before moving devices or clearing storage.
A file-preview app may disable JavaScript: open the HTML in a browser instead.

`lingolearn-review-results` v1 (documented in OpenAPI) is a client-only import
format: maximum 5 MB, 1,000 rounds, 20 cards/round. A particular offline pack only
accepts its own card IDs; the website accepts known cards across the five
languages. Parse/validate everything before committing. Duplicate IDs with
identical records are skipped; conflicting content fails without partial writes.
An unfinished imported round is opt-in on the website; offline replacement of an
answered draft asks for confirmation. Raw corrupt local data can be exported
before an explicit reset; unavailable storage still permits in-memory export.
The full journal backup has a different schema and is not an import file here.

Printed A4/Letter/A5 workbooks include write-in example/notes lines and optional
answers beginning on a new page. References consolidate selected grammar
concepts. Cut-and-fold cards put front and back on the same sheet, avoiding
printer-dependent duplex alignment. Browser Print / Save PDF respects the CSS
paper size; disable print headers and footers. Plain text and UTF-8 Anki TSV are
additional formats; the latter includes HTML, field and tag headers, and stable
card IDs in the first field to keep identical prompts distinct. Official importer:
https://docs.ankiweb.net/importing/text-files.html . The user can import on Anki
desktop and use Anki's own sync. No Anki account or sync API is integrated here.

Exports retain CC BY-SA 4.0 original-content attribution and wordfreq 3.1.1
(Robyn Speer and contributors) frequency provenance. Exported IDs/format version
are compatibility markers, not identifiers for a user. Native share uses the
browser file-share capability and falls back to a download; cancellation does
not trigger an unwanted download.

Additional browser checks:
`node scripts/test-portable-learning.mjs` generates actual PDFs/HTML/TXT/TSV,
checks five-language layouts, recall/resume, import validation, offline cross-device
transfer, storage failures, native-share payloads/fallback and vocabulary preselection.
`node scripts/test-recall-cloud.mjs` uses actual local SDK sessions for recall
continuation, failed saves, conflict backups and multilingual historical imports.
On 2026-09-08 generated A4/Letter/A5 dimensions/text were checked with Poppler;
CJK pages were visually inspected. Anki 26.8.1's real importer accepted five
12-card TSVs (60 cards), preserving fields/tags and creating zero duplicates on
reimport. Anki was installed only in a temporary validation environment.

## Account-based arrangements (v0.13)

`lib/learning/plan.ts` derives a read-only plan from existing records; no additional
third-party code or learning content is imported. W-ID supplies the verified owner,
not the learner's ability. Only that owner's exact-language evidence is used; unknown
legacy language labels are not guessed, and platform-admin claims grant no access.
The home page and courses support EN/ZH/JA/KO/ES plan copy with English fallback.

The current deterministic rules are transparent product heuristics, not empirically
calibrated placement, growth measurement or an optimal learning schedule:

- Start with the latest eligible grammar-module assessment in the last 180 days:
  at least five items, finite theta, a valid CEFR label, and 0 < standard error <= 0.8.
  A1/A2 map to foundation, B1/B2 to intermediate, C1/C2 to advanced practice.
  This does not validate the underlying bank or turn practice stages into CEFR.
- Use the latest result for each distinct lesson in the last 90 days, after that
  assessment. Three concepts on at least two UTC calendar dates, each >=75% with
  mean >=80%, allow the next stage. Further advancement needs separate evidence
  at the next stage. A mean below 50% across three current-stage concepts steps
  back once. Repeated identical lessons and recall self-ratings cannot promote.
- Without sufficient recent evidence, use a tentative foundation entry and offer
  a grammar diagnostic; it does not assert that the learner is a beginner. An
  unavailable/corrupt store returns 503 instead of an empty profile.
- Suggest up to three distinct lessons: unfinished work in the chosen language,
  weak concepts at/below the suggested stage, due lessons, then unseen lessons at
  that stage. If all are studied and none need review, show the completed-catalog
  message and let the learner explore other stages. Manual selection is always
  available and does not rewrite the account's evidence.
- Vocabulary uses its own latest finished test within 180 days. At least three
  observed answers per relevant frequency band and >=75% accuracy, supported by
  the existing recognition evidence threshold of 20, guide practice-band choice:
  bands 0 and 1 support intermediate, with band 2 also supporting advanced;
  otherwise use foundation practice. Frequency bands are not grammar ability.
  Prioritize actual incorrect/unknown words, excluding newer successful recalls
  until due; otherwise offer unasked words in that practice band, up to twelve.
- The existing recall schedule and drafts continue unchanged. Plan reads do not
  save journals, rewrite scores, import guest work or change entitlements. The
  learning workspace recomputes against the current owner-scoped browser journal;
  failed sync remains visible, and other devices only see saved evidence. Plans
  refresh on navigation/focus and can be retried, with a 10-second request timeout.
  No shared/browser plan cache; late responses after account/language changes are
  discarded. The public book/reference remains manually accessible at every stage.

Validation adds pure rule tests and real SDK/storage API tests for freshness,
confidence gates, distinct concepts, skill/language separation, immutability,
account isolation, unsupported languages and unavailable storage. The loopback
browser suite `scripts/test-learning-plan.mjs` scores real grammar assessments,
completes a lesson, restores the same arrangement on a clean device, and checks
manual overrides, cold starts, delayed responses and error/expiry recovery.

## Daily workbench and evidence (v0.15)

`/learn` now opens Today. The course catalog remains at `/learn?tab=courses`.
The owner journal optionally stores a versioned `workbench` extension; no existing
answer, event ID or score is migrated. New daily plans, activities, preferences,
difficulty feedback and saved reading words use the same W-ID subject boundary,
cloud revision checks, offline backup and conflict recovery as existing study.
Guest data stays in the guest browser until explicitly handled by the learner.

- Choose general learning, travel/conversation, work/study or exam preparation,
  and a 5/15/30 minute budget. Estimates are task budgets, not measured study time.
  Due/weak recall comes first, then eligible delayed checks. Travel prioritizes
  listening, work/study reading, and exam preparation additional concept work.
  Explanation/practice steps follow the account's evidence-backed stage.
- After a seven-day absence, suggest five minutes. The learner still chooses the
  workload. Plans are fixed snapshots with one unfinished plan per language;
  resume on another device, or explicitly skip an activity without scoring it.
- The knowledge profile shows recent 90-day concept evidence, first versus
  repeated questions, dates and delayed results. “Retained” means >=4 first
  answers, two dates and two correct unseen delayed answers; it is a practice
  signal, not a calibrated mastery claim. “Too hard” prioritizes explanation and
  practice; “too easy” prioritizes other concepts. Neither changes test scores.
- `variants-v1.json` contains 1440 original questions across all 120 concepts: six
  practice variants and six reserved retest items each. v0.15 adds 576 questions
  with stable `v5`–`v12` IDs; `v1`–`v4` retain their exact published content.
  The forty-eight newer non-English lessons contribute their own `v1`–`v12` pools.
  Two-item rounds prefer unseen questions, then latest mistakes, then oldest
  attempts. Reserved items open at least three days after concept practice;
  subsequent client batches wait three days after the previous completed check.
  Retest answers are withheld until submission. Further repetitions are labelled
  as repetitions; the finite pool does not promise unlimited unseen tests.
- Actual practice-variant answers seed recall cards. Reserved retest items are
  excluded from ordinary recall/export. The new path needs at least four fresh
  answers per concept, three concepts and two dates for stage advancement, using
  evidence after the latest eligible assessment. Insufficient evidence cannot
  promote. Existing lesson-only rules remain compatible.
- `readings-v1.json` adds 15 original short texts/dialogues (five languages ×
  three practice stages), 90 comprehension questions and 45 contextual words.
  v0.15 adds four questions per text with `q3`–`q6` IDs; existing sentences,
  questions, word definitions and audio remain byte/meaning compatible. Reading
  and listening share the same six-question pool and select two per round.
  Sentence explanations are available in English and Chinese. Audio can be
  replayed; transcripts remain available on failure. Saving a word immediately
  makes it eligible for recall without claiming a vocabulary-test improvement.
- Twenty-nine version-specific exam links connect related grammar in IELTS, HSK,
  TOPIK and JLPT reviews to an explanation, original micro-lesson, variations and
  a subsequent delayed check. These are explicit supporting concepts, not an
  inferred diagnosis of why an answer was wrong. Unmapped questions retain their
  existing explanations; all original exam scores and answers remain untouched.
- The seven-day report separates first/repeated/delayed answers, previous weak
  concepts improving, remaining weak concepts and skipped tasks. A plan with
  skipped tasks is not counted as fully completed. Missing delayed data is shown
  as missing, never as a zero score.
- Question feedback accepts answer errors, unclear explanations and difficulty
  mismatch through `/api/learning/feedback`. Only the signed subject can read
  their reports. Retries are idempotent; reports never change answers. Operators
  can run `scripts/learning-feedback-summary.py` with the product data directory
  to prioritize content QA by question/reason count without exposing identities
  or free-text notes. Reporting collects feedback; it does not promise automatic
  correction or send messages externally.

New content is original LingoLearn work, CC BY-SA 4.0; no commercial textbook,
exam paper or Lute text was copied. Code review includes distinct item IDs,
answer bounds, distractor ambiguity and text/question alignment. No independent
native-speaker editorial review or psychometric calibration is claimed.

## Reading workflow and scheduling research

[Lute's reading workflow](https://luteorg.github.io/lute-manual/usage/reading/reading.html)
informed contextual word definitions and saved-word review. Lute code is MIT;
this release borrows the interaction idea, not its code or tutorial content.
Reading completion does not automatically mark every word as known.
[Anki daily limits](https://docs.ankiweb.net/deck-options.html#daily-limits)
informed bounded workloads after an absence. The three-day check is our explicit
product heuristic, not a universal optimal interval. General support for spacing
and retrieval practice is described in the
[IES practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/1); our own learning
effectiveness still needs longitudinal evidence.

`ts-fsrs` 5.4.2 (MIT) was evaluated in a temporary tools environment. A read-only
production audit on 2026-09-08 found zero persisted learning journals and zero
eligible delayed recall observations after release-verification fixtures had
been removed. There is no production accuracy/workload comparison to report.
Default FSRS replay (retention .9, fuzz off, short-term steps off, cap 365 days)
was compared to the existing SM-2 early-repeat guard on four synthetic sequences:
final intervals were FSRS 72/3/3/7 days versus SM-2 15/6/1/6 days. These differences
show schedule compatibility, not superiority. “With help” does not unambiguously
mean FSRS Hard/unaided success. Keep SM-2; add no application dependency.

For a repeatable audit, run `scripts/export-recall-evaluation.py` on the product
host with `ENGLEARN_DATA_DIR`, redirecting its anonymous relative-day/rating
sequences into a private temporary file. Run `scripts/evaluate-fsrs.mjs` with Node
22 `--experimental-strip-types` and `ENGLEARN_FSRS_MODULE` pointing to the temporary
5.4.2 installation. Only aggregates are printed; no model fitting or future data
is used to predict an earlier answer. Do not commit individual sequences.

The workbench outcome audit is separate because its evidence is concept-based:
run `node scripts/export-workbench-evaluation.mjs` with `ENGLEARN_DATA_DIR` on
the product host, or pass `--root` pointing at a copied `learning-journals`
directory. The report is aggregate-only and separates instruction first-answer
accuracy, repeated-answer accuracy, unseen delayed-check accuracy, and the
retention rate among concepts with at least four instruction first answers,
two instruction dates and two delayed answers. Delayed questions are new item
IDs, so they are never counted in the instruction denominator. The audit skips
corrupt files and reports their count; it does not change or quarantine runtime
records. Store the aggregate output privately with the audit date and release
id, never commit journal files or per-account sequences.

## Original reading audio

`audio-v1.json` records script/MP3 hashes, durations, model revisions and speakers.
MP3 files are synthesized locally from our original texts and offered under
CC BY-SA 4.0. No learner data or remote speech service is involved. Models and
Python dependencies are authoring tools only; production serves static MP3 files.

- EN/ES/JA: pinned [MeloTTS](https://github.com/myshell-ai/MeloTTS) code and
  language checkpoints (MIT). English BERT features and the
  Japanese tokenizer are Apache-2.0. Spanish uses BETO's tokenizer, credited
  under the publisher's CC BY 4.0 notice; its BERT weights are disabled by the
  checkpoint. The tokenizer is used to segment our original text.
- ZH/KO: [Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS) and the
  [0.6B CustomVoice model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice),
  Apache-2.0, presets Vivian (ZH) and Sohee (KO). No uploaded voice or person's recording is cloned.
- Rejected for this release: Melo's Korean auxiliary has separate upstream
  commercial-use conditions. The Korean assets use Qwen instead; the authoring
  script avoids loading Melo's unused Korean module.

Regeneration uses `scripts/generate-learning-audio.py --engine melo|qwen` and
optional `--id <text-id>`. Use separate temporary Python 3.11 environments. Melo
uses its pinned source (set `ENGLEARN_MELO_SOURCE`), torch/torchaudio 2.5.1 CPU,
transformers 4.27.4, numpy <2, unidic-lite, NLTK tagger/cmudict and its existing
phonemizers; Qwen uses qwen-tts 0.1.1, transformers 4.57.3 and the same CPU Torch.
Use ffmpeg/ffprobe to encode/check 24kHz mono 64kbps MP3. Pins and script hashes
identify provenance; floating-point sampling is not a promise of bit-identical
regeneration. Review regenerated narration before replacing published assets.
Full notices are served at `/learning-audio/NOTICE.md`.

The v0.14 audio/workbench validation covered 207 unit/API tests, actual SDK/cloud sessions, checked-answer
resume, offline conflicts and old-client protection, all original course/material
regressions, 320–1440px layouts, and all 15 MP3 hashes/ranges. Offline ASR was used
to compare synthesized scripts; it found a dropped Korean passage that was
regenerated sentence by sentence. Chinese narration was also replaced after
pronunciation mismatches. ASR transcript comparison is not a native-speaker audit.


v0.15 validation adds published-content fingerprints, six-item coverage in all
72 practice pools and all 15 comprehension pools, three separated reserved
batches, old single-item retest replay, immutable saved queues and cross-device
checked-answer continuation. The 213 unit/API tests include all original
assessment, exam, recall and audio regressions. The browser workbench check now
reaches all six practice/comprehension items through short rounds and verifies
the next delayed batch remains unavailable until its due date. No new runtime
dependency, endpoint or data migration is required. Recall now offers 2745 cards:
480 original grammar, 1500 vocabulary, 720 practice variants and 45 reading words.

[BREAKING CHANGE / CONTRACT IMPACT] Additional canonical question/card IDs;
consumer: LingoLearn's workbench and portable recall materials. Journal v1 shapes,
limits, answer keys and historical validation stay compatible. Saved activities
and daily queues keep their item snapshots; only newly selected queues use the
larger pools. OpenAPI 1.3.1 documents these selection and compatibility rules.

## IELTS preparation practice

The speaking prompts in `components/ielts/PreparationDrills.tsx` are original
LingoLearn content, © 2026 LingoLearn contributors, CC BY-SA 4.0
([full licence](https://creativecommons.org/licenses/by-sa/4.0/legalcode)). They are not
official examination questions or recalled test material. Writing tasks and
objective question explanations retain their existing per-paper provenance in
`public/ielts-assets/NOTICE.md`; no new external learning assets were imported.
Sera's linked article is a method reference only, not redistributed content.
