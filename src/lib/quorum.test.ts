import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "./db";
import {
  currentQuorum,
  electorate,
  proposalDuration,
  quorumFor,
  tally,
  voteWeight,
} from "./quorum";
import { proportionality, PROPORTIONALITY_LIMIT } from "./constitution";
import { CYBER_POLICE, SUPREME_COURT } from "./systemAccounts";
import { CLOCK } from "./clock";
import type { Citizen, NationState, Post } from "./types";

let state: NationState;

function citizen(address: string, aura = 1000, isAI = false): Citizen {
  return {
    address,
    username: address.slice(0, 10),
    faction: "Sigma",
    pfp: "🗿",
    aura,
    isAI,
    joinedAt: 0,
  };
}

function post(author: string, text = "words", overrides: Partial<Post> = {}): Post {
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
    ...overrides,
  };
}

const addr = (i: number) => `0xhuman${String(i).padStart(3, "0")}00000000000000000000000000`;

function populate(n: number, aura = 1000) {
  for (let i = 0; i < n; i++) state.citizens[addr(i)] = citizen(addr(i), aura);
}

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[SUPREME_COURT] = citizen(SUPREME_COURT, 0, true);
  state.citizens[CYBER_POLICE] = citizen(CYBER_POLICE, 0, true);
});

const run = <T,>(fn: () => T): T => withState(state, fn);

describe("quorumFor — scales, but stays reachable", () => {
  it("grows with the population", () => {
    expect([0, 1, 2, 4, 9, 16, 25, 100].map(quorumFor)).toEqual([1, 1, 2, 2, 3, 4, 5, 10]);
  });

  it("never demands more votes than there are citizens", () => {
    for (let n = 1; n <= 200; n++) expect(quorumFor(n)).toBeLessThanOrEqual(n);
  });

  it("is never zero, so a bill always needs somebody", () => {
    for (let n = 0; n <= 50; n++) expect(quorumFor(n)).toBeGreaterThanOrEqual(1);
  });

  it("stays a shrinking share as the country grows — 100 citizens need 10%, not 100", () => {
    expect(quorumFor(100) / 100).toBeLessThan(quorumFor(9) / 9);
  });
});

describe("electorate — the civil service is not the people", () => {
  it("counts citizens only", () => {
    populate(3);
    expect(run(electorate)).toBe(3);
    expect(run(currentQuorum)).toBe(2);
  });

  it("is one when only the government exists", () => {
    expect(run(electorate)).toBe(0);
    expect(run(currentQuorum)).toBe(1);
  });
});

describe("voteWeight — reputation counts, but is not a peerage", () => {
  it("gives a new citizen ten", () => {
    expect(voteWeight(1000)).toBe(10);
  });

  it("floors at one, so nobody is disenfranchised by a bad week", () => {
    expect(voteWeight(0)).toBe(1);
    expect(voteWeight(50)).toBe(1);
  });

  it("caps at twice a new citizen", () => {
    expect(voteWeight(2000)).toBe(20);
    expect(voteWeight(9999)).toBe(20);
    expect(voteWeight(1_000_000)).toBe(20);
  });

  it("stops one ancient citizen outvoting a room", () => {
    // Uncapped, aura 9,999 was worth 99 and beat nine ordinary citizens alone.
    expect(voteWeight(9999)).toBeLessThan(3 * voteWeight(1000));
  });
});

