// cities.ts — the constitution of each city.
// Defines mechanical perks and debuffs applied to citizens by their chosen city.
// This is the SINGLE source of truth for city rules; UI and logic both read from here.

import type { Citizen } from "./types";

export interface CityRules {
  name: string;
  faction: string;
  emoji: string;
  motto: string;
  accentClass: string;

  // Human-readable labels shown in the UI
  perk: string;
  debuff: string;

  // ── Mechanical modifiers ────────────────────────────────────────────────────
  // Multiplier on the MMC reward for posting (1.0 = default).
  postRewardMult: number;

  // Multiplier on the MMC reward per upvote received (1.0 = default).
  upvoteRewardMult: number;

  // If true, the citizen is not hit with the spam tax on low-effort posts
  // (they still lose the base post reward and aura, just no extra burn).
  spamTaxImmune: boolean;

  // Aura deducted from an author when their post is downvoted (default 5).
  downvoteAuraPenalty: number;

  // If true, downvotes cause zero aura loss to the author.
  downvoteAuraImmune: boolean;

  // Extra MMC added to the standard 1 MMC transfer fee for outgoing transfers.
  extraTransferFee: number;
}

// ── The Four City Constitutions ────────────────────────────────────────────────

export const CITY_RULES: Record<string, CityRules> = {
  "Brainrot City": {
    name: "Brainrot City",
    faction: "NPC",
    emoji: "🧠",
    motto: "Where vibes go to decay. The capital of NPC energy.",
    accentClass: "s-purple",

    perk:   "+20% post MMC reward — the capital overprints shamelessly",
    debuff: "−20% upvote reward — NPCs tip poorly",

    postRewardMult:      1.2,
    upvoteRewardMult:    0.8,
    spamTaxImmune:       false,
    downvoteAuraPenalty: 5,
    downvoteAuraImmune:  false,
    extraTransferFee:    0,
  },

  "Neo Ohio": {
    name: "Neo Ohio",
    faction: "Sigma",
    emoji: "🗿",
    motto: "Always has been. Absolute peak sigma energy.",
    accentClass: "s-lime",

    perk:   "Spam tax immune — pure grindset output, no penalties",
    debuff: "−15 aura on downvote received — they ratio HARD",

    postRewardMult:      1.0,
    upvoteRewardMult:    1.0,
    spamTaxImmune:       true,
    downvoteAuraPenalty: 15,
    downvoteAuraImmune:  false,
    extraTransferFee:    0,
  },

  "Rizzland": {
    name: "Rizzland",
    faction: "Rizzler",
    emoji: "👑",
    motto: "Maximum charisma, zero filter. The elite rizzler enclave.",
    accentClass: "s-pink",

    perk:   "+50% upvote reward — charisma pays out",
    debuff: "+1 MMC extra transfer fee — the rizz tax",

    postRewardMult:      1.0,
    upvoteRewardMult:    1.5,
    spamTaxImmune:       false,
    downvoteAuraPenalty: 5,
    downvoteAuraImmune:  false,
    extraTransferFee:    1,
  },

  "Napistan": {
    name: "Napistan",
    faction: "NapEnjoyer",
    emoji: "😴",
    motto: "Too tired to participate. The chillest timezone in the nation.",
    accentClass: "s-cyan",

    perk:   "Zero aura loss on downvotes — too chill to care",
    debuff: "−30% post MMC reward — productivity penalty",

    postRewardMult:      0.7,
    upvoteRewardMult:    1.0,
    spamTaxImmune:       false,
    downvoteAuraPenalty: 0,
    downvoteAuraImmune:  true,
    extraTransferFee:    0,
  },
};

// Default rules for citizens with no city set (new / unregistered).
export const DEFAULT_CITY_RULES: CityRules = {
  name: "Unclaimed Territory",
  faction: "Unknown",
  emoji: "🏳️",
  motto: "No city, no perks, no mercy.",
  accentClass: "s-purple",
  perk:   "None",
  debuff: "None",
  postRewardMult:      1.0,
  upvoteRewardMult:    1.0,
  spamTaxImmune:       false,
  downvoteAuraPenalty: 5,
  downvoteAuraImmune:  false,
  extraTransferFee:    0,
};

/** Returns the CityRules for a given citizen, or DEFAULT_CITY_RULES if unset. */
export function getRulesForCitizen(citizen: Citizen | null | undefined): CityRules {
  if (!citizen?.city) return DEFAULT_CITY_RULES;
  return CITY_RULES[citizen.city] ?? DEFAULT_CITY_RULES;
}

/** Ordered array of all city configs for UI rendering. */
export const ALL_CITIES: CityRules[] = [
  CITY_RULES["Brainrot City"],
  CITY_RULES["Neo Ohio"],
  CITY_RULES["Rizzland"],
  CITY_RULES["Napistan"],
];
