import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "./db";
import {
  activeLaws,
  describeRule,
  enact,
  lawsInForceFor,
  seedFoundingArticles,
  violationOf,
} from "./constitution";
import { CONSTITUTIONAL_COURT } from "./systemAccounts";
import type { LawRule, NationState, Post, Proposal } from "./types";

let state: NationState;

const ALICE = "0xhuman0000000000000000000000000000aaa";

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: "post_" + Math.random().toString(36).slice(2, 9),
    author: ALICE,
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

function bill(rule: LawRule | undefined, overrides: Partial<Proposal> = {}): Proposal {
  return {
    id: "prop_" + Math.random().toString(36).slice(2, 9),
    creator: ALICE,
    title: "a bill",
    description: "because",
    status: "active",
    yesVotes: [],
    noVotes: [],
    endsAt: 0,
    at: Date.now(),
    rule,
    ...overrides,
  };
}

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[ALICE] = {
    address: ALICE,
    username: "Alice",
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI: false,
    joinedAt: 0,
  };
});

const run = <T,>(fn: () => T): T => withState(state, fn);

/** Pass a bill the way governance would: set status, then enact it. */
function pass(proposal: Proposal): string {
  state.proposals = [...(state.proposals ?? []), proposal];
  return run(() => {
    const p = state.proposals!.find((x) => x.id === proposal.id)!;
    p.status = "enacted";
    return enact(p);
  });
}

describe("the founding articles", () => {
  beforeEach(() => run(seedFoundingArticles));

  it("seeds three articles, numbered from one", () => {
    const laws = run(activeLaws);
    expect(laws.map((l) => l.article)).toEqual([1, 2, 3]);
  });

  it("is idempotent — booting twice does not duplicate the constitution", () => {
    run(seedFoundingArticles);
    run(seedFoundingArticles);
    expect(run(activeLaws)).toHaveLength(3);
  });

  it("attributes them to the court, not to a citizen", () => {
    expect(run(activeLaws).every((l) => l.creator === CONSTITUTIONAL_COURT)).toBe(true);
  });

  it("catches logic in a public space", () => {
    const v = run(() => violationOf(post({ text: "actually the numbers are fine" })));
    expect(v?.article).toBe(1);
    expect(v?.charge).toBe("USE OF A PROSCRIBED WORD");
  });

  it("leaves an ordinary post alone", () => {
    expect(run(() => violationOf(post({ text: "gm" })))).toBeNull();
  });
});

describe("rules the police can actually check", () => {
  const enforce = (rule: LawRule, p: Post) => {
    pass(bill(rule));
    return run(() => violationOf({ ...p, at: Date.now() + 1 }));
  };

  it("ban_word matches case-insensitively", () => {
    expect(enforce({ type: "ban_word", words: ["skibidi"] }, post({ text: "SKIBIDI toilet" }))).not.toBeNull();
  });

  it("ban_word ignores posts that don't contain it", () => {
    expect(enforce({ type: "ban_word", words: ["skibidi"] }, post({ text: "gm" }))).toBeNull();
  });

  it("require_image cites a text-only post", () => {
    expect(enforce({ type: "require_image" }, post({ image: null }))).not.toBeNull();
  });

  it("require_image passes a post with a picture", () => {
    expect(enforce({ type: "require_image" }, post({ image: "data:image/png;base64,x" }))).toBeNull();
  });

  it("min_length cites a short post", () => {
    expect(enforce({ type: "min_length", n: 20 }, post({ text: "gm" }))).not.toBeNull();
  });

  it("min_length exempts a post carrying a picture", () => {
    expect(
      enforce({ type: "min_length", n: 20 }, post({ text: "gm", image: "data:image/png;base64,x" }))
    ).toBeNull();
  });

  it("ratio_limit needs both the count and the ratio against you", () => {
    expect(enforce({ type: "ratio_limit", n: 3 }, post({ up: 0, down: 4 }))).not.toBeNull();
    expect(enforce({ type: "ratio_limit", n: 3 }, post({ up: 9, down: 4 }))).toBeNull();
  });

  it("post_limit counts the author's posts in the window", () => {
    pass(bill({ type: "post_limit", n: 2 }));
    const at = Date.now() + 1;
    state.posts = [post({ at }), post({ at }), post({ at })];
    expect(run(() => violationOf(state.posts[0]))).not.toBeNull();
  });

  it("post_limit leaves an author inside the limit alone", () => {
    pass(bill({ type: "post_limit", n: 5 }));
    const at = Date.now() + 1;
    state.posts = [post({ at }), post({ at })];
    expect(run(() => violationOf(state.posts[0]))).toBeNull();
  });
});

