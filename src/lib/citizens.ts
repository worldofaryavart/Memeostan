// citizens.ts — the citizen registry, keyed by wallet address.
//
// These are state mutators: they run on the server inside an action, and on the
// client as the optimistic preview of that same action. Nothing here talks to the
// network. "Who am I" is not state — it lives in src/lib/session.ts.

import { db } from "./db";
import { ledger } from "./ledger";
import { RATES } from "./economy";
import { clearSession, exportSession, importSession, myAddress } from "./session";
import type { PublicKeyJwk } from "./crypto";
import type { Citizen } from "./types";

export const FACTIONS = [
  "Sigma",
  "NPC",
  "Rizzler",
  "Brainrot Veteran",
  "Meme Lord",
] as const;

export function getCitizen(address: string): Citizen | null {
  return db.get().citizens[address] || null;
}

export function citizensById(): Record<string, Citizen> {
  return db.get().citizens;
}

export function allCitizens(): Citizen[] {
  return Object.values(db.get().citizens);
}

/** The citizen this browser holds the key for, if they exist in the nation yet. */
export function me(): Citizen | null {
  const address = myAddress();
  return address ? db.get().citizens[address] || null : null;
}

export interface NewCitizen {
  address: string;
  pubKey: PublicKeyJwk;
  username: string;
  faction: string;
  pfp?: string;
  city?: string;
  party?: string;
}

/**
 * File a passport for an address that has already proved it holds the matching
 * key. The keypair itself is minted in the browser (src/lib/actionClient.ts) —
 * this only records the public half and pays the welcome grant.
 */
/** The next national ID. Numbers are never reused, so #1 means #1 forever. */
export function nextCitizenNumber(): number {
  const issued = Object.values(db.get().citizens)
    .map((c) => c.citizenNo ?? 0)
    .filter((n) => n > 0);
  return issued.length === 0 ? 1 : Math.max(...issued) + 1;
}

export function registerCitizen({
  address,
  pubKey,
  username,
  faction,
  pfp,
  city,
  party,
}: NewCitizen): Citizen {
  const citizen: Citizen = {
    address,
    pubKey,
    username,
    faction,
    pfp: pfp || "🫠",
    aura: 1000,
    isAI: false,
    joinedAt: Date.now(),
    citizenNo: nextCitizenNumber(),
    city: city || "Brainrot City",
    party: party || "Global Brainrot Party",
  };
  db.update((s) => {
    s.citizens[address] = citizen;
    if (s.balances[address] == null) s.balances[address] = 0;
    if (!s.founded) s.founded = Date.now();
  });
  ledger.mint(address, RATES.WELCOME_GRANT, "welcome grant — citizenship issued");
  return citizen;
}

/**
 * One-time migration for citizens minted before signed actions existed: swap the
 * shared-state `secret` for a real public key and destroy the secret. Authorised
 * by proving knowledge of that secret (see actions.ts).
 */
export function upgradeCitizenKey(address: string, pubKey: PublicKeyJwk): void {
  db.update((s) => {
    const citizen = s.citizens[address];
    if (!citizen) return;
    citizen.pubKey = pubKey;
    delete citizen.secret;
  });
}

/**
 * Ensure an organ of the state exists in the registry (idempotent).
 *
 * Note what this deliberately does *not* do: mint. The old version handed every
 * AI 1,000 MMC of "campaign treasury" on creation, because AI used to stand for
 * election. The civil service does not campaign, and printing money for it would
 * dilute the currency citizens actually earn. Endowments are set once, in
 * src/data/seed.ts, and are excluded from circulating supply.
 */
export function ensureStateAccount(organ: Citizen): void {
  if (getCitizen(organ.address)) return;
  db.update((s) => {
    s.citizens[organ.address] = { ...organ, joinedAt: Date.now() };
    if (s.balances[organ.address] == null) s.balances[organ.address] = 0;
  });
}

export function adjustAura(address: string, delta: number): void {
  db.update((s) => {
    const c = s.citizens[address];
    if (c) c.aura = Math.max(0, c.aura + delta);
  });
}

/** Signing out is purely local — it forgets the key, it doesn't renounce anything. */
export function signOut(): void {
  clearSession();
}

/**
 * Back up citizenship: the key material only. The passport, balance and history
 * stay on the server keyed by address, so a restore is just proving who you are
 * again — it can no longer conjure a citizen (or a 250 MMC grant) out of a file.
 */
export function exportWallet(): string | null {
  return exportSession();
}

export function importWallet(backupJson: string): Citizen | null {
  const session = importSession(backupJson);
  if (!session) return null;
  return getCitizen(session.address);
}

