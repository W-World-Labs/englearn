import { describe, expect, it } from "vitest";
import { createRadarTelemetry } from "./radar-telemetry";

// Mirrors Radar's CaptureErrorRequest in /home/w/projects/00-16-w-radar/src/models.rs.
type RadarCaptureErrorRequest = {
  code: string;
  message: string;
  session_id?: string;
  visitor_id?: string;
  context: Record<string, string | number | boolean>;
  release: string;
  environment: string;
};

function request(url: string, method = "GET", traceparent?: string) {
  return {
    req: {
      method,
      url,
      headers: { get: (name: string) => name === "traceparent" ? traceparent ?? null : null },
    },
    context: {},
  };
}

describe("Radar backend telemetry", () => {
  it("records actual response duration and preserves valid trace parent IDs without URL data", async () => {
    let time = 100;
    const sent: Array<{ url: string; body: Record<string, any>; signal?: AbortSignal }> = [];
    const telemetry = createRadarTelemetry({
      code: "tracking-code",
      endpoint: "https://radar.example/",
      release: "release-abc123",
      environment: "production",
      now: () => time,
      makeId: (bytes) => bytes === 16 ? "a".repeat(32) : "b".repeat(16),
      schedule: () => {},
      fetchImpl: async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(String(init?.body)), signal: init?.signal as AbortSignal });
        return new Response(null, { status: 200 });
      },
    });
    const event = request("/api/learning/journal?userId=private-person", "POST", `00-${"c".repeat(32)}-${"d".repeat(16)}-01`);
    telemetry.hooks.request(event);
    time = 142;
    const response = new Response(null, { status: 201 });
    telemetry.hooks.response(response, event);
    await telemetry.flush();

    expect(sent).toHaveLength(1);
    expect(sent[0].url).toBe("https://radar.example/collect");
    expect(sent[0].body).toMatchObject({
      code: "tracking-code",
      session_id: `trace_${"c".repeat(32)}`,
      visitor_id: "service:lingolearn",
    });
    expect(sent[0].body.events).toHaveLength(1);
    const span = sent[0].body.events[0];
    expect(typeof span.ts).toBe("number");
    expect(span).toMatchObject({
      type: "performance_span",
      name: "http.server POST /api/learning/journal",
      url: "/api/learning/journal",
      data: {
        trace_id: "c".repeat(32),
        span_id: "b".repeat(16),
        parent_span_id: "d".repeat(16),
        duration_ms: 42,
        "http.status_code": 201,
        release: "release-abc123",
        environment: "production",
      },
    });
    expect(response.headers.get("traceparent")).toBe(`00-${"c".repeat(32)}-${"b".repeat(16)}-01`);
    expect(sent[0].body.session_info).toMatchObject({ client_version: "release-abc123" });
    expect(JSON.stringify(sent[0].body)).not.toContain("private-person");
    expect(JSON.stringify(sent[0].body)).not.toContain("userId");
    expect(sent[0].signal?.aborted).toBe(false);
  });

  it("captures a failed request once with graded handled status and sanitized exception details", async () => {
    const sent: Array<{ url: string; body: Record<string, any> }> = [];
    const telemetry = createRadarTelemetry({
      code: "tracking-code",
      release: "release-abc123",
      environment: "production",
      makeId: (bytes) => bytes === 16 ? "a".repeat(32) : "b".repeat(16),
      schedule: () => {},
      fetchImpl: async (url, init) => {
        sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response(null, { status: 200 });
      },
    });
    const event = request(
      "/api/exams/student-secret/attempts?token=private",
      "POST",
      `00-${"c".repeat(32)}-${"d".repeat(16)}-01`,
    );
    telemetry.hooks.request(event);
    telemetry.hooks.error(new Error("customer answer and token=private"), { event });
    const response = new Response(null, { status: 500 });
    telemetry.hooks.response(response, event);
    await telemetry.flush();

    expect(sent).toHaveLength(2);
    const capture = sent.find((item) => item.url.endsWith("/errors/capture"));
    expect(capture).toBeDefined();
    const dto = capture!.body as RadarCaptureErrorRequest;
    // Radar CaptureErrorRequest source DTO: code and message are required;
    // identity/context fields are optional. The stable service visitor is included.
    expect(typeof dto.code).toBe("string");
    expect(typeof dto.message).toBe("string");
    expect(dto).toMatchObject({
      code: "tracking-code",
      session_id: "lingolearn-server",
      visitor_id: "lingolearn-server",
      release: "release-abc123",
      environment: "production",
      handled: false,
      severity: "fatal",
      exception_type: "Error",
      message: "Server request POST /api/other failed",
      stack: null,
      context: {
        route: "/api/other",
        method: "POST",
        trace_id: "c".repeat(32),
        span_id: "b".repeat(16),
        parent_span_id: "d".repeat(16),
      },
      url: null,
    });
    expect(JSON.stringify(sent)).not.toContain("customer answer");
    expect(JSON.stringify(sent)).not.toContain("student-secret");
    expect(JSON.stringify(sent)).not.toContain("private");
    expect(response.headers.get("traceparent")).toBe(`00-${"c".repeat(32)}-${"b".repeat(16)}-01`);
  });

  it("bounds the queue and retries failed ingestion once without throwing into the request path", async () => {
    let calls = 0;
    const telemetry = createRadarTelemetry({
      code: "tracking-code",
      schedule: () => {},
      makeId: (bytes) => (bytes === 16 ? "a" : "b").repeat(bytes * 2),
      fetchImpl: async () => new Response(null, { status: 503 }),
    });
    for (let index = 0; index < 210; index++) {
      const event = request("/api/health");
      telemetry.hooks.request(event);
      telemetry.hooks.response(new Response(null, { status: 200 }), event);
    }
    expect(telemetry.queued()).toBe(200);
    await expect(telemetry.flush()).resolves.toBeUndefined();
    expect(telemetry.queued()).toBe(0);

    const failing = createRadarTelemetry({
      code: "tracking-code",
      schedule: () => {},
      fetchImpl: async () => {
        calls++;
        throw new Error("ingest unavailable");
      },
    });
    const event = request("/api/health");
    failing.hooks.request(event);
    failing.hooks.response(new Response(null, { status: 200 }), event);
    await expect(failing.flush()).resolves.toBeUndefined();
    expect(calls).toBe(2);
    expect(failing.queued()).toBe(0);
  });

  it("accepts the Radar capture request DTO and retries an HTTP rejection at most once", async () => {
    const sent: Array<{ url: string; body: Record<string, any> }> = [];
    let responseStatus = 400;
    let attempts = 0;
    const telemetry = createRadarTelemetry({
      code: "tracking-code",
      schedule: () => {},
      makeId: (bytes) => (bytes === 16 ? "a" : "b").repeat(bytes * 2),
      fetchImpl: async (url, init) => {
        attempts++;
        sent.push({ url: String(url), body: JSON.parse(String(init?.body)) });
        return new Response(null, { status: responseStatus });
      },
    });
    const event = request("/api/health");
    telemetry.hooks.request(event);
    telemetry.hooks.error(new Error("safe generic failure"), { event });
    await telemetry.flush();

    const capturePayload = sent[0].body as RadarCaptureErrorRequest;
    expect(sent[0].url).toBe("https://radar.myfastools.com/errors/capture");
    expect(capturePayload.code).toBe("tracking-code");
    expect(capturePayload.message).toContain("GET /api/health");
    expect(capturePayload.visitor_id).toBe("lingolearn-server");
    expect(capturePayload.context).toMatchObject({ trace_id: "a".repeat(32), span_id: "b".repeat(16) });
    expect(attempts).toBe(2);

    attempts = 0;
    const accepted = createRadarTelemetry({
      code: "tracking-code",
      schedule: () => {},
      fetchImpl: async () => {
        attempts++;
        return new Response(JSON.stringify({ accepted: true }), { status: 200 });
      },
    });
    const acceptedEvent = request("/api/health");
    accepted.hooks.request(acceptedEvent);
    accepted.hooks.error(new Error("safe generic failure"), { event: acceptedEvent });
    await accepted.flush();
    expect(attempts).toBe(1);
  });

  it("uses the configured Radar endpoint environment variable", async () => {
    const previousEndpoint = process.env.W_RADAR_ENDPOINT;
    const previousUrl = process.env.W_RADAR_URL;
    const sent: string[] = [];
    process.env.W_RADAR_ENDPOINT = "https://radar-configured.example/";
    process.env.W_RADAR_URL = "https://radar-legacy.example";
    try {
      const telemetry = createRadarTelemetry({
        code: "tracking-code",
        schedule: () => {},
        fetchImpl: async (url) => {
          sent.push(String(url));
          return new Response(null, { status: 200 });
        },
      });
      const event = request("/api/health");
      telemetry.hooks.request(event);
      telemetry.hooks.response(new Response(null, { status: 200 }), event);
      await telemetry.flush();

      process.env.W_RADAR_ENDPOINT = "";
      const fallback = createRadarTelemetry({
        code: "tracking-code",
        schedule: () => {},
        fetchImpl: async (url) => {
          sent.push(String(url));
          return new Response(null, { status: 200 });
        },
      });
      const fallbackEvent = request("/api/health");
      fallback.hooks.request(fallbackEvent);
      fallback.hooks.response(new Response(null, { status: 200 }), fallbackEvent);
      await fallback.flush();
    } finally {
      if (previousEndpoint === undefined) delete process.env.W_RADAR_ENDPOINT;
      else process.env.W_RADAR_ENDPOINT = previousEndpoint;
      if (previousUrl === undefined) delete process.env.W_RADAR_URL;
      else process.env.W_RADAR_URL = previousUrl;
    }
    expect(sent).toEqual([
      "https://radar-configured.example/collect",
      "https://radar-legacy.example/collect",
    ]);
  });
});
