# Code, content and asset notices

The root MIT license covers original LingoLearn application code, documentation
and original software checks. Existing authorship and code comments remain.
Third-party code and learning material are licensed independently. The full
CC BY-SA 4.0 text is retained in public/CC-BY-SA-4.0.txt.

| Component | Source and exact baseline | Terms and retained evidence |
|---|---|---|
| Original learning packs, grammar, practice questions and vocabulary definitions | LingoLearn contributors; checked-in versioned JSON | CC BY-SA 4.0; data/packs/README.md, data/learning/README.md and each bank's attribution |
| Vocabulary frequency ranks | wordfreq 3.1.1, Robyn Speer and contributors | CC BY-SA 4.0 data, with upstream data credits and additional statements retained in public/vocabulary-assets/NOTICE.md; no wordfreq runtime or corpus bundled |
| SM-2 scheduling implementation | viendinhcom/supermemo, commit 8093cde2b80dd5433236e035d35fca2db7abaeab, src/main.ts | MIT, copyright 2020 Vien Dinh; public/library/supermemo-LICENSE.txt and source comments retained |
| Brehe's Grammar Anatomy | Steven Brehe / UNG Press, original publisher PDF | CC BY-SA 4.0; public/library/ATTRIBUTION.txt; unchanged PDF hash c757c4641bc390b2ba787adb4b6db65148eb88b0ad7056857b97e10a154168b7; extracted text is a separate identified adaptation |
| IELTS Practice 01 reading | sifu-ewu/ielts-reading-mock-test, f90eeb3597b99440b97e308a31c2c7b715540b4e | MIT; original full text in public/ielts-assets/MIT-reading.txt; local question-format adaptation described in NOTICE.md there |
| IELTS Practice 01 listening; Practice 02 reading | LuchoBazz/ielts-ai-dataset, cba645115e62eccabfe03cb70e9488646b57c290 and 78f7ebf2b430114998aae6806cb92c1a4a475594 | CC BY 4.0; exact paths, creator/copyright, changes, original license and four unchanged MP3 hashes in public/ielts-assets/NOTICE.md |
| Original IELTS Practice 02 and graded-reading audio | LingoLearn scripts and recordings authored with the separately identified open-model tools | Original content CC BY-SA 4.0; 19 recordings; exact tool/model revisions and asset hashes in the existing manifests/notices. No model, tokenizer, training corpus or speech tool is bundled |

The four separately licensed IELTS Practice 01 MP3s plus nineteen original
open-model recordings are distinct from the seventy Edge-TTS examination clips.
The latter are withheld from this candidate until explicit redistribution rights
or a reviewed caller-supplied alternative is established. An open-source license
on edge-tts does not by itself license Microsoft's voices or resulting recordings.

No official IELTS, TOPIK, HSK or JLPT papers/recordings, paid lesson exports or
protected plugin implementation is granted by this MIT license. Referencing a
format or public interface does not imply affiliation or endorsement.

Runtime npm packages are separately installed under their own declared terms.
The complete MIT @w-id/sdk Node/server package is upgraded from 1.3.75 to the
canonical public version 1.3.86, source commit
d2e3d3e05383a55167af584a838b4649010810ef in W-World-Labs/w-id-node. The public
v1.3.86 release tarball is the exact reviewed CI payload (SHA256
62fc0aac0fe29be5d00de0909e94f676d9398697839ae70c03b211180c357a9d), carrying
its full MIT license, esbuild helper notice, declarations, source map and
provenance. It has no runtime package dependencies. All existing server SSO APIs
are retained; its example-only default origin requires explicit operator setup.
The MIT-licensed @w/xradar 0.2.1 JavaScript package source is retained unchanged
in vendor/w-xradar from W-World-Labs/w-radar commit
579174832c5de9a1b606f82084171b3965deae56. Its original repository LICENSE and
per-file source URLs/hashes accompany the snapshot. It has no runtime package
dependencies; telemetry remains the real shared SDK implementation.
Version 0.2.1 namespaces trace-session IDs by tracking code and uses an example-only
default endpoint. The existing telemetry cases retain their exact duration,
trace-parent, privacy, DTO and retry assertions; their session-ID golden and
explicit synthetic endpoint follow that reviewed public SDK contract.
Inter font files obtained from @fontsource-variable/inter retain their upstream
OFL; a future built distribution must carry the exact resolved package notices.
No installed dependency tree, compiled bundle or font binary is in this source
candidate. The public dependency SDK pins and complete build notice inventory
must be reviewed before a compiled distribution is published.
