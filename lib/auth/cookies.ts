export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.get("cookie") ?? "";
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      /* Ignore malformed cookies. */
    }
  }
  return out;
}

export function buildSetCookie(
  name: string,
  value: string,
  opts: {
    maxAge?: number;
    httpOnly?: boolean;
    path?: string;
    sameSite?: "Lax" | "Strict" | "None";
    secure?: boolean;
  } = {},
): string {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${opts.path ?? "/"}`,
  ];
  if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
  if (opts.httpOnly) parts.push("HttpOnly");
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  if (opts.secure ?? process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }
  return parts.join("; ");
}

export function clearCookie(name: string): string {
  return buildSetCookie(name, "", {
    maxAge: 0,
    httpOnly: true,
    sameSite: "Lax",
  });
}
