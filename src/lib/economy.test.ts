import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { vibeOf, grossDomesticBrainrot, memeDilution } from "./economy";
import type { Post } from "./types";

function post(over: Partial<Post> = {}): Post {
  return {
    id: "p" + Math.random().toString(36).slice(2, 8),
    author: "0xauthor",
    text: "gm",
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
    ...over,
  };
}

beforeEach(() => db.clearLocal());

describe("vibeOf", () => {
  it("rewards upvotes (2x) and punishes downvotes (3x)", () => {
    expect(vibeOf(post({ up: 10, down: 0 }))).toBe(20);
    expect(vibeOf(post({ up: 0, down: 4 }))).toBe(-12);
    expect(vibeOf(post({ up: 5, down: 2 }))).toBe(4);
  });
});

describe("grossDomesticBrainrot", () => {
  it("is zero for an empty nation", () => {
    expect(grossDomesticBrainrot()).toBe(0);
  });

  it("scales with posts, engagement, and tx velocity", () => {
    db.update((s) => {
      s.posts = [post({ up: 3, down: 1 }), post({ up: 0, down: 0 })];
      s.txs = [
        { id: "t1", type: "mint", from: "x", to: "y", amount: 1, memo: "", at: 0 },
      ];
    });
    // 2 posts*100 + 4 engagement*25 + 1 velocity*10
    expect(grossDomesticBrainrot()).toBe(200 + 100 + 10);
  });
});

describe("memeDilution", () => {
  it("is zero with no posts", () => {
    expect(memeDilution()).toBe(0);
  });

  it("rises as more posts are net-downvoted (cringe)", () => {
    db.update((s) => {
      s.posts = [post({ up: 0, down: 5 }), post({ up: 9, down: 0 })];
    });
    // half the posts are cringe → ratio 0.5 * 60 = 30 (supply pressure ~0)
    expect(memeDilution()).toBeCloseTo(30, 0);
  });
});
