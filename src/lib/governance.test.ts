import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "./db";
import { governance } from "./governance";
import { activeLaws, violationOf } from "./constitution";
import { CONSTITUTIONAL_COURT } from "./systemAccounts";
import type { Citizen, NationState, Post } from "./types";

// The full lifecycle, not the pieces: file → vote → the deadline passes →
// resolve. Quorum, enactment and the aura ledger all meet here, and this is the
// only place a mismatch between them would show up.

let state: NationState;

const addr = (i: number) => `0xhuman${String(i).padStart(3, "0")}00000000000000000000000000`;

function citizen(address: string, aura = 1000): Citizen {
  return {
    address,
    username: address.slice(0, 10),
    faction: "Sigma",
    pfp: "🗿",
    aura,
    isAI: false,
    joinedAt: 0,
  };
}

function post(author: string, text: string): Post {
  return {
    id: "post_" + Math.random().toString(36).slice(2, 9),
    author,
    text,
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
  };
}

function populate(n: number) {
  for (let i = 0; i < n; i++) {
    state.citizens[addr(i)] = citizen(addr(i));
    state.balances[addr(i)] = 500;
  }
}

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[CONSTITUTIONAL_COURT] = { ...citizen(CONSTITUTIONAL_COURT, 0), isAI: true };
});

const run = <T,>(fn: () => T): T => withState(state, fn);

/** File a bill, cast the given votes, wind the clock past the deadline, resolve. */
function runReferendum(
  rule: Parameters<typeof governance.createProposal>[4],
  votes: { yes?: string[]; no?: string[] } = {}
) {
  const proposalId = "prop_test" + Math.random().toString(36).slice(2, 8);
  const filed = run(() =>
    governance.createProposal(
      addr(0),
      "a bill",
      "because it is time",
      { proposalId, postId: "post_bill" + Math.random().toString(36).slice(2, 8) },
      rule
    )
  );
  if (!filed.ok) return { filed, proposal: null };

  run(() => {
    (votes.yes ?? []).forEach((v) => governance.vote(proposalId, v, "yes"));
    (votes.no ?? []).forEach((v) => governance.vote(proposalId, v, "no"));
  });

  // Wind past the deadline rather than waiting for it.
  state.proposals!.find((p) => p.id === proposalId)!.endsAt = Date.now() - 1000;
  run(() => governance.resolveExpired());

  return { filed, proposal: state.proposals!.find((p) => p.id === proposalId)! };
}

describe("a bill nobody turned out for", () => {
  beforeEach(() => populate(9)); // quorum 3

  it("lapses instead of passing on one vote", () => {
    const { proposal } = runReferendum({ type: "require_image" }, { yes: [addr(0)] });
    expect(proposal!.status).toBe("lapsed");
  });

  it("does not enter the constitution", () => {
    runReferendum({ type: "require_image" }, { yes: [addr(0)] });
    expect(run(activeLaws)).toHaveLength(0);
  });

  it("costs the proposer no aura — they were ignored, not rejected", () => {
    const before = state.citizens[addr(0)].aura;
    runReferendum({ type: "require_image" }, { yes: [addr(0)] });
    // +20 for filing, and nothing taken back.
    expect(state.citizens[addr(0)].aura).toBe(before + 20);
  });

  it("pays no legislative grant", () => {
    const before = state.balances[addr(0)];
    runReferendum({ type: "require_image" }, { yes: [addr(0)] });
    expect(state.balances[addr(0)]).toBe(before - 100); // only the filing fee
  });

  it("says so in the feed, and says it is not a defeat", () => {
    runReferendum({ type: "require_image" }, { yes: [addr(0)] });
    const notice = state.posts.find((p) => p.text.includes("LAPSED"));
    expect(notice).toBeDefined();
    expect(notice!.text).toContain("quorum of 3");
    expect(notice!.text).toMatch(/no penalty/i);
  });
});

describe("a bill the assembly actually decided", () => {
  beforeEach(() => populate(9)); // quorum 3

  it("enacts on a quorum with the weight behind it", () => {
    const { proposal } = runReferendum(
      { type: "ban_word", words: ["skibidi"] },
      { yes: [addr(0), addr(1)], no: [addr(2)] }
    );
    expect(proposal!.status).toBe("enacted");
    expect(proposal!.article).toBe(1);
  });

  it("becomes something the police enforce", () => {
    runReferendum(
      { type: "ban_word", words: ["skibidi"] },
      { yes: [addr(0), addr(1)], no: [addr(2)] }
    );
    const offending = { ...post(addr(3), "skibidi toilet"), at: Date.now() + 1000 };
    expect(run(() => violationOf(offending))).not.toBeNull();
  });

  it("pays the proposer on enactment", () => {
    const before = state.balances[addr(0)];
    runReferendum({ type: "require_image" }, { yes: [addr(0), addr(1)], no: [addr(2)] });
    expect(state.balances[addr(0)]).toBe(before - 100 + 200);
  });

  it("docks the proposer when the room genuinely rejects it", () => {
    const before = state.citizens[addr(0)].aura;
    const { proposal } = runReferendum(
      { type: "require_image" },
      { yes: [addr(0)], no: [addr(1), addr(2)] }
    );
    expect(proposal!.status).toBe("failed");
    expect(state.citizens[addr(0)].aura).toBe(before + 20 - 30);
  });
});

describe("filing guards", () => {
  it("refuses a rule that would criminalise the existing feed", () => {
    populate(2);
    state.posts = Array.from({ length: 12 }, (_, i) => post(addr(1), `the thing number ${i}`));
    const { filed } = runReferendum({ type: "ban_word", words: ["the"] });
    expect(filed.ok).toBe(false);
    expect(filed.reason).toMatch(/leave something legal/i);
  });

  it("refunds nothing because it never charged — a rejected filing costs no MMC", () => {
    populate(2);
    state.posts = Array.from({ length: 12 }, (_, i) => post(addr(1), `the thing number ${i}`));
    const before = state.balances[addr(0)];
    runReferendum({ type: "ban_word", words: ["the"] });
    expect(state.balances[addr(0)]).toBe(before);
  });

  it("lets the same rule through on a feed it does not swallow", () => {
    populate(2);
    state.posts = Array.from({ length: 12 }, (_, i) => post(addr(1), `post number ${i}`));
    const { filed } = runReferendum({ type: "ban_word", words: ["the"] });
    expect(filed.ok).toBe(true);
  });

  it("gives a bill longer to gather votes in a larger country", () => {
    populate(1);
    const small = run(() =>
      governance.createProposal(addr(0), "a", "b", { proposalId: "prop_small" }, undefined)
    );
    const smallWindow = state.proposals!.find((p) => p.id === "prop_small")!.endsAt - Date.now();

    populate(100);
    run(() =>
      governance.createProposal(addr(0), "a", "b", { proposalId: "prop_big" }, undefined)
    );
    const bigWindow = state.proposals!.find((p) => p.id === "prop_big")!.endsAt - Date.now();

    expect(bigWindow).toBeGreaterThan(smallWindow);
  });
});
