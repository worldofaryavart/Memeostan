// db.ts — the state layer.
//
// This is still the single choke-point every mutation flows through, but it is no
// longer the source of truth. The server is (see src/lib/serverState.ts).
//
// Two modes, one API:
//
//   • On the SERVER, an action handler runs inside `withState()`. `db.get()` and
//     `db.update()` operate directly on that request's state object, and the route
//     persists the result under a revision guard. This is the authoritative path.
//
//   • On the CLIENT, `db` is an optimistic cache. Mutations apply locally for an
//     instant UI, the intent is signed and sent to /api/action, and the canonical
//     state that comes back replaces the cache. The client can no longer write
//     state directly — it can only ask.
//
// INVARIANT: server-side action handlers must be fully synchronous. `withState`
// uses a module-level reference, which is only safe because no handler awaits
// mid-mutation (Node would otherwise interleave two requests). Signature checks
// and the database write happen outside the mutation window.

import type { NationState } from "./types";

const NS = "memeostan:v1";

export function freshState(): NationState {
  return {
    version: 3,
    rev: 0,
    citizens: {},
    balances: {},
    txs: [],
    posts: [],
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
    seenNonces: [],
    lastTickAt: 0,
    lastGdbSnapshotAt: 0,
  };
}

const DEFAULT_CANDIDATES = [
  "0xai_gigachad000000000000000000gigachad",
  "0xai_spongebob00000000000000000sponge00",
  "0xai_dogeoracle0000000000000000000doge00",
];

export function migrate(input: unknown): NationState {
  const state = (input || {}) as Record<string, any>;

  if (!state.citizens || typeof state.citizens !== "object") state.citizens = {};
  if (!state.balances || typeof state.balances !== "object") state.balances = {};
  if (!Array.isArray(state.txs)) state.txs = [];
  if (!Array.isArray(state.posts)) state.posts = [];
  if (!Array.isArray(state.proposals)) state.proposals = [];
  if (!Array.isArray(state.gdbHistory)) state.gdbHistory = [];
  if (!state.purchasedCosmetics || typeof state.purchasedCosmetics !== "object") {
    state.purchasedCosmetics = {};
  }
  if (!Array.isArray(state.economicEvents)) state.economicEvents = [];
  if (state.taxHikeEndsAt === undefined) state.taxHikeEndsAt = 0;
  if (!state.territories || typeof state.territories !== "object") {
    state.territories = { "Brainrot City": 25, "Neo Ohio": 25, "Rizzland": 25, "Napistan": 25 };
  }
  if (!Array.isArray(state.skirmishLog)) state.skirmishLog = [];
  if (!Array.isArray(state.trials)) state.trials = [];

  if (!state.version || state.version < 2) {
    state.version = 2;
    if (!state.activeElection) {
      state.activeElection = {
        candidates: [...DEFAULT_CANDIDATES],
        votes: {},
        endsAt: (state.founded || Date.now()) + 5 * 60 * 1000,
      };
    }
  }

  if (!state.activeElection || typeof state.activeElection !== "object") {
    state.activeElection = {
      candidates: [...DEFAULT_CANDIDATES],
      votes: {},
      endsAt: Date.now() + 5 * 60 * 1000,
    };
  }

  // Legacy Prime Minister badges → Chief Vibes Officer
  Object.values(state.citizens).forEach((c: any) => {
    if (c && c.equippedBadge === "badge_prime_minister") {
      c.equippedBadge = "badge_chief_vibes_officer";
    }
  });
  Object.keys(state.purchasedCosmetics).forEach((addr) => {
    const cosmetics = state.purchasedCosmetics[addr];
    if (Array.isArray(cosmetics)) {
      state.purchasedCosmetics[addr] = cosmetics.map((id: string) =>
        id === "badge_prime_minister" ? "badge_chief_vibes_officer" : id
      );
    }
  });

  // v3: the server owns state. Identity moved client-side, revisions and replay
  // protection moved server-side.
  if (state.version < 3) {
    state.version = 3;
    delete state.me;
  }
  if (typeof state.rev !== "number") state.rev = 0;
  if (!Array.isArray(state.seenNonces)) state.seenNonces = [];
  if (typeof state.lastTickAt !== "number") state.lastTickAt = 0;
  if (typeof state.lastGdbSnapshotAt !== "number") state.lastGdbSnapshotAt = 0;

  return state as unknown as NationState;
}

/**
 * Strip everything that must never reach a browser. Legacy `secret` keys were
 * previously served to every visitor along with the nation state; they now stop
 * at the server boundary and are deleted outright on key upgrade.
 */
export function publicState(state: NationState): NationState {
  const clone = JSON.parse(JSON.stringify(state)) as NationState & Record<string, unknown>;
  delete clone.seenNonces;
  delete clone.me;
  Object.values(clone.citizens).forEach((c) => {
    delete c.secret;
  });
  return clone;
}

// ── server mode ──────────────────────────────────────────────────────────────

let serverState: NationState | null = null;

/**
 * Run a synchronous mutation against a server-held state object. Everything the
 * lib functions do inside `fn` lands on `state` and nothing is persisted here —
 * the caller decides whether to commit.
 */
export function withState<T>(state: NationState, fn: () => T): T {
  if (serverState) {
    throw new Error("withState is not re-entrant — an action is already applying");
  }
  serverState = state;
  try {
    return fn();
  } finally {
    serverState = null;
  }
}

// ── client mode ──────────────────────────────────────────────────────────────

const hasWindow = typeof window !== "undefined";

let cache: NationState | null = null;

function read(): NationState {
  if (serverState) return serverState;
  if (cache) return cache;
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

function cacheLocally(state: NationState): void {
  if (!hasWindow) return;
  try {
    window.localStorage.setItem(NS, JSON.stringify(state));
  } catch {}
}

/** Adopt canonical state from the server, ignoring anything staler than we hold. */
export function applyServerState(next: NationState): boolean {
  const incoming = migrate(next);
  const currentRev = cache?.rev ?? -1;
  if ((incoming.rev ?? 0) < currentRev) return false;
  cache = incoming;
  cacheLocally(incoming);
  return true;
}

export async function loadStateFromServer(): Promise<void> {
  if (!hasWindow) return;
  try {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (!res.ok) throw new Error(`/api/state returned ${res.status}`);
    applyServerState(await res.json());
  } catch (err) {
    console.error("Could not load nation state from the server:", err);
    // Read-only fallback so the UI can still render something familiar.
    if (!cache) read();
  }
}

export const db = {
  get(): NationState {
    return read();
  },

  /**
   * The one mutation choke-point. Server-side this edits the authoritative state;
   * client-side it edits the optimistic cache only — the matching intent is sent
   * by `act()` in src/lib/actionClient.ts.
   */
  update(mutator: (state: NationState) => void): NationState {
    const state = read();
    mutator(state);
    if (!serverState) {
      cache = state;
      cacheLocally(state);
    }
    return state;
  },

  /** Local-only wipe. The nation on the server is untouched. */
  clearLocal(): void {
    cache = null;
    if (hasWindow) window.localStorage.removeItem(NS);
  },

  async load(): Promise<void> {
    await loadStateFromServer();
  },
};
