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
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { getSsoConfig } from "@/lib/auth/config";
import { createPractice, finishPracticeSection } from "@/lib/exams/session";
import { examHandlers } from "./exams";
let directory = "",
  alice = "",
  bob = "",
  expired = "";
const origin = "http://localhost:31971";
function request(
  method: string,
  body?: unknown,
  token = alice,
  query = "",
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/api/exams/hsk/attempts${query}`, {
    method,
    headers: {
      cookie: `lingolearn_session=${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
const hsk = examHandlers("hsk")!,
  topik = examHandlers("topik")!;
beforeAll(async () => {
  vi.stubEnv("W_ID_CLIENT_ID", "ielts-local-test");
  vi.stubEnv("W_ID_CLIENT_SECRET", "test-only-client-secret");
  vi.stubEnv(
    "JWT_SECRET",
    "test-only-jwt-secret-at-least-thirty-two-characters",
  );
  vi.stubEnv("W_ID_REDIRECT_URI", `${origin}/api/auth/callback`);
  const config = getSsoConfig()!,
    exp = Math.floor(Date.now() / 1000) + 3600;
  alice = await config.signSessionClaims({ sub: "alice", login: "alice", exp });
  bob = await config.signSessionClaims({ sub: "bob", is_admin: true, exp });
  expired = await config.signSessionClaims({ sub: "alice", exp: 1 });
});
beforeEach(() => {
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "englearn-language-api-"));
  vi.stubEnv("ENGLEARN_DATA_DIR", directory);
});
afterAll(() => {
  fs.rmSync(directory, { recursive: true, force: true });
  vi.unstubAllEnvs();
});
const session = () =>
  createPractice("hsk-3-01-v1", "all", Date.now(), "practice");
async function post(
  s = session(),
  revision: number | null = null,
  token = alice,
) {
  return hsk.POST(
    request("POST", { session: s, revision, userId: "bob" }, token),
  );
}

