import { describe, it, expect, beforeEach } from "vitest";
import { freshState, migrate, withState } from "@/lib/db";
import { AI_CAST_SIZE, needsMoreAI, shouldStartCampaignPost } from "./world";
import {
  CONSTITUTIONAL_COURT,
  CYBER_POLICE,
  ELECTION_COMMISSION,
  SUPREME_COURT,
} from "@/lib/systemAccounts";
import type { Citizen, NationState, Post } from "@/lib/types";

let state: NationState;

function citizen(address: string, isAI: boolean): Citizen {
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

function post(author: string, minutesAgo = 0): Post {
  return {
    id: "post_" + Math.random().toString(36).slice(2, 9),
    author,
    text: "words",
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now() - minutesAgo * 60_000,
  };
}

const HUMAN = "0xhuman0000000000000000000000000000aaa";
const BOT = "0xai_bot000000000000000000000000000bbb";

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[HUMAN] = citizen(HUMAN, false);
  state.citizens[BOT] = citizen(BOT, true);
  state.citizens[SUPREME_COURT] = citizen(SUPREME_COURT, true);
});

const run = <T,>(fn: () => T): T => withState(state, fn);

describe("shouldStartCampaignPost — perform to an empty room, listen to a full one", () => {
  it("posts into a silent square", () => {
    expect(run(shouldStartCampaignPost)).toBe(true);
  });

  it("still posts when only one human has spoken recently", () => {
    state.posts = [post(HUMAN, 1)];
    expect(run(shouldStartCampaignPost)).toBe(true);
  });

  it("stands down once humans are actually talking", () => {
    state.posts = [post(HUMAN, 1), post(HUMAN, 3)];
    expect(run(shouldStartCampaignPost)).toBe(false);
  });

  it("ignores human posts that have gone stale", () => {
    state.posts = [post(HUMAN, 30), post(HUMAN, 45)];
    expect(run(shouldStartCampaignPost)).toBe(true);
  });

  it("does not count bots as company", () => {
    state.posts = [post(BOT, 1), post(BOT, 2), post(BOT, 3)];
    // Bot chatter is not a reason to stand down — but see the saturation guard.
    state.posts = [post(BOT, 1), post(BOT, 2)];
    expect(run(shouldStartCampaignPost)).toBe(true);
  });

  it("does not count the state's own paperwork as company", () => {
    state.posts = [post(SUPREME_COURT, 1), post(SUPREME_COURT, 2)];
    expect(run(shouldStartCampaignPost)).toBe(true);
  });

  it("stops when the recent feed has become almost entirely machine", () => {
    state.posts = Array.from({ length: 10 }, (_, i) => post(BOT, i));
    expect(run(shouldStartCampaignPost)).toBe(false);
  });

  it("keeps going when humans hold a decent share of the recent feed", () => {
    state.posts = [
      ...Array.from({ length: 5 }, (_, i) => post(BOT, i + 20)),
      ...Array.from({ length: 4 }, (_, i) => post(HUMAN, i + 30)),
    ];
    expect(run(shouldStartCampaignPost)).toBe(true);
  });
});

describe("needsMoreAI — a fixed cast, not a multiple of the population", () => {
  it("recruits while the cast is short", () => {
    expect(run(needsMoreAI)).toBe(true);
  });

  it("stops once the cast is full", () => {
    for (let i = 0; i < AI_CAST_SIZE; i++) {
      const address = `0xai_cast${i}00000000000000000000000000`;
      state.citizens[address] = citizen(address, true);
    }
    expect(run(needsMoreAI)).toBe(false);
  });

  it("does not count the courts and the commission as cast members", () => {
    // One short of a full cast (BOT from beforeEach is the first)...
    for (let i = 0; i < AI_CAST_SIZE - 2; i++) {
      const address = `0xai_cast${i}00000000000000000000000000`;
      state.citizens[address] = citizen(address, true);
    }
    // ...and a pile of state accounts, which must not fill the gap.
    for (const address of [ELECTION_COMMISSION, CONSTITUTIONAL_COURT, CYBER_POLICE]) {
      state.citizens[address] = citizen(address, true);
    }
    expect(run(needsMoreAI)).toBe(true);
  });

  it("does not grow with the human population — the old rule did", () => {
    for (let i = 0; i < AI_CAST_SIZE; i++) {
      const address = `0xai_cast${i}00000000000000000000000000`;
      state.citizens[address] = citizen(address, true);
    }
    for (let i = 0; i < 50; i++) {
      const address = `0xhuman${i}0000000000000000000000000000`;
      state.citizens[address] = citizen(address, false);
    }
    expect(run(needsMoreAI)).toBe(false);
  });
});
