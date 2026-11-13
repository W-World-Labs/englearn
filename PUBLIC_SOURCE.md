# Public source scope

This candidate retains the complete original language-learning implementation:
TanStack Start/Vite routes and APIs, adaptive assessment and vocabulary algorithms,
grammar and SM-2 review, open-book reader, exams, daily learning, browser backup,
W-ID account records/ownership/conflicts, optional model scoring and telemetry.
Original functional assertions and OpenAPI contracts remain; it is not a demo.

Original application code is MIT. Content and imported resources keep the terms
and provenance in NOTICE.md and the existing per-resource notices. The original
versioned question IDs, choice order, answer keys and scoring contracts remain.

Excluded: private Git history/forge CI/agent issue state/registry credentials, runtime records and
backups, operational inventories and bindings, installed packages, generated
.output/ bundles, model/tokenizer/training files and unreviewed third-party assets.
Operator examples require explicit targets and use reserved placeholder origins.
No script is run against a live deployment during source preparation.
Browser telemetry/feedback retains the platform bootstrap path but is off until
the operator explicitly supplies a valid HTTPS URL, code, workspace and project.
Its existing loader checks retain the single-loader and configured binding
assertions, with the unset case updated to require no external loader.

## Outstanding publication boundaries

Seventy examination MP3s authored with Microsoft Edge's online speech service are
not included. Their source manifest and existing integrity/playback assertions
remain untouched. Missing audio is not replaced with silence or unrelated clips,
and assertions are not removed or skipped to claim a passing complete product.
The original implementation already reports unavailable recordings as unavailable.
The existing input configuration is data/exams/audio.json plus its listed files
under public/exam-assets/audio in the application's working directory. Authorized
holders may supply matching private copies there; the directory is gitignored.
No download, provider access or redistribution right is supplied by this source.
The exact 70 paths and expected hashes are retained in public-files.json under
withheld_assets. The two original recording goldens and browser playback checks
remain independently HOLD until authorized inputs are available.

The complete server W-ID SDK 1.3.86 resolves from its reviewed public release,
with source commit d2e3d3e05383a55167af584a838b4649010810ef; the lock retains the
actual tarball integrity. Configure W_ID_SSO_URL or W_ID_BASE_URL explicitly.
The shared telemetry SDK resolves from the unchanged public source snapshot
identified in NOTICE.md. Real SSO and telemetry remain implemented; a browser
PKCE SDK is not a replacement for the server SDK. No private registry token is
a public build input.

PUBLIC CI validates source and the existing asset-independent checks: typecheck,
67 original Vitest files selected with the explicit
--exclude lib/api/exams-audio.test.ts flag, then the two original unavailable/empty
cases in that file selected by name, the existing bootstrap check and source
build. The full npm test entrypoint, recording file and all assertions remain
unchanged. Its two asset-dependent byte/hash/Range cases are visibly unselected
and HOLD. The workflow name, job summary and packaged SOURCE.json preserve the
full recording/product acceptance as HOLD; source success is not a full-suite
result. No local product build, generated audio, downloaded model, production
operation or actual browser acceptance is represented by these source edits.
