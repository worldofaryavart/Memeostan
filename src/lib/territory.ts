// territory.ts — the engine behind Memeostan's border wars.
//
// Territories are stored as percentages (0–100) per city, always summing to 100.
// A citizen pays 25 MMC to launch a real skirmish; free simulations are also supported.
// Attack power = population × 10 + avgAura × 0.4 + random jitter (0–600).

import { db } from "./db";
import { ledger } from "./ledger";
import { ALL_CITIES } from "./cities";
import type { SkirmishResult } from "./types";

export const SKIRMISH_COST = 25; // MMC to launch a real skirmish
const MAX_LOG = 20;              // max entries kept in skirmishLog

const CITY_NAMES = ALL_CITIES.map((c) => c.name);

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeId(): string {
  return `skm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Returns current territory map, seeding defaults if missing. */
export function getTerritories(): Record<string, number> {
  const t = db.get().territories;
  if (!t) return { "Brainrot City": 25, "Neo Ohio": 25, "Rizzland": 25, "Napistan": 25 };
  return t;
}

/** City with the highest % right now. */
export function getDominantCity(): string {
  const t = getTerritories();
  return Object.entries(t).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Brainrot City";
}

/** Recent skirmishes, newest first. */
export function getSkirmishLog(n = 10): SkirmishResult[] {
  return (db.get().skirmishLog ?? []).slice(0, n);
}

// ── Combat maths ──────────────────────────────────────────────────────────────

function computePower(cityName: string): number {
  const state = db.get();
  const cityCitizens = Object.values(state.citizens).filter(
    (c) => c.city === cityName && !c.isAI
  );
  const pop = cityCitizens.length;
  const avgAura =
    pop > 0
      ? cityCitizens.reduce((s, c) => s + c.aura, 0) / pop
      : 1000;
  // Base power + per-citizen bonus + randomness
  return Math.round(pop * 10 + avgAura * 0.4 + Math.random() * 600);
}

function normalizeTerritories(t: Record<string, number>): void {
  // Clamp negatives to 0, then re-normalize to exactly 100
  for (const k of CITY_NAMES) t[k] = Math.max(0, t[k] ?? 0);
  const total = CITY_NAMES.reduce((s, k) => s + t[k], 0);
  if (total === 0) {
    CITY_NAMES.forEach((k, i) => (t[k] = i === 0 ? 100 : 0));
    return;
  }
  let sum = 0;
  CITY_NAMES.forEach((k, i) => {
    if (i < CITY_NAMES.length - 1) {
      t[k] = Math.round((t[k] / total) * 100);
      sum += t[k];
    } else {
      t[k] = 100 - sum; // last city absorbs rounding dust
    }
  });
}

// ── Core action ───────────────────────────────────────────────────────────────

export interface SkirmishOutcome {
  result: SkirmishResult;
  territories: Record<string, number>;
  error?: string;
}

/**
 * Launch a skirmish between two cities.
 * If `initiatorAddress` is provided, deducts SKIRMISH_COST MMC from them.
 * Returns the outcome + updated territory map.
 */
export function launchSkirmish(
  attackerCity: string,
  defenderCity: string,
  initiatorAddress?: string
): SkirmishOutcome {
  if (attackerCity === defenderCity) {
    return {
      result: {} as SkirmishResult,
      territories: getTerritories(),
      error: "A city cannot attack itself.",
    };
  }

  // Deduct MMC if this is a citizen-initiated skirmish
  if (initiatorAddress) {
    const bal = ledger.balanceOf(initiatorAddress);
    if (bal < SKIRMISH_COST) {
      return {
        result: {} as SkirmishResult,
        territories: getTerritories(),
        error: `Insufficient funds. Skirmish costs ${SKIRMISH_COST} MMC. You have ${bal} MMC.`,
      };
    }
    ledger.burn(initiatorAddress, SKIRMISH_COST, `war chest — skirmish: ${attackerCity} ⚔️ ${defenderCity}`);
  }

  const attackerScore = computePower(attackerCity);
  const defenderScore = computePower(defenderCity);
  const attackerWins = attackerScore > defenderScore;

  // Territory transfer: 5–15% from loser to winner
  const gained = Math.min(5 + Math.floor(Math.random() * 11), 15);
  const winner = attackerWins ? attackerCity : defenderCity;
  const loser  = attackerWins ? defenderCity : attackerCity;

  const result: SkirmishResult = {
    id: makeId(),
    at: Date.now(),
    attackerCity,
    defenderCity,
    attackerScore,
    defenderScore,
    winner,
    territoryGained: attackerWins ? gained : 0,
    initiator: initiatorAddress,
  };

  // Update territories in DB
  db.update((s) => {
    if (!s.territories) {
      s.territories = { "Brainrot City": 25, "Neo Ohio": 25, "Rizzland": 25, "Napistan": 25 };
    }
    if (attackerWins) {
      const available = Math.min(s.territories[loser] ?? 0, gained);
      s.territories[winner] = (s.territories[winner] ?? 0) + available;
      s.territories[loser]  = (s.territories[loser]  ?? 0) - available;
      normalizeTerritories(s.territories);
    }

    if (!s.skirmishLog) s.skirmishLog = [];
    s.skirmishLog.unshift(result);
    if (s.skirmishLog.length > MAX_LOG) s.skirmishLog.length = MAX_LOG;
  });

  return { result, territories: getTerritories() };
}
