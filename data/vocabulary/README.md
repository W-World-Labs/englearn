# Vocabulary reference bank v1

The bank contains 1500 original meaning items: 300 for each of English, Chinese,
Japanese, Korean and Spanish. Definitions are authored in Chinese and English.
Frequency ranks come from wordfreq 3.1.1 (Robyn Speer and contributors). The data
and original definitions are distributed under CC-BY-SA-4.0. The bank JSON keeps
its attribution attached; the complete data credits are published in
`public/vocabulary-assets/NOTICE.md`. This licence applies to the dataset, not
to unrelated application code.

Ranks use `top_n_list(language, 30000, wordlist='best')`, retaining tokens that
contain an alphabetic character and no digits or whitespace, then taking the
first 10,000. They retain wordfreq's ordering and segmentation; they are not
lemmas or word families. The list can include inflections, names, loanwords and
segments. Chinese script variants follow wordfreq's normalisation. The selected
teaching words use familiar written forms; items are curated, not a probability
sample of all types in the corpus. Do not compare counts between languages.

Four strata cover ranks 1–1000, 1001–3000, 3001–6000 and 6001–10000. Each has seventy-five
curated items per language. New tests use `adaptive.version=2` and an immutable,
shuffled pool of all 300 items and their options. They start at band 2 (ranks
1001–3000), then append one question on each confirmed Next action. Pre-expansion
records keep their original 40/80/120/160/200-item pools and remain resumable without migration.

| Mode | Minimum per band | Minimum / maximum items | Target model SD | Small-gain threshold |
| --- | ---: | ---: | ---: | ---: |
| Quick | 3 | 12 / 30 | 900 word forms | 15 word forms |
| Detailed (`full`) | 5 | 20 / 40 | 650 word forms | 8 word forms |

These are product reference thresholds, not calibrated test accuracy. During
coverage, restrict sampling to bands below their minimum; use v1's recent-accuracy
staircase (last three in the current band, >=75% with >=2 observations up one,
<=50% down one), then nearest eligible band, fewer samples, lower band. Once all
four minima are met, choose the available band with the largest expected reduction
in posterior count variance; ties use that same difficulty/sample ordering.

After each answer, calculate the four independent band posteriors on the existing
100-form grid. Their variances add to the total count variance V. For each band,
let p be the posterior predictive probability of a correct four-choice response,
and mu_correct / mu_wrong its conditional count means. By total variance,
expected variance reduction is p(1-p)(mu_correct-mu_wrong)^2. Predicted reduction
in model SD is sqrt(V)-sqrt(V-max_available_gain). Pending or unasked questions
contribute no observations, and exhausted bands cannot supply more information.
Incorrect and unknown share the failure likelihood; the predictive model assumes
four-choice guessing, which may not describe actual learner behaviour.

Only after all band minima are met, stop in this order:

1. Model posterior SD at or below the mode's reference target (`precision`).
2. Question cap reached (`limit`).
3. Best remaining item's predicted SD reduction below the threshold (`low_gain`).

Otherwise continue with the most informative available band. The latter two
reasons explicitly say the target was not attained. Stopping is derived from the
versioned responses, not a client-supplied success flag. The parser replays every
prefix, rejects premature completion and extra questions after the first stopping
point, and accepts fully answered terminal drafts awaiting confirmation.

Pool order, presented questions/options and committed answers cannot be rewritten.
Offline progress can append multiple questions in one save. Earlier answers allow
review only; the latest draft answer remains editable until advancing. History
`total` is the cap while a v2 test runs, then the actual submitted count.

Compatibility: v0.7 `adaptive.version=1` records retain the 20/40 fixed budget,
recent-accuracy selection and three-per-band reservation near the end. v0.6
records without `adaptive` retain fixed 5/10-per-band samples and answer editing
until completion. Both remain resumable and reviewable without rewriting stored answers.
The v0.9 reporting evidence rule below also applies when viewing older records.

Frequency is only a difficulty proxy; this rule is not calibrated IRT/CAT and does
not claim improved measurement precision. Minimum coverage prevents unsampled bands
from appearing as measured knowledge. The result shows per-band sample counts and
accuracy as well as the administered difficulty path. Distractors
prefer the same part of speech, excluding marked synonymous groups; when fewer
than three are available they draw from other parts of speech. This can provide
non-semantic clues and is one reason results are uncalibrated. Short definitions
can also make item difficulty depend on the learner's definition language.

`lib/vocabulary/score.ts` implements an exploratory recognition model. For each
stratum, k has a uniform prior on [0,1]. A correct response has likelihood
0.25 + 0.75k. An incorrect response contributes 0.75(1-k); an explicit unknown
contributes (1-k). The constant 0.75 cancels in normalisation. This assumes
four-way guessing for unknown meanings, not that all real users guess uniformly.
Independent posterior counts are convolved on a 100-form grid. The median and
5th/95th percentiles are displayed as a rounded estimate and 90% *model reference
interval*. Per-band likelihoods use the actual sample counts, not an equal-count
assumption or a raw overall percentage. The interval excludes adaptive/item
selection, sense/definition, corpus and calibration error. Optional stopping
does not confer 90% frequentist coverage; this is only a posterior model interval.
A vocabulary count and interval are displayed only when the separate recognition
evidence check below is satisfied. Otherwise `estimate` is null; raw posterior
bounds remain internal model quantities and are omitted from reports and TXT
exports. At >=80% correct in the highest stratum, reportable estimates warn about
the ceiling.

v0.9 adds a report-only recognition evidence check. It does not change the v2
selection/stopping parameters or require a record migration. At n answered items
with c correct, calculate the equal mixture