describe("laws do not reach backwards", () => {
  it("cannot cite a post published before the article existed", () => {
    const old = post({ text: "skibidi", at: Date.now() - 60_000 });
    state.posts = [old];
    pass(bill({ type: "ban_word", words: ["skibidi"] }));

    // Without this, enacting an article would criminalise the whole feed at once.
    expect(run(() => lawsInForceFor(old))).toHaveLength(0);
    expect(run(() => violationOf(old))).toBeNull();
  });

  it("does cite a post published after it", () => {
    pass(bill({ type: "ban_word", words: ["skibidi"] }));
    const fresh = post({ text: "skibidi", at: Date.now() + 1000 });
    expect(run(() => violationOf(fresh))).not.toBeNull();
  });
});

describe("repeal", () => {
  it("takes an article out of force", () => {
    const ban = bill({ type: "ban_word", words: ["skibidi"] });
    pass(ban);
    const offending = post({ text: "skibidi", at: Date.now() + 1000 });
    expect(run(() => violationOf(offending))).not.toBeNull();

    pass(bill({ type: "repeal", target: ban.id }));
    expect(run(() => violationOf(offending))).toBeNull();
  });

  it("can strike out a founding article — the square can legalise logic", () => {
    run(seedFoundingArticles);
    const logic = run(activeLaws).find((l) => l.article === 1)!;
    const offending = post({ text: "actually no", at: Date.now() + 1000 });
    expect(run(() => violationOf(offending))).not.toBeNull();

    pass(bill({ type: "repeal", target: logic.id }));
    expect(run(() => violationOf(offending))).toBeNull();
    expect(run(activeLaws).map((l) => l.article)).toEqual([2, 3]);
  });

  it("is a no-op against an article already repealed", () => {
    const ban = bill({ type: "ban_word", words: ["skibidi"] });
    pass(ban);
    pass(bill({ type: "repeal", target: ban.id }));
    const second = pass(bill({ type: "repeal", target: ban.id }));
    expect(second).toMatch(/no longer in force/i);
  });

  it("does not itself become an article", () => {
    const ban = bill({ type: "ban_word", words: ["skibidi"] });
    pass(ban);
    pass(bill({ type: "repeal", target: ban.id }));
    expect(run(activeLaws)).toHaveLength(0);
  });
});

describe("enactment", () => {
  it("numbers articles in the order they pass", () => {
    pass(bill({ type: "require_image" }));
    pass(bill({ type: "post_limit", n: 4 }));
    expect(run(activeLaws).map((l) => l.article)).toEqual([1, 2]);
  });

  it("does not reuse the number of a repealed article", () => {
    const first = bill({ type: "require_image" });
    pass(first);
    pass(bill({ type: "repeal", target: first.id }));
    pass(bill({ type: "post_limit", n: 4 }));
    // Article 1 is struck out, not vacated: the next law is Article 2, and
    // nothing is ever Article 1 again. Numbers are a record, not a slot machine —
    // a citation for "Article 1" has to mean one thing forever.
    expect(run(activeLaws).map((l) => l.article)).toEqual([2]);
  });

  it("does not spend an article number on a repeal bill", () => {
    const first = bill({ type: "ban_word", words: ["skibidi"] });
    pass(first);
    const repeal = bill({ type: "repeal", target: first.id });
    pass(repeal);
    // A repeal changes the constitution; it is not itself a clause of it.
    expect(state.proposals!.find((p) => p.id === repeal.id)!.article).toBeUndefined();
  });

  it("passes a rule-less bill as a resolution that binds nobody", () => {
    const outcome = pass(bill(undefined));
    expect(outcome).toMatch(/creates no enforceable duty/i);
    expect(run(activeLaws)).toHaveLength(0);
    expect(run(() => violationOf(post({ text: "anything at all" })))).toBeNull();
  });

  it("reports what changed, in words", () => {
    const outcome = pass(bill({ type: "ban_word", words: ["skibidi"] }));
    expect(outcome).toContain("Article 1");
    expect(outcome).toMatch(/not retroactive/i);
  });
});

describe("describeRule — a citizen has to know before they post", () => {
  it("spells out each rule", () => {
    expect(describeRule({ type: "ban_word", words: ["skibidi"] })).toContain('"skibidi"');
    expect(describeRule({ type: "post_limit", n: 3 })).toContain("3");
    expect(describeRule({ type: "require_image" })).toMatch(/picture/i);
    expect(describeRule({ type: "min_length", n: 20 })).toContain("20");
    expect(describeRule({ type: "ratio_limit", n: 5 })).toContain("5");
  });
});
