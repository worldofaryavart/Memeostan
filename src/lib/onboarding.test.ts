import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "./db";
import { seedFoundingArticles } from "./constitution";
import { proclaimConstitution, welcomeCitizen } from "./onboarding";
import { registerCitizen, nextCitizenNumber } from "./citizens";
import { REGISTRAR } from "./systemAccounts";
import type { NationState } from "./types";
import type { PublicKeyJwk } from "./crypto";

// The first thirty seconds are the whole retention problem. If a citizen claims
// a passport and nothing happens to them, there is no country — just a form.

let state: NationState;

const PUBKEY = { kty: "EC", crv: "P-256", x: "x", y: "y" } as unknown as PublicKeyJwk;

function claim(address: string, username: string) {
  return withState(state, () =>
    registerCitizen({ address, pubKey: PUBKEY, username, faction: "Sigma" })
  );
}

beforeEach(() => {
  state = migrate(freshState());
  withState(state, () => seedFoundingArticles());
});

const run = <T,>(fn: () => T): T => withState(state, fn);

describe("national ID numbers", () => {
  it("starts at one", () => {
    expect(run(nextCitizenNumber)).toBe(1);
    expect(claim("0xa", "Alice").citizenNo).toBe(1);
  });

  it("increments per citizen", () => {
    claim("0xa", "Alice");
    claim("0xb", "Bob");
    expect(state.citizens["0xb"].citizenNo).toBe(2);
  });

  it("never reuses a number, so #1 means #1 forever", () => {
    claim("0xa", "Alice");
    claim("0xb", "Bob");
    delete state.citizens["0xa"]; // a citizen renounces
    expect(run(nextCitizenNumber)).toBe(3);
  });
});

describe("the Registrar's welcome", () => {
  it("is posted by the Bureau of Citizenship", () => {
    const citizen = claim("0xa", "Alice");
    run(() => welcomeCitizen(citizen));
    expect(state.posts[0].author).toBe(REGISTRAR);
  });

  it("issues them a national ID", () => {
    const citizen = claim("0xa", "Alice");
    run(() => welcomeCitizen(citizen));
    expect(state.posts[0].text).toContain("MMS-0001");
    expect(state.posts[0].text).toContain("@Alice");
  });

  it("serves every article in force on them", () => {
    const citizen = claim("0xa", "Alice");
    run(() => welcomeCitizen(citizen));
    const text = state.posts[0].text;
    // Ignorance is not a defence, so the state has to have actually told them.
    expect(text).toContain("Logic is banned in public spaces");
    expect(text).toContain("The commons shall not be flooded");
    expect(text).toContain("Cringe shall not be distributed");
  });

  it("tells them they can change the law, and what it takes", () => {
    const citizen = claim("0xa", "Alice");
    run(() => welcomeCitizen(citizen));
    expect(state.posts[0].text).toMatch(/table a bill/i);
    expect(state.posts[0].text).toMatch(/1 citizen must vote/i);
  });

  it("marks the founding citizen as the founding citizen", () => {
    const citizen = claim("0xa", "Alice");
    run(() => welcomeCitizen(citizen));
    expect(state.posts[0].text).toMatch(/first citizen of Memeostan/i);
  });

  it("does not claim the second citizen is the first", () => {
    claim("0xa", "Alice");
    const bob = claim("0xb", "Bob");
    run(() => welcomeCitizen(bob));
    expect(state.posts[0].text).not.toMatch(/first citizen/i);
    expect(state.posts[0].text).toMatch(/2nd citizen/);
  });

  it("uses the caller's post id so the optimistic copy matches the committed one", () => {
    const citizen = claim("0xa", "Alice");
    const id = run(() => welcomeCitizen(citizen, "post_welcome1"));
    expect(id).toBe("post_welcome1");
    expect(state.posts[0].id).toBe("post_welcome1");
  });
});

describe("proclaiming the constitution", () => {
  it("puts the articles in the square so the feed is never a blank wall", () => {
    run(proclaimConstitution);
    expect(state.posts[0].text).toContain("THE CONSTITUTION OF MEMEOSTAN");
    expect(state.posts[0].text).toContain("Logic is banned in public spaces");
  });

  it("says who writes the law and who only enforces it", () => {
    run(proclaimConstitution);
    expect(state.posts[0].text).toMatch(/government writes none of it/i);
  });

  it("is idempotent — booting twice does not repost it", () => {
    run(proclaimConstitution);
    run(proclaimConstitution);
    run(proclaimConstitution);
    expect(state.posts.filter((p) => p.text.includes("THE CONSTITUTION"))).toHaveLength(1);
  });

  it("stays quiet when there is no constitution to proclaim", () => {
    state = migrate(freshState());
    run(proclaimConstitution);
    expect(state.posts).toHaveLength(0);
  });
});
