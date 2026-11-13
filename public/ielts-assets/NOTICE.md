# IELTS practice assets — provenance and licences

Academic Practice 01 (`academic-practice-01-v1`) is an independent,
original-format practice set. It is not affiliated with IELTS, British
Council, IDP or Cambridge, and does not reproduce official questions
or recordings.

## Reading passages and questions (adapted)

- Source: [sifu-ewu/ielts-reading-mock-test](https://github.com/sifu-ewu/ielts-reading-mock-test)
- Revision: `f90eeb3597b99440b97e308a31c2c7b715540b4e`
  (`docs: add MIT LICENSE file`, verified 2026-09-14)
- Licence: MIT (© 2026 sifu-ewu), full text in `MIT-reading.txt`
- What changed: adapted into the local question format in
  `data/ielts/reading.json`; original prose retained.
- Verification: first passage `Bioluminescence: Living Light` matches
  upstream `src/data/mockTestData.ts` at the pinned revision.

## Listening questions, transcripts and recordings (unmodified audio)

- Source: [LuchoBazz/ielts-ai-dataset](https://github.com/LuchoBazz/ielts-ai-dataset),
  path `datasets/practice-drills/listening/ielts-listening-band-8.0-test-001`
- Revision: `cba645115e62eccabfe03cb70e9488646b57c290` (verified 2026-09-14)
- Licence: Creative Commons Attribution 4.0 International (CC BY 4.0),
  full text in `CC-BY-4.0.txt`. © LuchoBazz (Luis Miguel Báez).
  Licensed material is provided as-is; see Section 5 of the licence.
- What changed: question format adapted and a terminal map added from the
  supplied transcript. Recordings are byte-identical to upstream:
  - `section-1.mp3` sha256 `a32b300e860ce8cdd2850326386d6d1f7b1183fa8e659a07727a6f2325dda5ea`
  - `section-2.mp3` sha256 `d5bdca7b146aef8ca254e43bcd291c4f0fffd45bfc7a71818496e16c401e73be`
  - `section-3.mp3` sha256 `bb38a5430cf6e3a343fee4c8e252d08c362816d20bd0e5c77d5ca54fcb8ec37c`
  - `section-4.mp3` sha256 `ac5328d1671f0fb296cacb33e66d362d692546920c179d2b2539b72f785a501e`

## Writing interaction (reference only, nothing copied)

- Reference: [Arittra95/computer-based-ielts-writing-test-interface](https://github.com/Arittra95/computer-based-ielts-writing-test-interface),
  revision `5936c1cae71c7cc9e189a8864bdf14ba71d2cfa7`, Apache-2.0.
  Writing tasks are authored for LingoLearn.

## Interface and flow (reference only)

- [Official IELTS Academic familiarisation resources](https://ielts.org/take-a-test/preparation-resources/sample-test-questions/academic-test),
  inspected 2026-09-07. This independent product follows the interaction
  pattern; it is not affiliated with IELTS.

## Academic Practice 02 (`academic-practice-02-v1`)

An independent second practice set. Reading adapts openly licensed material;
listening scripts, recordings and writing tasks are original LingoLearn work
(CC BY-SA 4.0). Single narrator voice; transcripts label the speakers.

### Reading passages and questions (adapted)

- Source: [LuchoBazz/ielts-ai-dataset](https://github.com/LuchoBazz/ielts-ai-dataset),
  revision `78f7ebf2b430114998aae6806cb92c1a4a475594` (main HEAD, verified 2026-09-14)
- Licence: CC BY 4.0 (© LuchoBazz), full text in `CC-BY-4.0.txt`
- Passages 4 and 6 from
  `datasets/synthetic-official-mocks/reading/ielts-reading-academic-001.json`
  (Vertical Farming; Quantum Computing & Cryptography).
  Passage 5 adapts `The Economics of Attention in the Digital Anthropocene` from
  `datasets/practice-drills/reading/ielts-reading-academic-band-9.0-test-001.json`
  (same repository and revision; prose simplified). The overlapping
  `Psychology of Urban Design` piece was not reused (too close to Practice 01's
  urban-trees passage).
- What changed: converted to the local passage/question format, renumbered
  q41–q80, one table merged from two blanks. No passage overlaps Practice 01.

### Listening scripts and recordings (original, synthesized locally)

- Scripts: original dialogues/lecture (Elmfield flat rental; Maplewood garden;
  project tutorial; sleep and memory). Single narrator voice.
- Recordings `practice-02-part-1..4.mp3`, synthesized locally with MeloTTS EN:
  code `myshell-ai/MeloTTS@209145371cff8fc3bd60d7be902ea69cbdb7965a`,
  checkpoint `myshell-ai/MeloTTS-English@bb4fb7346d566d277ba8c8c7dbfdf6786139b8ef`,
  BERT `bert-base-uncased@86b5e0934494bd15c9632b12f734a8a67f723594`.
  Track lengths 317.976 / 247.512 / 255.504 / 301.344 s.
  - `practice-02-part-1.mp3` sha256 `50606c3a5c1ebc612bde0e3bb2c5448ad0a8ee1ebaa5feaf89428110032bf326`
  - `practice-02-part-2.mp3` sha256 `63cbc01dea9f41246fde0038e3e0dc79d95f4934e476d0476322b8bc59b76982`
  - `practice-02-part-3.mp3` sha256 `aea49a8c5747ac9e6f1e2c35e4ab68d2a25e08d0fc536c50bb91fa8c341d9cf1`
  - `practice-02-part-4.mp3` sha256 `1cbae6ab2b9b2a6f98a169868ede3135b040835b2ffb3df1c4e66fb933cbf5a0`

### Writing tasks (original)

- Two original tasks (Marrowgate library line chart; tourist-tax discussion),
  CC BY-SA 4.0. Chart data in `MARROWGATE_TABLE` (`lib/ielts/exam.ts`).