`E(c,n) = (1/20) sum_i (q_i/.25)^c ((1-q_i)/.75)^(n-c)`,
where `q_i=.25+.75*i/20`, `i=1,...,20`. Unknown counts as a failure. Under the
conditional uniform-guessing null `P(correct | past) <= .25`, each fixed-q factor
has conditional expectation at most one, hence so does the mixture. Starting at
one, Ville's bound gives `P(ever E >= 1/alpha) <= alpha` within an attempt, including
adaptive selection and stopping. Overall reporting uses threshold 20. The four
band labels each use 80 (a union-bound budget of .05/4). These are separate testing
families; do not claim a combined 5% guarantee for all five claims. The final E is
used, not the maximum historical E; subsequent failures can reduce evidence.

This is evidence against a specific guessing baseline, not a probability that
a learner knows a word or that the count is accurate. It does not detect cheating,
elimination strategies or remembered answers, and does not calibrate the bank.
Short samples can withhold counts from learners who do know words; absence of a
reportable number must never be represented as zero vocabulary. Each band reports
observed accuracy separately from recognition evidence. Preparing a detailed test
keeps language/definition settings and the existing draft until the normal explicit
replacement flow; the UI warns that the same bank repeats words and is not an
independent growth measurement.

`lib/vocabulary/recognition.test.ts` checks the martingale identity over every
possible 0–39-item count and exactly sums first-threshold-crossing probabilities
under independent .25 guessing through item 40. Observed finite-horizon crossing
probabilities are 0.0291522 at threshold 20 and 0.0051833 at threshold 80. These are
mathematical null-model checks, not real-user error rates.

This is an original exploratory web test, not Nation's validated Vocabulary Size
Test, a CEFR conversion, JLPT/HSK/TOPIK/IELTS score, an active-vocabulary measure,
or a calibrated total vocabulary count. The interface discloses its 10,000-form
scope. Do not infer small longitudinal growth from a curated/repeated test.
A larger randomised bank and empirical item calibration would be needed for
stronger claims. The original IRT-to-size logistic shortcut has been removed.

A reproducible model sensitivity check runs with:

```bash
npm test -- scripts/simulate-vocabulary.test.ts
```

The v0.8 baseline (commit `c068cd33faf9`, before report filtering) ran 800 seeded
synthetic tests on 2026-09-08 (100 per profile/mode):

| Synthetic profile | Quick count min / median / max | Detailed count min / median / max | RMSE quick / detailed / all 40 |
| --- | --- | --- | --- |
| Guessing only | 12 / 15 / 25 | 20 / 26 / 32 | 2328 / 1976 / 1739 |
| Foundation | 12 / 17 / 25 | 21 / 28 / 33 | 1238 / 1115 / 1091 |
| Intermediate | 13 / 21 / 26 | 23 / 31 / 33 | 903 / 901 / 861 |
| Advanced | 17 / 23 / 26 | 28 / 31 / 33 | 1435 / 1229 / 1107 |

Response probability is .25+.75k within each band; all 40 synthetic responses are
fixed before either algorithm sees them. Knowledge vectors, seeds and comparisons
are in the script. These are sensitivity checks, not human validation or evidence
that these thresholds are optimal. Shorter tests traded some model estimation
accuracy for fewer questions. Most runs stopped because of limited remaining
information, not attainment of the precision target. The nominal 90% model interval
contained the simulated truth in 3/0%, 82/75%, 96/89% and 59/70% of quick/detailed
runs respectively. Poor boundary behaviour, prior shrinkage and the small bank
prevent any claim of calibrated coverage or uniformly improved accuracy. More
questions alone do not solve these limitations; empirical item calibration and a
larger bank are needed. Do not market this as validated CAT or a certified count.

The v0.9 audit uses the same 800 responses and unchanged question paths. Numbers
are reported in the following fractions of runs:

| Synthetic profile | Quick reported / 100 | Detailed reported / 100 |
| --- | ---: | ---: |
| Guessing only | 1 | 0 |
| Foundation | 17 | 47 |
| Intermediate | 81 | 96 |
| Advanced | 100 | 100 |

Withheld results are **not** scored as zero in the audit. RMSE and interval coverage
are logged only within each reported subset, whose composition changes by mode;
those conditional statistics are not evidence of an unbiased accuracy improvement.
The remaining false signal in the guessing sample and the high withholding rate
in foundation learners illustrate the intended conservatism and its limits.
The evidence rule does not fix the baseline count model's boundary/prior bias.

Audit the exact ranks without adding an application dependency:

```bash
uv run --with wordfreq==3.1.1 python scripts/verify-vocabulary-frequencies.py
```

Methodological reading (vocabulary sources checked 2026-09-07; stopping research 2026-09-08):

- Howard, Ramdas, McAuliffe & Sekhon, *Time-uniform, nonparametric, nonasymptotic confidence sequences* (checked 2026-09-08):
  https://arxiv.org/abs/1810.08240
- Choi, Grady & Dodd, *A New Stopping Rule for Computerized Adaptive Testing*:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC3028267/
- *Stopping Rules for Computer Adaptive Testing When Item Banks Have Nonuniform Information*:
  https://pmc.ncbi.nlm.nih.gov/articles/PMC7518406/
- Paul Nation, *Vocabulary Size Test: Information and Specifications*:
  https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/vocabulary-tests/the-vocabulary-size-test/Vocabulary-Size-Test-information-and-specifications.pdf
- wordfreq sources, segmentation and data licensing:
  https://github.com/rspeer/wordfreq

The meaning-choice approach and general stopping principles were consulted; no official test items
or definitions are reproduced. All definitions in this bank are original.
