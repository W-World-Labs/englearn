import { username, type SsoUser } from "@w-id/sdk";
import {
  getSsoConfig,
  isAuthConfigured,
  OAUTH_NEXT_COOKIE,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
} from "@/lib/auth/config";
import { buildSetCookie, clearCookie, parseCookies } from "@/lib/auth/cookies";
import { getAuthUser } from "@/lib/auth/request";

// Auth redirects and identity responses must never be reused by shared caches.
function privateResponse(response: Response): Response {
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

function safeNextPath(raw: string | undefined): string {
  if (
    !raw ||
    !raw.startsWith("/") ||
    raw.startsWith("//") ||
    /[\\\x00-\x1f\x7f]/.test(raw)
  )
    return "/";
  return raw;
}

/**
 * GET /api/auth/login?next=/
 */
async function handleAuthLoginResponse(req: Request) {
  const cfg = getSsoConfig();
  if (!cfg) {
    return Response.json(
      { error: "W-ID auth is not configured on this server" },
      { status: 503 },
    );
  }

  const next = safeNextPath(new URL(req.url).searchParams.get("next") ?? "/");
  const { url, state } = cfg.authorizeUrl();

  const headers = new Headers({ Location: url });
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_STATE_COOKIE, state, {
      maxAge: 600,
      httpOnly: true,
      sameSite: "Lax",
    }),
  );
  headers.append(
    "Set-Cookie",
    buildSetCookie(OAUTH_NEXT_COOKIE, next, {
      maxAge: 600,
      httpOnly: true,
      sameSite: "Lax",
    }),
  );

  return new Response(null, { status: 302, headers });
}

/**
 * GET /api/auth/callback?code=&state=
 */
async function handleAuthCallbackResponse(req: Request) {
  const cfg = getSsoConfig();
  if (!cfg) {
    return new Response("Auth not configured", { status: 503 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return new Response(`Login failed: ${err}`, { status: 400 });
  }
  if (!code || !state) {
    return new Response("Missing code or state", { status: 400 });
  }

  const cookies = parseCookies(req);
  if (cookies[OAUTH_STATE_COOKIE] !== state) {
    return new Response("Invalid OAuth state", { status: 400 });
  }

  let user: SsoUser;
  try {
    user = await cfg.exchangeCode(code);
  } catch {
    return new Response(
      "W-ID login is temporarily unavailable. Please try again.",
      { status: 502 },
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const token = await cfg.signSessionClaims({
    sub: user.sub,
    login: username(user),
    email: user.email,
    name: user.name,
    picture: user.picture,
    is_admin: user.is_platform_admin,
    exp: now + cfg.sessionDays * 24 * 60 * 60,
  });

  const next = safeNextPath(cookies[OAUTH_NEXT_COOKIE]);
  const headers = new Headers({ Location: next });
  headers.append(
    "Set-Cookie",
    buildSetCookie(SESSION_COOKIE, token, {
      maxAge: cfg.sessionDays * 24 * 60 * 60,
      httpOnly: true,
      sameSite: "Lax",
    }),
  );
  headers.append("Set-Cookie", clearCookie(OAUTH_STATE_COOKIE));
  headers.append("Set-Cookie", clearCookie(OAUTH_NEXT_COOKIE));

  return new Response(null, { status: 302, headers });
}

/** POST /api/auth/logout */
async function handleAuthLogoutResponse() {
  const headers = new Headers({ "Content-Type": "application/json" });
  headers.append("Set-Cookie", clearCookie(SESSION_COOKIE));
  return Response.json({ ok: true }, { headers });
}

/** GET /api/auth/me */
async function handleAuthMeResponse(req: Request) {
  if (!isAuthConfigured()) {
    return Response.json({ configured: false, user: null });
  }
  const user = await getAuthUser(req);
  return Response.json({
    configured: true,
    user: user
      ? {
          sub: user.sub,
          login: user.login,
          email: user.email,
          name: user.name,
          picture: user.picture,
        }
      : null,
  });
}

export async function handleAuthLogin(req: Request) {
  return privateResponse(await handleAuthLoginResponse(req));
}

export async function handleAuthCallback(req: Request) {
  return privateResponse(await handleAuthCallbackResponse(req));
}

export async function handleAuthLogout() {
  return privateResponse(await handleAuthLogoutResponse());
}

export async function handleAuthMe(req: Request) {
  return privateResponse(await handleAuthMeResponse(req));
}
