import { describe, it, expect } from "vitest";
import { groupFeed } from "./feed";
import { ELECTION_COMMISSION, SUPREME_COURT } from "./systemAccounts";
import type { Post } from "./types";

const HUMAN = "0xhuman00000000000000000000000000000aaa";

function post(id: string, author: string): Post {
  return {
    id,
    author,
    text: `post ${id}`,
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: 0,
  };
}

describe("groupFeed", () => {
  it("leaves ordinary posts alone", () => {
    const entries = groupFeed([post("a", HUMAN), post("b", HUMAN)]);
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.kind === "post")).toBe(true);
  });

  it("leaves a lone notice as a normal card — one decree is drama, not noise", () => {
    const entries = groupFeed([post("a", HUMAN), post("b", SUPREME_COURT), post("c", HUMAN)]);
    expect(entries.map((e) => e.kind)).toEqual(["post", "post", "post"]);
  });

  it("folds a run of consecutive notices into one entry", () => {
    const entries = groupFeed([
      post("a", HUMAN),
      post("b", SUPREME_COURT),
      post("c", ELECTION_COMMISSION),
      post("d", SUPREME_COURT),
      post("e", HUMAN),
    ]);
    expect(entries.map((e) => e.kind)).toEqual(["post", "notices", "post"]);
    const folded = entries[1];
    expect(folded.kind === "notices" && folded.posts.map((p) => p.id)).toEqual(["b", "c", "d"]);
  });

  it("folds a run that ends the feed", () => {
    const entries = groupFeed([post("a", HUMAN), post("b", SUPREME_COURT), post("c", SUPREME_COURT)]);
    expect(entries.map((e) => e.kind)).toEqual(["post", "notices"]);
  });

  it("folds a run that starts the feed", () => {
    const entries = groupFeed([post("a", SUPREME_COURT), post("b", SUPREME_COURT), post("c", HUMAN)]);
    expect(entries.map((e) => e.kind)).toEqual(["notices", "post"]);
  });

  it("keeps separate runs separate", () => {
    const entries = groupFeed([
      post("a", SUPREME_COURT),
      post("b", SUPREME_COURT),
      post("c", HUMAN),
      post("d", SUPREME_COURT),
      post("e", SUPREME_COURT),
    ]);
    expect(entries.map((e) => e.kind)).toEqual(["notices", "post", "notices"]);
  });

  it("never drops or reorders a post", () => {
    const input = [
      post("a", HUMAN),
      post("b", SUPREME_COURT),
      post("c", SUPREME_COURT),
      post("d", HUMAN),
      post("e", ELECTION_COMMISSION),
    ];
    const seen = groupFeed(input).flatMap((e) => (e.kind === "notices" ? e.posts : [e.post]));
    expect(seen.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"]);
  });

  it("handles an empty feed", () => {
    expect(groupFeed([])).toEqual([]);
  });
});
