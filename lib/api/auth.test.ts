import { beforeEach, expect, it, vi } from "vitest";

const config = vi.hoisted(() => ({ configured: true, sso: null as any }));
vi.mock("@/lib/auth/config", () => ({
  getSsoConfig: () => config.sso,
  isAuthConfigured: () => config.configured,
  SESSION_COOKIE: "lingolearn_session",
  OAUTH_STATE_COOKIE: "lingolearn_oauth_state",
  OAUTH_NEXT_COOKIE: "lingolearn_oauth_next",
}));
vi.mock("@/lib/auth/request", () => ({
  getAuthUser: async () => ({ sub: "account-a", login: "alice" }),
}));
import { handleAuthCallback, handleAuthLogin, handleAuthLogout, handleAuthMe } from "./auth";

beforeEach(() => {
  config.configured = true;
  config.sso = {
    authorizeUrl: () => ({ url: "https://auth.example/authorize", state: "random-state" }),
    exchangeCode: vi.fn().mockRejectedValue(new Error("provider unavailable")),
  };
});

it("prevents caches from retaining identity, login redirects, logout and callback errors", async () => {
  const responses = [
    await handleAuthMe(new Request("https://app.example/api/auth/me")),
    await handleAuthLogin(new Request("https://app.example/api/auth/login")),
    await handleAuthLogout(),
    await handleAuthCallback(new Request("https://app.example/api/auth/callback?code=x&state=wrong")),
  ];
  expect(responses.map(r => r.status)).toEqual([200, 302, 200, 400]);
  for (const response of responses) {
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Vary")).toBe("Cookie");
  }
});

it("rejects invalid OAuth state before contacting the provider", async () => {
  const response = await handleAuthCallback(new Request("https://app.example/api/auth/callback?code=x&state=wrong", {
    headers: { Cookie: "lingolearn_oauth_state=expected" },
  }));
  expect(response.status).toBe(400);
  expect(config.sso.exchangeCode).not.toHaveBeenCalled();
});

it("returns an uncached controlled failure when the identity provider fails", async () => {
  const response = await handleAuthCallback(new Request("https://app.example/api/auth/callback?code=x&state=expected", {
    headers: { Cookie: "lingolearn_oauth_state=expected" },
  }));
  expect(response.status).toBe(502);
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  expect(await response.text()).not.toContain("provider unavailable");
});

it.each(["//evil.example", "/\\evil.example", "/\u0001evil"])("rejects an unsafe return path %j", async next => {
  const response = await handleAuthLogin(new Request(`https://app.example/api/auth/login?next=${encodeURIComponent(next)}`));
  expect(response.headers.get("Set-Cookie")).toContain("lingolearn_oauth_next=%2F;");
});
