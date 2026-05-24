// db.ts — the storage layer.
//
// IMPORTANT (phase-1 architecture rule #3): this is the ONLY module that touches
// localStorage. Treat it as a stand-in for the chain. Everything else reads/writes
// state through here, so when we go on-chain in phase 2 we swap THIS module and
// nothing else changes. Keep the data model clean and portable.

import type { NationState } from "./types";

const NS = "memeostan:v1";

function freshState(): NationState {
  return {
    version: 2,
    citizens: {},
    balances: {},
    txs: [],
    posts: [],
    me: null,
    founded: null,
    proposals: [],
    activeElection: {
      candidates: [
        "0xai_gigachad000000000000000000gigachad",
        "0xai_spongebob00000000000000000sponge00",
        "0xai_dogeoracle0000000000000000000doge00",
      ],
      votes: {},
      endsAt: Date.now() + 5 * 60 * 1000, // 5 minute elections
    },
    gdbHistory: [],
    purchasedCosmetics: {},
    economicEvents: [],
    taxHikeEndsAt: undefined,
  };
}

function migrate(state: any): NationState {
  // Ensure all core keys are non-null and defined with correct default structures
  if (!state.citizens || typeof state.citizens !== "object") state.citizens = {};
  if (!state.balances || typeof state.balances !== "object") state.balances = {};
  if (!state.txs || !Array.isArray(state.txs)) state.txs = [];
  if (!state.posts || !Array.isArray(state.posts)) state.posts = [];
  if (!state.proposals || !Array.isArray(state.proposals)) state.proposals = [];
  if (!state.gdbHistory || !Array.isArray(state.gdbHistory)) state.gdbHistory = [];
  if (!state.purchasedCosmetics || typeof state.purchasedCosmetics !== "object") state.purchasedCosmetics = {};
  if (!state.economicEvents || !Array.isArray(state.economicEvents)) state.economicEvents = [];
  if (state.taxHikeEndsAt === undefined) state.taxHikeEndsAt = 0;

  if (!state.version || state.version < 2) {
    state.version = 2;
    if (!state.activeElection) {
      state.activeElection = {
        candidates: [
          "0xai_gigachad000000000000000000gigachad",
          "0xai_spongebob00000000000000000sponge00",
          "0xai_dogeoracle0000000000000000000doge00",
        ],
        votes: {},
        endsAt: (state.founded || Date.now()) + 5 * 60 * 1000,
      };
    }
  }

  // Ensure activeElection is valid
  if (!state.activeElection || typeof state.activeElection !== "object") {
    state.activeElection = {
      candidates: [
        "0xai_gigachad000000000000000000gigachad",
        "0xai_spongebob00000000000000000sponge00",
        "0xai_dogeoracle0000000000000000000doge00",
      ],
      votes: {},
      endsAt: Date.now() + 5 * 60 * 1000,
    };
  }
  
  // Migrate legacy Prime Minister badges to Chief Vibes Officer
  if (state.citizens) {
    Object.values(state.citizens).forEach((c: any) => {
      if (c && c.equippedBadge === "badge_prime_minister") {
        c.equippedBadge = "badge_chief_vibes_officer";
      }
    });
  }
  if (state.purchasedCosmetics) {
    Object.keys(state.purchasedCosmetics).forEach((addr) => {
      const cosmetics = state.purchasedCosmetics[addr];
      if (Array.isArray(cosmetics)) {
        state.purchasedCosmetics[addr] = cosmetics.map((id) =>
          id === "badge_prime_minister" ? "badge_chief_vibes_officer" : id
        );
      }
    });
  }

  return state as NationState;
}

let cache: NationState | null = null;

const hasWindow = typeof window !== "undefined";

function read(): NationState {
  if (cache) return cache;
  if (!hasWindow) {
    // server render: hand back an empty nation; real state hydrates on the client
    cache = freshState();
    return cache;
  }
  let state: NationState;
  try {
    const raw = window.localStorage.getItem(NS);
    state = raw ? { ...freshState(), ...JSON.parse(raw) } : freshState();
  } catch {
    state = freshState();
  }
  if (!state.founded) state.founded = Date.now();
  state = migrate(state);
  cache = state;
  return state;
}

function persist(state: NationState): void {
  cache = state;
  if (hasWindow) window.localStorage.setItem(NS, JSON.stringify(state));
}

export const db = {
  get(): NationState {
    return read();
  },
  // every mutation goes through one choke point
  update(mutator: (state: NationState) => void): NationState {
    const state = read();
    mutator(state);
    persist(state);
    return state;
  },
  reset(): void {
    if (hasWindow) window.localStorage.removeItem(NS);
    cache = null;
  },
};