describe("Family and user scoped practice records", () => {
  it("requires valid W-ID cookies and rejects unknown exam families", async () => {
    for (const token of ["", expired, alice + "forged"])
      expect((await hsk.GET(request("GET", undefined, token))).status).toBe(
        401,
      );
    expect(examHandlers("ielts")).toBeNull();
  });
  it("persists owner-scoped records at mode 0600 without trusting client owners or scores", async () => {
    const s = { ...session(), answers: { l1: "C" }, flags: ["l1"] };
    expect((await post(s)).status).toBe(200);
    const response = await hsk.GET(
      request("GET", undefined, alice, "?id=practice"),
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect((await response.json()).attempt.session).toEqual(s);
    expect(
      (await hsk.GET(request("GET", undefined, bob, "?id=practice"))).status,
    ).toBe(404);
    const file = path.join(
      directory,
      "language-exam-attempts",
      createHash("sha256").update("alice").digest("hex"),
      "practice.json",
    );
    expect(fs.statSync(file).mode & 0o777).toBe(0o600);
  });
  it("does not mix TOPIK and HSK history or accept a paper under the wrong family", async () => {
    await post();
    expect((await (await topik.GET(request("GET"))).json()).total).toBe(0);
    expect(
      (await topik.GET(request("GET", undefined, alice, "?id=practice")))
        .status,
    ).toBe(404);
    expect(
      (
        await topik.POST(
          request("POST", { session: session(), revision: null }),
        )
      ).status,
    ).toBe(400);
  });
  it("handles idempotent retries and stale device conflicts without losing the winning answer", async () => {
    const s = session();
    await post(s);
    expect((await (await post(s)).json()).attempt.revision).toBe(1);
    const results = await Promise.all([
      post({ ...s, answers: { l1: "A" } }, 1),
      post({ ...s, answers: { l1: "B" } }, 1),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = await results.find((r) => r.status === 200)!.json();
    expect(
      (
        await (
          await hsk.GET(request("GET", undefined, alice, "?id=practice"))
        ).json()
      ).attempt.session.answers.l1,
    ).toBe(winner.attempt.session.answers.l1);
  });
  it("locks submitted sections, prevents clock extensions and preserves finished records", async () => {
    const s = session();
    await post(s);
    const next = finishPracticeSection(
      { ...s, answers: { l1: "C" } },
      Date.now(),
    );
    expect((await post(next, 1)).status).toBe(200);
    expect((await post({ ...next, answers: { l1: "B" } }, 2)).status).toBe(409);
    const extended = await post(
      { ...next, deadline: next.deadline + 60000 },
      2,
    );
    expect((await extended.json()).attempt.session.deadline).toBe(
      next.deadline,
    );
    const writing = finishPracticeSection(next, Date.now());
    expect((await post(writing, 3)).status).toBe(200);
    const finished = finishPracticeSection(writing, Date.now());
    expect((await post(finished, 4)).status).toBe(200);
    expect((await post({ ...finished, answers: { l1: "A" } }, 5)).status).toBe(
      409,
    );
  });
  it("saves multiple sections completed between cloud writes", async () => {
    const initial = session();
    expect((await post(initial)).status).toBe(200);
    const reading = finishPracticeSection(
      { ...initial, answers: { l1: "C" } },
      Date.now(),
    );
    const writing = finishPracticeSection(
      { ...reading, answers: { ...reading.answers, r1: "A" } },
      Date.now(),
    );
    const completed = finishPracticeSection(writing, Date.now());
    const response = await post(completed, 1);
    expect(response.status).toBe(200);
    const saved = (await response.json()).attempt;
    expect(saved.session).toEqual(completed);
    expect(saved.revision).toBe(2);
    expect(
      (await post({ ...completed, answers: { l1: "B" } }, 2)).status,
    ).toBe(409);
  });
  it("rejects cross-origin writes, oversized bodies and invalid timing", async () => {
    const body = { session: session(), revision: null };
    expect(
      (
        await hsk.POST(
          request("POST", body, alice, "", { origin: "https://other.example" }),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await hsk.POST(
          request("POST", { ...body, padding: "x".repeat(513000) }),
        )
      ).status,
    ).toBe(413);
    expect(
      (await post({ ...session(), startedAt: Date.now() + 60000 })).status,
    ).toBe(400);
    expect(
      (await post({ ...session(), deadline: Date.now() + 10 * 60 * 60000 }))
        .status,
    ).toBe(400);
  });
  it("keeps earlier attempts when creating another level and clamps history pagination", async () => {
    await post();
    await post(createPractice("hsk-5-01-v1", "writing", Date.now(), "second"));
    const result = await (
      await hsk.GET(
        request(
          "GET",
          undefined,
          alice,
          "?page=999&pageSize=1&draftId=practice",
        ),
      )
    ).json();
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.draft.session.id).toBe("practice");
  });
});

describe("JLPT account integration", () => {
  const jlpt = examHandlers("jlpt")!;
  it("persists the new modes and isolates JLPT records from other families and accounts", async () => {
    const s = createPractice("jlpt-n5-01-v1", "vocabulary", Date.now(), "jp");
    s.answers.v1 = "A";
    expect(
      (await jlpt.POST(request("POST", { session: s, revision: null }))).status,
    ).toBe(200);
    const own = await jlpt.GET(request("GET", undefined, alice, "?id=jp"));
    expect((await own.json()).attempt.session.answers.v1).toBe("A");
    expect(
      (await jlpt.GET(request("GET", undefined, bob, "?id=jp"))).status,
    ).toBe(404);
    expect(
      (await hsk.GET(request("GET", undefined, alice, "?id=jp"))).status,
    ).toBe(404);
    expect((await (await topik.GET(request("GET"))).json()).total).toBe(0);
    expect(
      (await hsk.POST(request("POST", { session: s, revision: null }))).status,
    ).toBe(400);
  });
  it("locks submitted vocabulary answers and prevents clock resets when moving to grammar/reading", async () => {
    const s = createPractice("jlpt-n5-01-v1", "all", Date.now(), "jp");
    s.answers.v1 = "B";
    await jlpt.POST(request("POST", { session: s, revision: null }));
    const next = finishPracticeSection(s, Date.now());
    expect(
      (await jlpt.POST(request("POST", { session: next, revision: 1 }))).status,
    ).toBe(200);
    expect(
      (
        await jlpt.POST(
          request("POST", {
            session: { ...next, answers: { v1: "A" } },
            revision: 2,
          }),
        )
      ).status,
    ).toBe(409);
    const extended = await jlpt.POST(
      request("POST", {
        session: { ...next, deadline: next.deadline + 30000 },
        revision: 2,
      }),
    );
    expect((await extended.json()).attempt.session.deadline).toBe(
      next.deadline,
    );
  });
});
