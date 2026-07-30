// session.ts — who *you* are, stored only in this browser.
//
// Identity used to live in the shared nation document, which meant the server had
// one global "me" and every visitor downloaded everyone's keys. Now the private
// half of your citizenship never leaves this device: the nation only ever sees
// your address, your public key, and signatures it can check.
//
// Losing this record is losing the citizenship, which is the honest trade for
// actually owning it. `exportSession` is the backup.

import type { PrivateKeyJwk } from "./crypto";

const KEY = "memeostan:session:v1";

export interface Session {
  address: string;
  /** Present for citizens claimed after signed actions shipped. */
  privateKey?: PrivateKeyJwk;
  /** Legacy random-hex key, upgraded to a real keypair on first load. */
  legacySecret?: string;
}

const hasWindow = typeof window !== "undefined";

let cached: Session | null | undefined;

export function getSession(): Session | null {
  if (!hasWindow) return null;
  if (cached !== undefined) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    cached = raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export function setSession(session: Session): void {
  cached = session;
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(session));
  } catch (err) {
    console.error("Could not save your citizenship to this browser:", err);
  }
}

export function clearSession(): void {
  cached = null;
  if (!hasWindow) return;
  window.localStorage.removeItem(KEY);
}

export function myAddress(): string | null {
  return getSession()?.address ?? null;
}

/**
 * Bridge for citizens who existed before this file did. Their identity lived in
 * the shared nation document (`state.me`) and their key was stored alongside it;
 * both were cached in this browser. Lift them out of that cache into a real local
 * session so the citizenship survives, then `upgradeLegacyKeyIfNeeded` swaps the
 * old secret for a proper keypair.
 */
export function adoptLegacySession(): Session | null {
  if (!hasWindow || getSession()) return null;
  try {
    const raw = window.localStorage.getItem("memeostan:v1");
    if (!raw) return null;
    const legacy = JSON.parse(raw) as {
      me?: string | null;
      citizens?: Record<string, { secret?: string }>;
    };
    const address = legacy.me;
    if (!address) return null;
    const secret = legacy.citizens?.[address]?.secret;
    if (!secret) return null;

    const session: Session = { address, legacySecret: secret };
    setSession(session);
    console.info("[memeostan] recovered your citizenship from this browser's old state");
    return session;
  } catch {
    return null;
  }
}

/** Backup blob — enough to restore citizenship in another browser. */
export function exportSession(): string | null {
  const session = getSession();
  return session ? JSON.stringify(session) : null;
}

export function importSession(blob: string): Session | null {
  try {
    const parsed = JSON.parse(blob.trim()) as Session;
    if (!parsed.address) return null;
    if (!parsed.privateKey && !parsed.legacySecret) return null;
    setSession(parsed);
    return parsed;
  } catch {
    return null;
  }
}
