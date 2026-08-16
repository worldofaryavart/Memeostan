import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "@/lib/db";
import { patrol, population, prosecuteWarnedCitizens } from "./world";
import { pendingVerdicts } from "@/lib/judiciary";
import { activeLaws, enact, seedFoundingArticles } from "@/lib/constitution";
import { CLOCK } from "@/lib/clock";
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

/** A citation old enough to have gone unanswered, by the clock's own reckoning. */
function citation(ageMs = CLOCK.citationGrace * 2) {
  return { author: CYBER_POLICE, text: "⚠️ CITATION", at: Date.now() - ageMs };
}

/** A post that genuinely breaks Article 1, already cited. */
function unlawful(author: string, citedAgeMs = CLOCK.citationGrace * 2): Post {
  return post(author, {
    text: "actually that is incorrect",
    replies: [citation(citedAgeMs)],
  });
}

const ALICE = "0xhuman0000000000000000000000000000aaa";
const BOB = "0xhuman0000000000000000000000000000bbb";

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[ALICE] = citizen(ALICE);
  state.citizens[BOB] = citizen(BOB);
  state.citizens[SUPREME_COURT] = citizen(SUPREME_COURT, true);
  state.citizens[CYBER_POLICE] = citizen(CYBER_POLICE, true);
  // The police enforce the constitution and nothing else, so there has to be
  // one. Without this every patrol test finds nothing, which is correct.
  withState(state, () => seedFoundingArticles());
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
    expect(offence.charge).toBe("USE OF A PROSCRIBED WORD");
    expect(offence.article).toBe("Article 1");
    expect(offence.law).toBe("Logic is banned in public spaces");
  });

  it("cites flooding once the author goes past the limit", () => {
    // Article 2 permits three posts in five minutes, so the fourth is the
    // offence. The hardcoded rule this replaced cited on the third, which
    // contradicted the wording it was supposedly enforcing.
    state.posts = [post(ALICE), post(ALICE), post(ALICE), post(ALICE)];
    const [offence] = run(() => patrol());
    expect(offence.charge).toBe("FLOODING THE COMMONS");
    expect(offence.article).toBe("Article 2");
  });

  it("leaves an author inside the limit alone", () => {
    state.posts = [post(ALICE), post(ALICE), post(ALICE)];
    expect(run(() => patrol())).toEqual([]);
  });

  it("cites a ratioed post", () => {
    state.posts = [post(ALICE, { up: 1, down: 4 })];
    const [offence] = run(() => patrol());
    expect(offence.charge).toBe("EXCESSIVE CRINGE DISTRIBUTION");
    expect(offence.article).toBe("Article 3");
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
      post(ALICE, { text: "actually no", at: Date.now() - CLOCK.patrolWindow - 60_000 }),
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
    state.posts = [unlawful(ALICE)];
    expect(run(prosecuteWarnedCitizens)).toBe(true);
    expect(state.trials?.[0].defendant).toBe(ALICE);
  });

  it("names the article in the case file", () => {
    state.posts = [unlawful(ALICE)];
    run(prosecuteWarnedCitizens);
    expect(state.trials?.[0].description).toContain("Article 1");
  });

  it("gives the citizen a moment between the warning and the charge", () => {
    state.posts = [unlawful(ALICE, 0)];
    expect(run(prosecuteWarnedCitizens)).toBe(false);
  });

  it("still holds off just inside the grace period", () => {
    state.posts = [unlawful(ALICE, CLOCK.citationGrace / 2)];
    expect(run(prosecuteWarnedCitizens)).toBe(false);
  });

  it("runs one trial at a time", () => {
    state.posts = [unlawful(ALICE), unlawful(BOB)];
    run(prosecuteWarnedCitizens);
    run(prosecuteWarnedCitizens);
    expect(state.trials).toHaveLength(1);
  });

  it("withdraws the citation instead if the article has been repealed", () => {
    // The payoff of repeal: a prosecution already coming for you evaporates.
    state.posts = [unlawful(ALICE)];
    const logic = run(activeLaws).find((l) => l.article === 1)!;
    withState(state, () => {
      state.proposals!.push({
        id: "prop_repeal1", creator: BOB, title: "legalise logic", description: "enough",
        status: "enacted", yesVotes: [], noVotes: [], endsAt: 0, at: Date.now(),
        rule: { type: "repeal", target: logic.id },
      });
      enact(state.proposals!.find((p) => p.id === "prop_repeal1")!);
    });

    expect(run(prosecuteWarnedCitizens)).toBe(true);
    expect(state.trials ?? []).toHaveLength(0);
    expect(state.posts[0].replies.some((r) => r.text.startsWith("🕊️"))).toBe(true);
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
