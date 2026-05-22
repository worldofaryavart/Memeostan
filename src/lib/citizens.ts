// citizens.ts — the citizen registry, keyed by wallet address.

import { db } from "./db";
import { ledger } from "./ledger";
import { createKeypair } from "./wallet";
import { RATES } from "./economy";
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

export function me(): Citizen | null {
  const s = db.get();
  return s.me ? s.citizens[s.me] || null : null;
}

interface NewCitizen {
  username: string;
  faction: string;
  pfp?: string;
}

// Register a brand-new human citizen: mints a wallet, files the passport,
// grants the welcome MMC, and signs them in.
export function registerCitizen({ username, faction, pfp }: NewCitizen): Citizen {
  const { address, secret } = createKeypair();
  const citizen: Citizen = {
    address,
    secret,
    username,
    faction,
    pfp: pfp || "🫠",
    aura: 1000,
    isAI: false,
    joinedAt: Date.now(),
  };
  db.update((s) => {
    s.citizens[address] = citizen;
    s.balances[address] = 0;
    s.me = address;
  });
  ledger.mint(address, RATES.WELCOME_GRANT, "welcome grant — citizenship issued");
  return citizen;
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

export function signOut(): void {
  db.update((s) => {
    s.me = null;
  });
}

export function exportWallet(address: string): string | null {
  const c = getCitizen(address);
  if (!c || !c.secret) return null;
  return JSON.stringify({
    address: c.address,
    secret: c.secret,
    username: c.username,
    faction: c.faction,
    pfp: c.pfp,
    aura: c.aura,
    joinedAt: c.joinedAt,
  });
}

export function importWallet(backupJson: string): Citizen | null {
  try {
    const data = JSON.parse(backupJson.trim());
    if (!data.address || !data.secret || !data.username || !data.faction) {
      return null;
    }
    const citizen: Citizen = {
      address: data.address,
      secret: data.secret,
      username: data.username,
      faction: data.faction,
      pfp: data.pfp || "🫠",
      aura: data.aura || 1000,
      isAI: false,
      joinedAt: data.joinedAt || Date.now(),
    };
    db.update((s) => {
      s.citizens[data.address] = citizen;
      s.me = data.address;
      if (s.balances[data.address] == null) {
        s.balances[data.address] = 250; // default grant
      }
    });
    return citizen;
  } catch {
    return null;
  }
}

