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

// Ensure an AI candidate exists in the registry (idempotent).
export function ensureAICitizen(candidate: Citizen): void {
  if (getCitizen(candidate.address)) return;
  db.update((s) => {
    s.citizens[candidate.address] = {
      ...candidate,
      aura: 1000 + Math.floor(Math.random() * 500),
      joinedAt: Date.now(),
    };
    if (s.balances[candidate.address] == null) s.balances[candidate.address] = 0;
  });
  ledger.mint(candidate.address, 1000, "AI campaign treasury");
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