describe("tally — one counting function for the resolver and the UI", () => {
  it("lapses a bill nobody voted on", () => {
    populate(9); // quorum 3
    const t = run(() => tally({ yesVotes: [addr(0)], noVotes: [] }));
    expect(t.quorum).toBe(3);
    expect(t.quorumMet).toBe(false);
    expect(t.outcome).toBe("lapsed");
  });

  it("enacts once quorum is met and the weight is behind it", () => {
    populate(9);
    const t = run(() => tally({ yesVotes: [addr(0), addr(1)], noVotes: [addr(2)] }));
    expect(t.quorumMet).toBe(true);
    expect(t.outcome).toBe("enacted");
  });

  it("defeats a bill the room is against", () => {
    populate(9);
    const t = run(() => tally({ yesVotes: [addr(0)], noVotes: [addr(1), addr(2)] }));
    expect(t.outcome).toBe("failed");
  });

  it("treats a tie as a defeat — a bill has to win, not merely not lose", () => {
    populate(4); // quorum 2
    const t = run(() => tally({ yesVotes: [addr(0)], noVotes: [addr(1)] }));
    expect(t.outcome).toBe("failed");
  });

  it("lets a lone citizen govern a country of one", () => {
    populate(1);
    const t = run(() => tally({ yesVotes: [addr(0)], noVotes: [] }));
    // Not a loophole: at a population of one, one vote is total turnout.
    expect(t.outcome).toBe("enacted");
  });

  it("stops one high-aura citizen carrying a bill against three others", () => {
    populate(9);
    state.citizens[addr(0)].aura = 99_999;
    const t = run(() =>
      tally({ yesVotes: [addr(0)], noVotes: [addr(1), addr(2), addr(3)] })
    );
    expect(t.outcome).toBe("failed");
  });
});

describe("proposalDuration — more people to reach, more time to reach them", () => {
  it("is the base window plus an hour per citizen of quorum", () => {
    expect(proposalDuration(1)).toBe(CLOCK.proposalBase + CLOCK.proposalPerQuorum);
  });

  it("lengthens as quorum rises", () => {
    expect(proposalDuration(100)).toBeGreaterThan(proposalDuration(4));
  });

  it("is capped, so a bill cannot stay open forever", () => {
    expect(proposalDuration(1_000_000)).toBe(CLOCK.proposalMax);
  });

  it("decides every bill within a day, however large the country", () => {
    expect(CLOCK.proposalMax).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
  });
});

describe("proportionality — a law has to leave something legal", () => {
  const HUMAN = addr(0);

  beforeEach(() => {
    populate(1);
    state.posts = Array.from({ length: 12 }, (_, i) =>
      post(HUMAN, `the post number ${i} about things`)
    );
  });

  it("rejects banning a word that appears in nearly every post", () => {
    // "the" is three characters, passes every parameter bound, and would make
    // the entire country criminal. The bound cannot catch this; the effect can.
    const reach = run(() => proportionality({ type: "ban_word", words: ["the"] }));
    expect(reach.conclusive).toBe(true);
    expect(reach.share).toBeGreaterThan(PROPORTIONALITY_LIMIT);
  });

  it("allows banning a word almost nobody uses", () => {
    const reach = run(() => proportionality({ type: "ban_word", words: ["skibidi"] }));
    expect(reach.share).toBe(0);
  });

  it("catches a minimum length that outlaws ordinary posting", () => {
    const reach = run(() => proportionality({ type: "min_length", n: 200 }));
    expect(reach.share).toBeGreaterThan(PROPORTIONALITY_LIMIT);
  });

  it("catches require_image against a text-only feed", () => {
    const reach = run(() => proportionality({ type: "require_image" }));
    expect(reach.share).toBe(1);
  });

  it("declines to judge on too small a sample", () => {
    state.posts = [post(HUMAN, "the")];
    const reach = run(() => proportionality({ type: "ban_word", words: ["the"] }));
    // With almost no feed there is nothing to be proportionate to, and a brand
    // new country must still be able to legislate.
    expect(reach.conclusive).toBe(false);
  });

  it("ignores the state's own posts when judging reach", () => {
    state.posts = [
      ...Array.from({ length: 10 }, () => post(SUPREME_COURT, "the court finds the defendant")),
      post(HUMAN, "gm"),
    ];
    const reach = run(() => proportionality({ type: "ban_word", words: ["the"] }));
    // Only one citizen post in the sample — not enough to judge, and certainly
    // not grounds to block a bill on the strength of court paperwork.
    expect(reach.conclusive).toBe(false);
  });

  it("says nothing about a repeal", () => {
    expect(run(() => proportionality({ type: "repeal", target: "prop_x" })).conclusive).toBe(false);
  });
});
