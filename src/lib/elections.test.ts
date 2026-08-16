import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "./db";
import { elections } from "./elections";
import { ELECTION_COMMISSION } from "./systemAccounts";
import { CLOCK } from "./clock";
import type { Citizen, NationState } from "./types";

// An empty country holds an empty election every day of its life. What the
// commission says about that is the difference between a quiet institution and a
// machine repeating itself at a room with nobody in it.

let state: NationState;

const addr = (i: number) => `0xhuman${String(i).padStart(3, "0")}00000000000000000000000000`;

function citizen(address: string, running?: string): Citizen {
  return {
    address,
    username: address.slice(0, 10),
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI: false,
    joinedAt: 0,
    running,
  };
}

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[ELECTION_COMMISSION] = { ...citizen(ELECTION_COMMISSION), isAI: true };
});

const run = <T,>(fn: () => T): T => withState(state, fn);

/** Wind the ballot past its deadline and close it. */
function closePolls() {
  state.activeElection!.endsAt = Date.now() - 1000;
  return run(() => elections.resolveElection());
}

const notices = () =>
  state.posts.filter((p) => p.author === ELECTION_COMMISSION && p.text.includes("No nominations"));

describe("an election nobody stood in", () => {
  it("says so the first time", () => {
    closePolls();
    expect(notices()).toHaveLength(1);
  });

  it("does not say it again every term", () => {
    closePolls();
    closePolls();
    closePolls();
    closePolls();
    // The square is not a machine repeating itself at an empty room.
    expect(notices()).toHaveLength(1);
  });

  it("still opens a full new term each time it is silent", () => {
    closePolls();
    closePolls();
    // Asserted against the clock rather than against the previous endsAt: two
    // closes inside the same millisecond produce the same timestamp, and the
    // property that matters is "a full term is open", not "the number moved".
    expect(state.activeElection!.endsAt - Date.now()).toBeGreaterThan(CLOCK.electionTerm - 5000);
  });

  it("speaks up again when a government actually falls", () => {
    closePolls();
    expect(notices()).toHaveLength(1);

    // Somebody held office, and now nobody stood to replace them. That is news.
    state.citizens[addr(0)] = citizen(addr(0), "Chief Vibes Officer");
    closePolls();

    expect(notices()).toHaveLength(2);
    expect(notices()[0].text).toMatch(/outgoing government leaves office/i);
  });

  it("vacates the office whether or not it announced anything", () => {
    state.citizens[addr(0)] = citizen(addr(0), "Chief Vibes Officer");
    closePolls();
    expect(state.citizens[addr(0)].running).toBeUndefined();
  });

  it("leaves the state's own titles alone", () => {
    state.citizens[ELECTION_COMMISSION].running = "Federal Election Commission";
    closePolls();
    expect(state.citizens[ELECTION_COMMISSION].running).toBe("Federal Election Commission");
  });
});
