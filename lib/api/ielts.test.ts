import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  createSession,
  finishSection,
  type ExamSession,
} from "@/lib/ielts/session";
import { SECTIONS } from "@/lib/ielts/exam";
import { handleIeltsGet, handleIeltsPost } from "./ielts";
import { handleAuthCallback, handleAuthLogin, handleAuthMe } from "./auth";
import { getSsoConfig } from "@/lib/auth/config";

let directory: string;
let alice: string, bob: string, expired: string;
const origin = "http://localhost:31971";
function request(
  method: string,
  cookie = alice,
  body?: unknown,
  query = "",
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/api/ielts/attempts${query}`, {
    method,
    headers: {
      cookie: `lingolearn_session=${cookie}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
function post(
  session: ExamSession,
  revision: number | null = null,
  cookie = alice,
) {
  return handleIeltsPost(
    request("POST", cookie, { session, revision, userId: "bob" }),
  );
}
beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_SSO_URL", "https://identity.example.test");
  vi.stubEnv("W_ID_REDIRECT_URI", `${origin}/api/auth/callback`);
  const cfg = getSsoConfig()!;
  const exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await cfg.signSessionClaims({ sub: "alice", login: "alice", exp });
  bob = await cfg.signSessionClaims({
    sub: "bob",
    login: "bob",
    is_admin: true,
    exp,
  });
  expired = await cfg.signSessionClaims({ sub: "alice", exp: 1 });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-ielts-api-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("W-ID protected exam records", () => {
  it("rejects missing, expired, forged and malformed cookies using the real SDK verifier", async () => {
    for (const cookie of ["", expired, `${alice}forged`, "%E0%A4%A"]) {
      expect((await handleIeltsGet(request("GET", cookie))).status).toBe(401);
      expect(
        (
          await post(
            createSession("reading", Date.now(), "draft"),
            null,
            cookie,
          )
        ).status,
      ).toBe(401);
    }
    expect((await (await handleAuthMe(request("GET"))).json()).user.sub).toBe(
      "alice",
    );
  });
  it("persists answers and annotations, isolates accounts including admins, and ignores a supplied owner", async () => {
    const session = {
      ...createSession("reading", Date.now(), "saved-record"),
      answers: { R1: "iii" },
      notes: { R1: "check" },
      flags: ["R1"],
      highlights: { RP1: [{ start: 1, end: 5 }] },
    };
    expect((await post(session)).status).toBe(200);
    const response = await handleIeltsGet(
      request("GET", alice, undefined, "?id=saved-record"),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).attempt.session).toEqual(session);
    expect(
      (await handleIeltsGet(request("GET", bob, undefined, "?id=saved-record")))
        .status,
    ).toBe(404);
    expect(
      (await (await handleIeltsGet(request("GET", bob))).json()).total,
    ).toBe(0);
    const file = path.join(
      directory,
      "ielts-attempts",
      createHash("sha256").update("alice").digest("hex"),
      "saved-record.json",
    );
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).session.answers.R1).toBe(
      "iii",
    );
  });
  it("allows identical retries but refuses stale writes without replacing the newer answer", async () => {
    const session = createSession("reading", Date.now(), "race");
    expect((await post(session)).status).toBe(200);
    expect((await (await post(session)).json()).attempt.revision).toBe(1);
    const updates = await Promise.all([
      post({ ...session, answers: { R1: "A" } }, 1),
      post({ ...session, answers: { R1: "B" } }, 1),
    ]);
    expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
    const saved = (
      await (
        await handleIeltsGet(request("GET", alice, undefined, "?id=race"))
      ).json()
    ).attempt;
    expect(saved.revision).toBe(2);
    const conflict = await updates.find((r) => r.status === 409)!.json();
    expect(conflict.attempt).toEqual(saved);
  });
  it("preserves the original practice set when an update supplies a different examId", async () => {
    const initial = {
      ...createSession("reading", Date.now(), "same-paper"),
      answers: { R1: "iii" },
    };
    const saved = await (await post(initial)).json();
    const changed = await post(
      { ...initial, examId: "academic-practice-02-v1" },
      saved.attempt.revision,
    );
    expect(changed.status).toBe(409);
    expect((await changed.json()).attempt).toEqual(saved.attempt);
    const restored = await (
      await handleIeltsGet(request("GET", alice, undefined, "?id=same-paper"))
    ).json();
    expect(restored.attempt).toEqual(saved.attempt);

    // Practice 02 remains independently creatable and editable.
    const second = createSession(
      "reading",
      Date.now(),
      "second-paper",
      "academic-practice-02-v1",
    );
    expect((await post(second)).status).toBe(200);
    expect((await post({ ...second, answers: { R1: "A" } }, 1)).status).toBe(200);
  });
  it("locks submitted sections and completed answer sheets", async () => {
    const listeningId = SECTIONS.listening.questions[0].id;
    const initial = {
      ...createSession("full", Date.now(), "locked"),
      answers: { [listeningId]: "first answer" },
    };
    await post(initial);
    const reading = finishSection(initial, Date.now());
    expect((await post(reading, 1)).status).toBe(200);
    expect(
      (await post({ ...reading, answers: { [listeningId]: "changed" } }, 2))
        .status,
    ).toBe(409);
    const finished = finishSection(
      finishSection(reading, Date.now()),
      Date.now(),
    );
    expect((await post(finished, 2)).status).toBe(200);
    expect(
      (await post({ ...finished, answers: { tamper: "no" } }, 3)).status,
    ).toBe(409);
  });
  it("keeps server deadlines and reconciles expired records on another device", async () => {
    const initial = createSession("full", Date.now() - 3000, "clock");
    await post(initial);
    const extended = { ...initial, deadline: initial.deadline + 10000 };
    expect(
      (await (await post(extended, 1)).json()).attempt.session.deadline,
    ).toBe(initial.deadline);
    const elapsed = createSession("reading", Date.now() - 3700000, "elapsed");
    const response = await post(elapsed);
    expect((await response.json()).attempt.session.status).toBe("finished");
  });
  it("retains multiple tests and paginates with a recoverable latest attempt", async () => {
    const now = Date.now();
    for (let i = 0; i < 12; i++)
      await post(createSession("writing", now - i * 100, `record-${i}`));
    const data = await (
      await handleIeltsGet(
        request(
          "GET",
          alice,
          undefined,
          "?page=2&pageSize=10&draftId=record-5",
        ),
      )
    ).json();
    expect(data.total).toBe(12);
    expect(data.items).toHaveLength(2);
    expect(data.totalPages).toBe(2);
    expect(data.latest.session.id).toBe("record-0");
    expect(data.draft.session.id).toBe("record-5");
  });
  it("rejects bad input, cross-origin writes, path traversal and oversized payloads", async () => {
    const session = createSession("reading", Date.now(), "valid");
    expect(
      (
        await handleIeltsPost(
          request("POST", alice, { session, revision: null }, "", {
            Origin: "https://attacker.example",
          }),
        )
      ).status,
    ).toBe(403);
    expect((await post({ ...session, id: "../escape" })).status).toBe(400);
    expect(
      (await post({ ...session, deadline: session.deadline + 10000 })).status,
    ).toBe(400);
    expect((await handleIeltsPost(request("POST", alice, null))).status).toBe(
      400,
    );
    expect(
      (
        await handleIeltsPost(
          request("POST", alice, { padding: "x".repeat(512001) }),
        )
      ).status,
    ).toBe(413);
    expect(
      (
        await handleIeltsPost(
          request("POST", alice, {}, "", { "Content-Type": "text/plain" }),
        )
      ).status,
    ).toBe(415);
  });
  it("reports storage outages without pretending an empty history or successful save", async () => {
    const file = path.join(directory, "not-a-directory");
    fs.writeFileSync(file, "test");
    vi.stubEnv("ENGLEARN_DATA_DIR", file);
    expect((await handleIeltsGet(request("GET"))).status).toBe(503);
    expect(
      (await post(createSession("reading", Date.now(), "outage"))).status,
    ).toBe(503);
  });
});

