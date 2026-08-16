import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "@/lib/db";
import { patrol, population, prosecuteWarnedCitizens } from "./world";
import { pendingVerdicts } from "@/lib/judiciary";
import {
  CONSTITUTIONAL_COURT,
  CYBER_POLICE,
  ELECTION_COMMISSION,
  SUPREME_COURT,
} from "@/lib/systemAccounts";
import type { Citizen, NationState, Post, Trial } from "@/lib/types";

let state: NationState;

function citizen(address: string, isAI = false): Citizen {
  return {
    address,
    username: address.slice(0, 8),
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI,
    joinedAt: 0,
  };
}

function post(author: string, overrides: Partial<Post> = {}): Post {
  return {
    id: "post_" + Math.random().toString(36).slice(2, 9),
    author,
    text: "words",
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
    ...overrides,
  };
}

function citation(minutesAgo = 5) {
  return { author: CYBER_POLICE, text: "⚠️ CITATION", at: Date.now() - minutesAgo * 60_000 };
}

const ALICE = "0xhuman0000000000000000000000000000aaa";
const BOB = "0xhuman0000000000000000000000000000bbb";

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[ALICE] = citizen(ALICE);
  state.citizens[BOB] = citizen(BOB);
  state.citizens[SUPREME_COURT] = citizen(SUPREME_COURT, true);
  state.citizens[CYBER_POLICE] = citizen(CYBER_POLICE, true);
});

const run = <T,>(fn: () => T): T => withState(state, fn);

describe("population — the state is not the people", () => {
  it("counts citizens only", () => {
    state.citizens[ELECTION_COMMISSION] = citizen(ELECTION_COMMISSION, true);
    state.citizens[CONSTITUTIONAL_COURT] = citizen(CONSTITUTIONAL_COURT, true);
    expect(run(population).map((c) => c.address).sort()).toEqual([ALICE, BOB].sort());
  });

  it("is empty on a fresh nation, however much government exists", () => {
    state = migrate(freshState());
    state.citizens[SUPREME_COURT] = citizen(SUPREME_COURT, true);
    state.citizens[CYBER_POLICE] = citizen(CYBER_POLICE, true);
    expect(run(population)).toHaveLength(0);
  });
});

describe("patrol — the police need a rule they can point at", () => {
  it("finds nothing in an empty square", () => {
    expect(run(() => patrol())).toEqual([]);
  });

  it("cites reasoning in a public space", () => {
    state.posts = [post(ALICE, { text: "actually the GDB numbers are fine" })];
    const [offence] = run(() => patrol());
    expect(offence.charge).toBe("LOGIC USAGE IN A PUBLIC SPACE");
    expect(offence.article).toBe("Article 1");
  });

  it("cites flooding once three posts land inside the window", () => {
    state.posts = [post(ALICE), post(ALICE), post(ALICE)];
    const [offence] = run(() => patrol());
    expect(offence.charge).toBe("SPAM FLOODING THE COMMONS");
  });

  it("leaves two posts alone", () => {
    state.posts = [post(ALICE), post(ALICE)];
    expect(run(() => patrol())).toEqual([]);
  });

  it("cites a ratioed post", () => {
    state.posts = [post(ALICE, { up: 1, down: 4 })];
    const [offence] = run(() => patrol());
    expect(offence.charge).toBe("EXCESSIVE CRINGE DISTRIBUTION");
  });

  it("does not cite the same post twice", () => {
    state.posts = [
      post(ALICE, { text: "actually no", replies: [citation()] }),
    ];
    expect(run(() => patrol())).toEqual([]);
  });

  it("does not police the state's own posts", () => {
    state.posts = [post(SUPREME_COURT, { text: "actually, the evidence is clear" })];
    expect(run(() => patrol())).toEqual([]);
  });

  it("ignores posts that have aged out of the patrol window", () => {
    state.posts = [
      post(ALICE, { text: "actually no", at: Date.now() - 30 * 60_000 }),
    ];
    expect(run(() => patrol())).toEqual([]);
  });
});

describe("prosecuteWarnedCitizens — a charge has to trace back to a warning", () => {
  it("does nothing without a citation", () => {
    state.posts = [post(ALICE)];
    expect(run(prosecuteWarnedCitizens)).toBe(false);
    expect(state.trials ?? []).toHaveLength(0);
  });

  it("charges a citizen whose citation went unanswered", () => {
    state.posts = [post(ALICE, { replies: [citation()] })];
    expect(run(prosecuteWarnedCitizens)).toBe(true);
    expect(state.trials?.[0].defendant).toBe(ALICE);
  });

  it("gives the citizen a moment between the warning and the charge", () => {
    state.posts = [post(ALICE, { replies: [citation(0)] })];
    expect(run(prosecuteWarnedCitizens)).toBe(false);
  });

  it("runs one trial at a time", () => {
    state.posts = [
      post(ALICE, { replies: [citation()] }),
      post(BOB, { replies: [citation()] }),
    ];
    run(prosecuteWarnedCitizens);
    run(prosecuteWarnedCitizens);
    expect(state.trials).toHaveLength(1);
  });
});

describe("pendingVerdicts — an empty jury box is not an acquittal", () => {
  function trial(overrides: Partial<Trial> = {}): Trial {
    return {
      id: "trial_1",
      defendant: ALICE,
      plaintiff: SUPREME_COURT,
      charge: "IGNORING A LAWFUL CITATION",
      description: "case",
      status: "voting",
      yesVotes: [],
      noVotes: [],
      verdict: null,
      penalty: "",
      at: Date.now() - 10 * 60_000,
      endsAt: Date.now() - 60_000,
      ...overrides,
    };
  }

  it("ignores trials that are still running", () => {
    state.trials = [trial({ endsAt: Date.now() + 60_000 })];
    expect(run(pendingVerdicts)).toHaveLength(0);
  });

  it("honours a grace period, so the clock doesn't outrun the court's reasoning", () => {
    state.trials = [trial({ endsAt: Date.now() - 10_000 })];
    expect(run(() => pendingVerdicts(60_000))).toHaveLength(0); // clock stands back
    expect(run(() => pendingVerdicts(0))).toHaveLength(1); // the beat may rule
  });

  it("still resolves once the grace period has passed and nobody ruled", () => {
    state.trials = [trial({ endsAt: Date.now() - 90_000 })];
    expect(run(() => pendingVerdicts(60_000))).toHaveLength(1);
  });

  it("convicts from the bench when nobody sat on the jury", () => {
    // The old tally was `guilty = yesVotes > noVotes`, so 0 > 0 acquitted the
    // defendant and paid them compensation. On an empty country that is a faucet.
    state.trials = [trial()];
    const [pending] = run(pendingVerdicts);
    expect(pending.benchVerdict).toBe(true);
    expect(pending.isGuilty).toBe(true);
  });

  it("defers to the jury the moment one citizen votes", () => {
    state.trials = [trial({ noVotes: [BOB] })];
    const [pending] = run(pendingVerdicts);
    expect(pending.benchVerdict).toBe(false);
    expect(pending.isGuilty).toBe(false);
  });

  it("follows a guilty jury", () => {
    state.trials = [trial({ yesVotes: [BOB] })];
    const [pending] = run(pendingVerdicts);
    expect(pending.isGuilty).toBe(true);
  });
});
