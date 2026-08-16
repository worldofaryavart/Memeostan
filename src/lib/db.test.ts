import { beforeAll, describe, it, expect } from "vitest";
import { freshState, migrate } from "./db";
import { CYBER_POLICE, SUPREME_COURT, TREASURY } from "./systemAccounts";
import type { Citizen, NationState } from "./types";

// The v5 migration deletes citizen records from live production data. It gets a
// test because "delete every row matching a predicate" is the kind of code that
// is fine until the predicate is one character wrong.

function citizen(address: string, isAI: boolean): Citizen {
  return {
    address,
    username: address.slice(0, 10),
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI,
    joinedAt: 0,
  };
}

const HUMAN = "0xhuman0000000000000000000000000000aaa";
const GIGACHAD = "0xai_gigachad000000000000000000gigachad";
const GHOST = "0xghost10000000000000000000000000ghost";

/** A pre-v5 nation: three humans' worth of bots, plus the state. */
function legacyState(): Record<string, any> {
  const state = freshState() as unknown as Record<string, any>;
  state.version = 4;

  state.citizens = {
    [HUMAN]: citizen(HUMAN, false),
    [GIGACHAD]: citizen(GIGACHAD, true),
    [GHOST]: citizen(GHOST, true),
    [CYBER_POLICE]: citizen(CYBER_POLICE, true),
    [SUPREME_COURT]: citizen(SUPREME_COURT, true),
  };
  state.balances = {
    [HUMAN]: 250,
    [GIGACHAD]: 1000,
    [GHOST]: 300,
    [CYBER_POLICE]: 50_000,
    [TREASURY]: 999,
  };
  state.purchasedCosmetics = { [GIGACHAD]: ["badge_brainrot_veteran"] };
  state.posts = [
    {
      id: "post_1",
      author: GIGACHAD,
      text: "mewing is constitutional",
      image: null,
      up: 3,
      down: 0,
      voters: {},
      replies: [{ author: GHOST, text: "fr", at: 0 }],
      at: 0,
    },
  ];
  state.activeElection = {
    candidates: [GIGACHAD, HUMAN],
    votes: { [GIGACHAD]: GIGACHAD, [HUMAN]: HUMAN },
    endsAt: Date.now() + 60_000,
  };
  state.proposals = [
    {
      id: "prop_1",
      creator: HUMAN,
      title: "naps",
      description: "more naps",
      status: "active",
      yesVotes: [GIGACHAD, HUMAN],
      noVotes: [GHOST],
      endsAt: Date.now() + 60_000,
      at: 0,
    },
  ];
  state.trials = [
    {
      id: "trial_1",
      defendant: HUMAN,
      plaintiff: SUPREME_COURT,
      charge: "CRINGE",
      description: "d",
      status: "voting",
      yesVotes: [GIGACHAD],
      noVotes: [GHOST],
      verdict: null,
      penalty: "",
      at: 0,
      endsAt: Date.now() + 60_000,
    },
  ];

  return state;
}

describe("migrate v5 — AI is the civil service, not the population", () => {
  let migrated: NationState;

  beforeAll(() => {
    migrated = migrate(legacyState());
  });

  it("keeps the humans", () => {
    expect(migrated.citizens[HUMAN]).toBeDefined();
    expect(migrated.balances[HUMAN]).toBe(250);
  });

  it("keeps every organ of the state", () => {
    expect(migrated.citizens[CYBER_POLICE]).toBeDefined();
    expect(migrated.citizens[SUPREME_COURT]).toBeDefined();
    expect(migrated.balances[CYBER_POLICE]).toBe(50_000);
    expect(migrated.balances[TREASURY]).toBe(999);
  });

  it("decommissions the AI candidates and the ghosts", () => {
    expect(migrated.citizens[GIGACHAD]).toBeUndefined();
    expect(migrated.citizens[GHOST]).toBeUndefined();
  });

  it("takes their MMC out of the supply with them", () => {
    expect(migrated.balances[GIGACHAD]).toBeUndefined();
    expect(migrated.balances[GHOST]).toBeUndefined();
  });

  it("keeps their posts — the country's history is that it was full of bots", () => {
    expect(migrated.posts).toHaveLength(1);
    expect(migrated.posts[0].author).toBe(GIGACHAD);
  });

  it("clears them off the ballot without disturbing the citizens on it", () => {
    expect(migrated.activeElection?.candidates).toEqual([HUMAN]);
    expect(migrated.activeElection?.votes).toEqual({ [HUMAN]: HUMAN });
  });

  it("retracts their votes on open legislation", () => {
    expect(migrated.proposals?.[0].yesVotes).toEqual([HUMAN]);
    expect(migrated.proposals?.[0].noVotes).toEqual([]);
  });

  it("empties them out of the jury box", () => {
    expect(migrated.trials?.[0].yesVotes).toEqual([]);
    expect(migrated.trials?.[0].noVotes).toEqual([]);
  });

  it("is idempotent — running it twice changes nothing further", () => {
    const twice = migrate(JSON.parse(JSON.stringify(migrated)));
    expect(Object.keys(twice.citizens).sort()).toEqual(
      Object.keys(migrated.citizens).sort()
    );
  });

  it("opens a fresh nation with nobody on the ballot", () => {
    expect(migrate(freshState()).activeElection?.candidates).toEqual([]);
  });
});