describe("W-ID login redirect and callback", () => {
  it("creates OAuth state, returns to IELTS and sets a verifiable session", async () => {
    const login = await handleAuthLogin(
      new Request(`${origin}/api/auth/login?next=/ielts`),
    );
    expect(login.status).toBe(302);
    const state = new URL(login.headers.get("location")!).searchParams.get(
      "state",
    )!;
    expect(login.headers.get("set-cookie")).toContain("HttpOnly");
    const cfg = getSsoConfig()!;
    const exchange = vi
      .spyOn(cfg, "exchangeCode")
      .mockResolvedValue({ sub: "alice", login: "alice" });
    const callback = await handleAuthCallback(
      new Request(`${origin}/api/auth/callback?code=test-code&state=${state}`, {
        headers: {
          cookie: `lingolearn_oauth_state=${state}; lingolearn_oauth_next=%2Fielts`,
        },
      }),
    );
    expect(callback.status).toBe(302);
    expect(callback.headers.get("location")).toBe("/ielts");
    const token = callback.headers
      .getSetCookie()
      .find((c) => c.startsWith("lingolearn_session="))!
      .split(";")[0]
      .split("=")[1];
    expect(
      (await cfg.verifySessionClaims(decodeURIComponent(token)))?.sub,
    ).toBe("alice");
    exchange.mockRestore();
  });
  it("rejects wrong OAuth state and sanitizes external redirects", async () => {
    expect(
      (
        await handleAuthCallback(
          new Request(`${origin}/api/auth/callback?code=test&state=wrong`),
        )
      ).status,
    ).toBe(400);
    for (const next of [
      "//outside.example",
      "/\\outside.example",
      "/\n/outside.example",
    ]) {
      const login = await handleAuthLogin(
        new Request(
          `${origin}/api/auth/login?next=${encodeURIComponent(next)}`,
        ),
      );
      expect(
        login.headers
          .getSetCookie()
          .find((c) => c.startsWith("lingolearn_oauth_next=")),
      ).toContain("lingolearn_oauth_next=%2F;");
    }
  });
});
