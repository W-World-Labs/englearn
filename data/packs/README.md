# Adaptive assessment packs

Generated packs are authored in `scripts/generate-zh-ko-packs.mjs`; run
`npm run generate-packs` to reproduce the Chinese, Japanese, Korean and Spanish
JSON files. Keep existing IDs, question text, answer indices and option order
stable so saved assessments retain their original interpretation.

The first 2026-09-22 expansion adds four grammar items and two open-response
tasks per language. A later pass retires three malformed Chinese grammar rows
(`zh-gra-006/014/017`) and appends corrected replacements. A second grammar
pass appends four more original B1 items per language (result, contrast,
purpose, and simultaneous or concessive patterns). Active grammar depth is 28
in every generated pack. Speaking and writing stay at five tasks each.
Totals: Chinese 141, Japanese 138, Korean 143, Spanish 143.

The grammar questions target intermediate patterns (B1, plus one B2 Spanish
past counterfactual from the first pass). The open tasks target B2 comparison,
negotiation, complaints and reasoned proposals. CEFR labels are author
estimates, not empirical calibration. No independent native-speaker review is
claimed. Each four-item grammar wave rotates answers across positions 0, 1, 2
and 3. Tests pin the historical prefixes, check option uniqueness and answer
bounds, and check prompt uniqueness.

New material: © 2026 LingoLearn contributors, original content released under
[Creative Commons Attribution-ShareAlike 4.0 International](https://creativecommons.org/licenses/by-sa/4.0/).
Source: the generator and its revision in this repository's Git history. No
third-party questions or recordings were incorporated in this expansion.

2026-10-14 English assessment audit: retired `gra-004` and `gra-006` because
indefinite and definite articles both fit without additional context; `gra-028`
because “insists” permits an assertion or a subjunctive demand; `gra-034` because
the time reference does not distinguish the conditional alternatives; and
`gra-044` because the conjunction choices do not establish a unique natural
answer. Original IDs, text, option order and keys are preserved for historical
replay. These rows are excluded from new adaptive selection by the existing
retirement mechanism. This is a targeted English audit, not a claim that every
language bank has passed an independent linguistic review.
