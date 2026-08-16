import { describe, it, expect, beforeEach } from "vitest";
import { applyAction, type ActionEnvelope } from "./actions";
import { freshState, migrate, withState } from "./db";
import { ledger } from "./ledger";
import { RATES } from "./economy";
import { getStoreItem } from "./market";
import type { NationState } from "./types";

const ALICE = "0xalice00000000000000000000000000000aaa";
const BOB = "0xbob0000000000000000000000000000000bbb";
const AI = "0xai_gigachad000000000000000000gigachad";

let state: NationState;

function citizen(address: string, over: Record<string, unknown> = {}) {
  return {
    address,
    username: address.slice(2, 7),
    faction: "Sigma",
    pfp: "🗿",
    aura: 1000,
    isAI: false,
    joinedAt: 0,
    city: "Brainrot City",
    pubKey: { kty: "EC" as const, crv: "P-256" as const, x: "x", y: "y" },
    ...over,
  };
}

beforeEach(() => {
  state = migrate(freshState());
  state.citizens[ALICE] = citizen(ALICE);
  state.citizens[BOB] = citizen(BOB);
  state.citizens[AI] = citizen(AI, { isAI: true, username: "GigaChad GPT" });
  state.balances[ALICE] = 1000;
  state.balances[BOB] = 1000;
  state.balances[AI] = 1000;
});

/** Apply an action against the test state the way the server route would. */
function run(type: string, payload: Record<string, unknown>, actor = ALICE) {
  const envelope: ActionEnvelope = {
    type,
    payload,
    address: actor,
    nonce: "test-nonce-0000",
    ts: Date.now(),
  };
  return withState(state, () => applyAction(envelope));
}

describe("unknown actions", () => {
  it("are refused", () => {
    expect(run("nation.selfDestruct", {}).ok).toBe(false);
  });
});

describe("payload validation", () => {
  it("rejects a post with neither words nor a picture", () => {
    const res = run("post.create", { id: "post_abc123", text: "   " });
    expect(res.ok).toBe(false);
  });

  it("rejects an oversized post", () => {
    const res = run("post.create", { id: "post_abc123", text: "x".repeat(601) });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/too long/);
  });

  it("rejects a malformed id", () => {
    expect(run("post.create", { id: "../../etc/passwd", text: "hi there" }).ok).toBe(false);
  });

  it("rejects a non-image data URL", () => {
    const res = run("post.create", {
      id: "post_abc123",
      text: "hi",
      image: "data:text/html;base64,PHNjcmlwdD4=",
    });
    expect(res.ok).toBe(false);
  });

  it("rejects an unknown vote direction", () => {
    run("post.create", { id: "post_abc123", text: "a real banger about naps" });
    expect(run("post.vote", { postId: "post_abc123", dir: "sideways" }).ok).toBe(false);
  });

  it("rejects a faction that isn't real", () => {
    const res = run("citizen.register", { username: "x", faction: "Wizard" }, "0xnew");
    expect(res.ok).toBe(false);
  });
});

describe("MMC transfers", () => {
  it("moves money between citizens", () => {
    const before = ledger.balanceOf.call(null, BOB);
    const res = run("mmc.transfer", { to: BOB, amount: 100, memo: "here you go" });
    expect(res.ok).toBe(true);
    expect(withState(state, () => ledger.balanceOf(BOB))).toBeGreaterThan(before);
  });

  it("refuses more than you hold", () => {
    const res = run("mmc.transfer", { to: BOB, amount: 999_999 });
    expect(res.ok).toBe(false);
    expect(withState(state, () => ledger.balanceOf(ALICE))).toBe(1000);
  });

  it("refuses negative and fractional amounts — no minting by arithmetic", () => {
    expect(run("mmc.transfer", { to: BOB, amount: -500 }).ok).toBe(false);
    expect(run("mmc.transfer", { to: BOB, amount: 1.5 }).ok).toBe(false);
    expect(run("mmc.transfer", { to: BOB, amount: "100; DROP" }).ok).toBe(false);
  });

  it("refuses sending to yourself", () => {
    expect(run("mmc.transfer", { to: ALICE, amount: 10 }).ok).toBe(false);
  });

  it("refuses sending to an address with no citizen", () => {
    expect(run("mmc.transfer", { to: "0xnobody000000000000000000000000000nope", amount: 10 }).ok).toBe(false);
  });
});

describe("tipping", () => {
  beforeEach(() => {
    withState(state, () => {
      state.posts.unshift({
        id: "post_bobpost",
        author: BOB,
        text: "bob's banger",
        image: null,
        up: 0,
        down: 0,
        voters: {},
        replies: [],
        at: Date.now(),
      });
    });
  });

  it("sends exactly the server's tip amount, not the caller's", () => {
    const before = withState(state, () => ledger.balanceOf(ALICE));
    // A caller-supplied amount must be ignored entirely.
    const res = run("post.tip", { postId: "post_bobpost", amount: 999_999 });
    expect(res.ok).toBe(true);
    const spent = before - withState(state, () => ledger.balanceOf(ALICE));
    expect(spent).toBe(RATES.TIP);
  });

  it("refuses tipping your own post", () => {
    withState(state, () => {
      state.posts[0].author = ALICE;
    });
    expect(run("post.tip", { postId: "post_bobpost" }).ok).toBe(false);
  });
});

