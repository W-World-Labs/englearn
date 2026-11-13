const CLAIM_PREFIX = "englearn:claim:";

/** 256-bit random secret held only in this browser's localStorage. */
export function newClaimSecret(): string | null {
  if (typeof crypto === "undefined" || !crypto.getRandomValues) return null;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return [...new Uint8Array(digest)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export function setStoredClaimSecret(
  sessionId: string,
  secret: string
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CLAIM_PREFIX + sessionId, secret);
  } catch {
    /* quota / private mode */
  }
}

export function getStoredClaimSecret(sessionId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CLAIM_PREFIX + sessionId);
  } catch {
    return null;
  }
}
