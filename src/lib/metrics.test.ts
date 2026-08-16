import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate } from "./db";
import { computeMetrics, readiness } from "./metrics";
import { CYBER_POLICE, SUPREME_COURT, TREASURY } from "./systemAccounts";
import type { Citizen, NationState, Post, Trial } from "./types";

// A metric that flatters is worse than no metric, so these tests are mostly
// about the ways this could quietly overstate how well the country is doing.

let state: NationState;

const DAY = 24 * 60 * 60 * 1000;
const addr = (i: number) => `0xhuman${String(i).padStart(3, "0")}00000000000000000000000000`;

function citizen(address: string, joinedAt = Date.now()): Citizen {
  return {
    address,
    username: address.slice(0, 10),
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI: false,
    joinedAt,
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

function populate(n: number) {
  for (let i = 0; i < n; i++) state.citizens[addr(i)] = citizen(addr(i));
}

beforeEach(() => {
  state = migrate(freshState());
  state.founded = Date.now() - 3 * DAY;
  state.citizens[CYBER_POLICE] = { ...citizen(CYBER_POLICE), isAI: true };
  state.citizens[SUPREME_COURT] = { ...citizen(SUPREME_COURT), isAI: true };
});

const m = () => computeMetrics(state);

describe("the funnel counts people, not the government", () => {
  it("does not count state offices as citizens", () => {
    populate(3);
    expect(m().funnel.claimed).toBe(3);
  });

  it("does not count state notices as citizen posts", () => {
    populate(1);
    state.posts = [post(SUPREME_COURT), post(CYBER_POLICE), post(addr(0))];
    const metrics = m();
    expect(metrics.feed.byCitizens).toBe(1);
    expect(metrics.feed.byState).toBe(2);
    // A square that is mostly government notices is a waiting room, and the
    // number has to be able to say so.
    expect(metrics.feed.citizenShare).toBeCloseTo(0.333, 2);
  });

  it("counts a citizen as noticed only once the state actually acted", () => {
    populate(2);
    state.posts = [
      post(addr(0), { replies: [{ author: CYBER_POLICE, text: "⚠️", at: Date.now() }] }),
      post(addr(1)),
    ];
    expect(m().funnel.noticed).toBe(1);
  });

  it("counts a defendant as noticed even if the citation has scrolled away", () => {
    populate(1);
    state.trials = [{ defendant: addr(0), status: "resolved" } as unknown as Trial];
    expect(m().funnel.noticed).toBe(1);
  });

  it("counts governing as voting or legislating, not merely posting", () => {
    populate(3);
    state.posts = [post(addr(0)), post(addr(1)), post(addr(2))];
    expect(m().funnel.governed).toBe(0);

    state.proposals = [
      {
        id: "prop_1",
        creator: addr(0),
        title: "t",
        description: "d",
        status: "active",
        yesVotes: [addr(1)],
        noVotes: [],
        endsAt: 0,
        at: 0,
      },
    ];
    // The proposer and the voter, not the bystander.
    expect(m().funnel.governed).toBe(2);
  });
});

describe("returning is the only honest retention signal", () => {
  it("does not count a citizen who was only ever here once", () => {
    populate(1);
    state.posts = [post(addr(0))];
    expect(m().funnel.returned).toBe(0);
  });

  it("does not count two actions on the same day as returning", () => {
    populate(1);
    state.posts = [post(addr(0)), post(addr(0))];
    expect(m().funnel.returned).toBe(0);
  });

  it("counts a citizen active on a different day", () => {
    state.citizens[addr(0)] = citizen(addr(0), Date.now() - 2 * DAY);
    state.posts = [post(addr(0), { at: Date.now() })];
    expect(m().funnel.returned).toBe(1);
  });

  it("ignores the state's own activity when deciding who returned", () => {
    populate(1);
    state.posts = [
      post(SUPREME_COURT, { at: Date.now() - 2 * DAY }),
      post(SUPREME_COURT, { at: Date.now() }),
    ];
    expect(m().funnel.returned).toBe(0);
  });
});

describe("the law and the docket", () => {
  it("separates articles citizens passed from the founding ones", () => {
    populate(1);
    state.proposals = [
      { id: "p1", creator: "0xai_constitutionalcourt0000000000court", title: "founding", description: "", status: "enacted", yesVotes: [], noVotes: [], endsAt: 0, at: 0, article: 1, rule: { type: "require_image" } },
      { id: "p2", creator: addr(0), title: "mine", description: "", status: "enacted", yesVotes: [], noVotes: [], endsAt: 0, at: 0, article: 2, rule: { type: "require_image" } },
    ];
    const metrics = m();
    expect(metrics.law.articlesInForce).toBe(2);
    // The differentiator is whether *citizens* legislate, so the founding
    // articles must not be allowed to flatter that number.
    expect(metrics.law.passedByCitizens).toBe(1);
  });

  it("does not count a withdrawn citation as enforcement", () => {
    populate(1);
    state.posts = [
      post(addr(0), {
        replies: [
          { author: CYBER_POLICE, text: "⚠️ CITATION", at: Date.now() },
          { author: CYBER_POLICE, text: "🕊️ CITATION WITHDRAWN", at: Date.now() },
        ],
      }),
    ];
    expect(m().enforcement.citations).toBe(1);
  });

  it("reports what share of trials a jury actually decided", () => {
    populate(1);
    state.trials = [
      { status: "resolved", benchVerdict: true, defendant: addr(0) },
      { status: "resolved", benchVerdict: false, defendant: addr(0) },
      { status: "voting", defendant: addr(0) },
    ] as unknown as Trial[];
    expect(m().enforcement.juryShare).toBe(0.5);
  });
});

describe("the economy excludes the ministries", () => {
  it("does not count treasury float as circulating", () => {
    populate(1);
    state.balances = { [addr(0)]: 250, [TREASURY]: 1_000_000 };
    expect(m().economy.circulating).toBe(250);
  });
});

describe("readiness refuses to guess", () => {
  it("says no-data rather than inventing a rate from four people", () => {
    populate(4);
    expect(readiness(m()).verdict).toBe("no-data");
  });

  it("calls it cold when citizens claim and never post", () => {
    populate(20);
    expect(readiness(m()).verdict).toBe("cold");
  });

  it("names the government as the missing step when nobody is ever cited", () => {
    populate(20);
    state.posts = Array.from({ length: 20 }, (_, i) => post(addr(i)));
    const r = readiness(m());
    expect(r.verdict).toBe("cold");
    expect(r.bottleneck).toMatch(/never meeting the government/i);
  });

  it("calls it warming when people show up but do not come back", () => {
    populate(20);
    state.posts = Array.from({ length: 20 }, (_, i) =>
      post(addr(i), { replies: [{ author: CYBER_POLICE, text: "⚠️", at: Date.now() }] })
    );
    expect(readiness(m()).verdict).toBe("warming");
  });
});
