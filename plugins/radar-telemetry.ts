import { randomBytes } from "node:crypto";
import {
  buildErrorPayload,
  buildSpanBatchPayload,
  configFromEnv,
  startSpan,
  traceparent,
  type Span,
  type SpanBatchItem,
  type XRadarConfig,
} from "@w/xradar";
import type { NitroAppPlugin } from "nitro/types";

type RuntimeEvent = SpanBatchItem;
type CaptureEvent = Record<string, unknown>;

type EventLike = {
  req: { method?: string; url?: string; headers?: { get(name: string): string | null } };
  context?: Record<string, unknown>;
};

type Pending = { kind: "runtime"; event: RuntimeEvent } | { kind: "error"; event: CaptureEvent };
type SpanState = { span: Span; route: string; method: string; startedAt: number; errorCaptured: boolean };

const MAX_QUEUE = 200;
const BATCH_SIZE = 20;
const INGEST_TIMEOUT_MS = 1_500;
const SERVER_VISITOR_ID = "lingolearn-server";
const BUILD_RELEASE = import.meta.env.VITE_ENGLEARN_RELEASE ?? "development";
const PAGES = new Set(["/", "/learn", "/exams", "/ielts", "/hsk", "/jlpt", "/topik", "/vocabulary", "/history", "/guide", "/results", "/test"]);

function hex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function safeRoute(pathname: string): string | null {
  if (pathname === "/api") return "/api";
  if (!pathname.startsWith("/api/")) return PAGES.has(pathname) ? pathname : null;
  if (/^\/api\/exams\/(ielts|topik|hsk|jlpt)\/attempts$/.test(pathname)) return "/api/exams/:family/attempts";
  if (/^\/api\/(learning|vocabulary|ielts|exams|library)\/(audio|attempts|book|feedback|journal|plan)$/.test(pathname)) {
    return pathname;
  }
  if (/^\/api\/session\/(claim)$/.test(pathname)) return "/api/session/:action";
  if (/^\/api\/(auth)\/(login|logout|me|callback)$/.test(pathname)) return pathname;
  if (/^\/api\/(health|history|item|progress|respond|result|score|session)$/.test(pathname)) return pathname;
  return "/api/other";
}

function routeFor(event: EventLike): string | null {
  try {
    return safeRoute(new URL(event.req.url || "/", "http://localhost").pathname);
  } catch {
    return null;
  }
}

function parentFromTraceparent(value: unknown): { traceId: string; spanId: string } | null {
  if (typeof value !== "string") return null;
  const match = /^00-([0-9a-f]{32})-([0-9a-f]{16})-[0-9a-f]{2}$/i.exec(value);
  if (!match || /^0+$/.test(match[1]) || /^0+$/.test(match[2])) return null;
  return { traceId: match[1].toLowerCase(), spanId: match[2].toLowerCase() };
}

function errorType(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : "Error";
}