describe("the store", () => {
  it("charges the catalog price, whatever the payload claims", () => {
    const item = getStoreItem("badge_brainrot_veteran")!;
    const before = withState(state, () => ledger.balanceOf(ALICE));
    const res = run("market.buy", { itemId: item.id, price: 1 });
    expect(res.ok).toBe(true);
    expect(before - withState(state, () => ledger.balanceOf(ALICE))).toBe(item.price);
  });

  it("refuses items that don't exist", () => {
    expect(run("market.buy", { itemId: "badge_freemoney" }).ok).toBe(false);
  });

  it("refuses a second purchase of the same item", () => {
    run("market.buy", { itemId: "badge_brainrot_veteran" });
    expect(run("market.buy", { itemId: "badge_brainrot_veteran" }).ok).toBe(false);
  });

  it("refuses equipping something you don't own", () => {
    const res = run("citizen.equip", { itemId: "border_gold_foil", equip: true });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/don't own/);
  });

  it("equips an item once it's bought", () => {
    run("market.buy", { itemId: "border_gold_foil" });
    const res = run("citizen.equip", { itemId: "border_gold_foil", equip: true });
    expect(res.ok).toBe(true);
    expect(state.citizens[ALICE].equippedBorder).toBe("border_gold_foil");
  });
});

describe("idempotency", () => {
  it("a replayed post.create doesn't duplicate the post", () => {
    run("post.create", { id: "post_abc123", text: "a real banger about naps" });
    run("post.create", { id: "post_abc123", text: "a real banger about naps" });
    expect(state.posts.filter((p) => p.id === "post_abc123")).toHaveLength(1);
  });
});

describe("registration", () => {
  it("refuses to re-register an existing citizenship", () => {
    const envelope: ActionEnvelope = {
      type: "citizen.register",
      payload: { username: "impostor", faction: "Sigma" },
      address: ALICE,
      nonce: "n",
      ts: Date.now(),
      pubKey: { kty: "EC", crv: "P-256", x: "x", y: "y" },
    };
    expect(withState(state, () => applyAction(envelope)).ok).toBe(false);
  });

  it("pays the welcome grant to a genuinely new citizen", () => {
    const NEW = "0xnewcitizen0000000000000000000000new";
    const envelope: ActionEnvelope = {
      type: "citizen.register",
      payload: { username: "newbie", faction: "NPC", city: "Napistan" },
      address: NEW,
      nonce: "n",
      ts: Date.now(),
      pubKey: { kty: "EC", crv: "P-256", x: "x", y: "y" },
    };
    const res = withState(state, () => applyAction(envelope));
    expect(res.ok).toBe(true);
    expect(withState(state, () => ledger.balanceOf(NEW))).toBe(RATES.WELCOME_GRANT);
  });
});

describe("the nap widget", () => {
  it("grants aura, then enforces its own cooldown", () => {
    const first = run("nap.complete", {});
    expect(first.ok).toBe(true);
    expect(state.citizens[ALICE].aura).toBe(1010);

    // A client-side timer is a suggestion; the server keeps the actual clock.
    const second = run("nap.complete", {});
    expect(second.ok).toBe(false);
    expect(state.citizens[ALICE].aura).toBe(1010);
  });
});

describe("retired actions", () => {
  it("no longer knows how to wage war between cities", () => {
    // city.skirmish is gone with the territory system. Asserting the action is
    // unknown rather than deleting the test keeps the removal deliberate: if it
    // ever comes back it should come back on purpose.
    const res = run("city.skirmish", {
      attackerCity: "Brainrot City",
      defenderCity: "Rizzland",
      skirmishId: "skm_abc123",
    });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Unknown action/);
  });

  it("no longer lets a citizen buy a minister's vote", () => {
    // minister.bribe went with the AI-citizen layer; the civil service has no
    // vote to sell.
    const res = run("minister.bribe", { proposalId: "prop_x", ministerAddress: ALICE });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/Unknown action/);
  });
});

describe("trials", () => {
  it("refuses self-prosecution", () => {
    const res = run("trial.file", {
      trialId: "trial_abc123",
      postId: "post_abc123",
      defendant: ALICE,
      charge: "BEING CRINGE",
      description: "I did it and I would do it again",
    });
    expect(res.ok).toBe(false);
  });
});

describe("world.tick", () => {
  it("is a no-op when called again immediately, so extra tabs cost nothing", () => {
    const first = withState(state, () =>
      applyAction({ type: "world.tick", payload: {}, address: "", nonce: "a", ts: Date.now() })
    );
    expect(first.commit).not.toBe(false);

    const second = withState(state, () =>
      applyAction({ type: "world.tick", payload: {}, address: "", nonce: "b", ts: Date.now() })
    );
    expect(second.commit).toBe(false);
  });
});
