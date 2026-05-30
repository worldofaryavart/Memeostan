// db.ts — the storage layer.
//
// IMPORTANT (phase-1 architecture rule #3): this is the ONLY module that touches
// localStorage. Treat it as a stand-in for the chain. Everything else reads/writes
// state through here, so when we go on-chain in phase 2 we swap THIS module and
// nothing else changes. Keep the data model clean and portable.

import type { NationState } from "./types";

const NS = "memeostan:v1";

export function freshState(): NationState {
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
    territories: { "Brainrot City": 25, "Neo Ohio": 25, "Rizzland": 25, "Napistan": 25 },
    skirmishLog: [],
    trials: [],
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
  if (!state.territories || typeof state.territories !== "object") {
    state.territories = { "Brainrot City": 25, "Neo Ohio": 25, "Rizzland": 25, "Napistan": 25 };
  }
  if (!state.skirmishLog || !Array.isArray(state.skirmishLog)) state.skirmishLog = [];
  if (!state.trials || !Array.isArray(state.trials)) state.trials = [];

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

export async function loadStateFromServer(): Promise<void> {
  if (!hasWindow) return;
  try {
    const res = await fetch("/api/state");
    if (res.ok) {
      const serverState = await res.json();
      cache = migrate(serverState);
    }
  } catch (err) {
    console.error("Failed to load state from MongoDB server, falling back to localStorage:", err);
    try {
      const raw = window.localStorage.getItem(NS);
      if (raw) cache = migrate(JSON.parse(raw));
    } catch {}
  }
}

function read(): NationState {
  if (cache) return cache;
  // Temporary fallback during initial hydration
  if (hasWindow) {
    try {
      const raw = window.localStorage.getItem(NS);
      if (raw) {
        cache = migrate(JSON.parse(raw));
        return cache;
      }
    } catch {}
  }
  cache = freshState();
  return cache;
}

function persist(state: NationState): void {
  cache = state;
  if (hasWindow) {
    // Write locally first for instant responses
    try {
      window.localStorage.setItem(NS, JSON.stringify(state));
    } catch {}

    // Persist to MongoDB asynchronously in the background
    fetch("/api/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    }).catch((err) => console.error("Failed to sync state to MongoDB server:", err));
  }
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
  async reset(): Promise<void> {
    cache = freshState();
    if (hasWindow) {
      window.localStorage.removeItem(NS);
      try {
        await fetch("/api/state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cache),
        });
      } catch (err) {
        console.error("Failed to reset MongoDB state on server:", err);
      }
    }
  },
};
