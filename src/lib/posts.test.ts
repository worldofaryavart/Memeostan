import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { ledger } from "./ledger";
import { createPost, vote, boostPost } from "./posts";
import { RATES } from "./economy";

const AUTHOR = "0xauthor00000000000000000000000000000aaa";
const VOTER = "0xvoter000000000000000000000000000000bbb";

beforeEach(() => {
  db.reset();
  db.update((s) => {
    s.citizens[AUTHOR] = {
      address: AUTHOR, username: "author", faction: "Sigma", pfp: "🗿",
      aura: 1000, isAI: false, joinedAt: 0,
    };
    s.balances[AUTHOR] = 0;
  });
});

describe("createPost economics", () => {
  it("mints the post reward for a real post", () => {
    createPost({ author: AUTHOR, text: "a genuine banger about naps" });
    expect(ledger.balanceOf(AUTHOR)).toBe(RATES.POST);
  });

  it("applies the spam tax to a low-effort post", () => {
    db.update((s) => { s.balances[AUTHOR] = 100; });
    createPost({ author: AUTHOR, text: "k" }); // < 4 chars, no image
    expect(ledger.balanceOf(AUTHOR)).toBe(100 - RATES.SPAM_TAX);
  });
});

describe("vote economics", () => {
  it("upvotes mint a reward to the author", () => {
    const p = createPost({ author: AUTHOR, text: "real content here" });
    const before = ledger.balanceOf(AUTHOR);
    vote(p.id, VOTER, "up");
    expect(ledger.balanceOf(AUTHOR)).toBe(before + RATES.UPVOTE_REWARD);
  });

  it("re-casting the same vote toggles it off", () => {
    const p = createPost({ author: AUTHOR, text: "real content here" });
    vote(p.id, VOTER, "up");
    vote(p.id, VOTER, "up");
    const fresh = db.get().posts.find((x) => x.id === p.id)!;
    expect(fresh.up).toBe(0);
    expect(fresh.voters[VOTER]).toBeUndefined();
  });

  it("downvotes burn from the author (ratio tax)", () => {
    const p = createPost({ author: AUTHOR, text: "real content here" });
    const before = ledger.balanceOf(AUTHOR);
    vote(p.id, VOTER, "down");
    expect(ledger.balanceOf(AUTHOR)).toBe(before - RATES.DOWNVOTE_BURN);
  });
});

describe("daily mint limits and dilution decay", () => {
  it("enforces daily mint cap of 500 MMC", () => {
    // Author has 0 balance, let's post multiple times
    // Each real post should reward 50 MMC. 10 posts = 500 MMC.
    for (let i = 0; i < 11; i++) {
      createPost({ author: AUTHOR, text: `post number ${i} with long text to avoid spam tax` });
    }
    // Circulating supply or balance of AUTHOR should cap at 500 MMC
    expect(ledger.balanceOf(AUTHOR)).toBe(500);
  });

  it("applies dilution decay to post rewards", () => {
    // Increase dilution by having many downvoted posts
    db.update((s) => {
      s.posts = Array.from({ length: 10 }, (_, i) => ({
        id: `cringe_${i}`,
        author: VOTER,
        text: "bad",
        image: null,
        up: 0,
        down: 5,
        voters: {},
        replies: [],
        at: Date.now(),
      }));
    });
    // This makes ratio = 1.0 (100% cringe posts)
    // dilution should be ratio * 60 + supplyPressure * 40 => 60%
    // 60% dilution means post reward decays to 40% of 50 MMC = 20 MMC.
    const p = createPost({ author: AUTHOR, text: "good post here indeed" });
    // Dilution decay: 10/11 cringe posts, approx 54.5% dilution. Math.round(50 * (1 - 0.545)) = 23.
    expect(ledger.balanceOf(AUTHOR)).toBe(23);
  });
});

describe("post boosting", () => {
  it("allows boosting a post by burning 50 MMC", () => {
    db.update((s) => { s.balances[AUTHOR] = 100; });
    const p = createPost({ author: AUTHOR, text: "post to boost" });
    // createPost rewarded 50 MMC, so balance is 100 + 50 = 150 MMC.
    const res = boostPost(p.id, AUTHOR);
    expect(res.ok).toBe(true);
    expect(ledger.balanceOf(AUTHOR)).toBe(100); // 150 - 50 = 100 MMC
    const fresh = db.get().posts.find((x) => x.id === p.id)!;
    expect(fresh.boosts).toBe(1);
  });
});