export function createRadarTelemetry(options: {
  code: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  makeId?: (bytes: number) => string;
  schedule?: (task: () => void) => void;
  release?: string;
  environment?: string;
}) {
  const environment = options.environment ?? process.env.APP_ENV ?? process.env.ENVIRONMENT ?? process.env.NODE_ENV ?? "production";
  const config: XRadarConfig = configFromEnv({
    ...process.env,
    W_RADAR_CODE: options.code,
    ...(options.endpoint ? { W_RADAR_ENDPOINT: options.endpoint } : {}),
    SERVICE_NAME: "lingolearn",
    APP_RELEASE: options.release ?? BUILD_RELEASE,
    APP_ENV: environment,
    XRADAR_CLIENT_KIND: "server",
    XRADAR_RUNTIME: "nodejs",
    XRADAR_PLATFORM: "server",
  });
  const code = config.code ?? "";
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const makeId = options.makeId ?? hex;
  const schedule = options.schedule ?? queueMicrotask;
  const states = new WeakMap<object, SpanState>();
  const queue: Pending[] = [];
  let flushing = false;

  const queueEvent = (pending: Pending) => {
    if (!code || queue.length >= MAX_QUEUE) return;
    queue.push(pending);
    schedule(() => void flush());
  };

  async function post(path: string, body: unknown): Promise<void> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetchImpl(`${config.endpoint}${path}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(INGEST_TIMEOUT_MS),
        });
        if (response.ok) return;
      } catch {
        // Telemetry is best effort; the bounded retry below must not affect requests.
      }
    }
  }

  async function flush(): Promise<void> {
    if (flushing || queue.length === 0 || !code) return;
    flushing = true;
    try {
      while (queue.length) {
        const kind = queue[0].kind;
        const batch: Pending[] = [];
        while (queue.length && queue[0].kind === kind && batch.length < BATCH_SIZE) batch.push(queue.shift()!);
        if (kind === "runtime") {
          const payload = buildSpanBatchPayload(config, batch.map((item) => (item as Extract<Pending, { kind: "runtime" }>).event));
          await post("/collect", {
            ...payload,
            platform_project_id: "lingolearn",
            platform_workspace_id: "ws_platform",
          });
        } else {
          for (const item of batch) await post("/errors/capture", (item as Extract<Pending, { kind: "error" }>).event);
        }
      }
    } finally {
      flushing = false;
      if (queue.length) schedule(() => void flush());
    }
  }

  function capture(state: SpanState, error: unknown, handled: boolean, severity: "warning" | "error" | "fatal", status?: number) {
    if (state.errorCaptured) return;
    state.errorCaptured = true;
    const safeError = new Error(`Server request ${state.method} ${state.route} failed${status ? ` with status ${status}` : ""}`);
    safeError.name = errorType(error);
    safeError.stack = undefined;
    const event = buildErrorPayload(config, safeError, {
      exceptionType: errorType(error),
      handled,
      severity,
      stack: null,
      url: null,
      context: {
        service: "lingolearn",
        route: state.route,
        method: state.method,
        trace_id: state.span.traceId,
        span_id: state.span.spanId,
        ...(state.span.parentSpanId ? { parent_span_id: state.span.parentSpanId } : {}),
        ...(status ? { status_code: status } : {}),
      },
    });
    event.visitor_id = SERVER_VISITOR_ID;
    event.session_id = SERVER_VISITOR_ID;
    event.platform_project_id = "lingolearn";
    event.platform_workspace_id = "ws_platform";
    queueEvent({
      kind: "error",
      event,
    });
  }

  return {
    flush,
    queued: () => queue.length,
    hooks: {
      request(event: EventLike) {
        const route = routeFor(event);
        if (!route) return;
        const method = (event.req.method || "GET").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10) || "GET";
        const parent = parentFromTraceparent(event.req.headers?.get("traceparent"));
        const startedAt = now();
        const state: SpanState = {
          span: startSpan(`http.server ${method} ${route}`, {
            traceId: parent?.traceId ?? makeId(16),
            spanId: makeId(8),
            parentSpanId: parent?.spanId ?? null,
            spanKind: "server",
            startTimeMs: startedAt,
          }),
          route,
          method,
          startedAt,
          errorCaptured: false,
        };
        states.set(event as object, state);
      },
      response(response: Response, event: EventLike) {
        const state = states.get(event as object);
        if (!state) return;
        const endedAt = now();
        const status = response.status;
        const durationMs = Math.max(0, endedAt - state.startedAt);
        state.span.durationMs = durationMs;
        const responseTraceparent = traceparent(state.span);
        try {
          response.headers.set("traceparent", responseTraceparent);
        } catch {
          // Some adapters expose immutable Response headers; span ingestion still works.
        }
        queueEvent({
          kind: "runtime",
          event: {
            span: state.span,
            status: status >= 500 ? "error" : "ok",
            data: {
              "http.method": state.method,
              "http.route": state.route,
              "http.status_code": status,
              start_time_ms: state.startedAt,
            },
          },
        });
        if (status >= 500) capture(state, (event.context as { error?: unknown } | undefined)?.error, true, "error", status);
      },
      error(error: Error, context: { event?: EventLike }) {
        const event = context.event;
        if (!event) return;
        const state = states.get(event as object);
        if (state) capture(state, error, false, "fatal");
      },
    },
  };
}

const radarPlugin: NitroAppPlugin = (nitro) => {
  const code = process.env.W_RADAR_CODE ?? "";
  if (!code) return;
  const telemetry = createRadarTelemetry({ code, release: BUILD_RELEASE });
  nitro.hooks.hook("request", telemetry.hooks.request);
  nitro.hooks.hook("response", telemetry.hooks.response);
  nitro.hooks.hook("error", telemetry.hooks.error);
};

export default radarPlugin;
