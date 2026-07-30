// actions.ts — everything a citizen is allowed to do, and nothing else.
//
// This is the security boundary of the nation. An action is an *intent*: "I want
// to vote on this post". The client can only ask; this registry decides what
// actually happens, and it is the same code on both sides:
//
//   • server (/api/action) — authoritative. Runs after the signature is verified,
//     and the result is what gets persisted.
//   • client (actionClient.ts) — optimistic preview, so the UI responds instantly.
//     Anything it gets wrong is corrected when the canonical state comes back.
//
// Rules for anything added here:
//   1. Handlers must be SYNCHRONOUS (see the invariant in db.ts).
//   2. Never trust a number, a length, or a price from the payload. Costs come
//      from the server-side catalog/RATES, never from the caller.
//   3. Actions are keyed by the *authenticated* actor, never by an address in the
//      payload.

import { db } from "./db";
import { ledger } from "./ledger";
import {
  adjustAura,
  getCitizen,
  registerCitizen,
  upgradeCitizenKey,
} from "./citizens";
import { createPost, getPost, vote as votePost, boostPost } from "./posts";
import { governance } from "./governance";
import { elections } from "./elections";
import { fileCharge, resolveTrials, voteOnTrial } from "./judiciary";
import { launchSkirmish } from "./territory";
import { buyCosmetic, equipCosmetic } from "./market";
import { bribeMinister, persuadeMinister } from "./lobbying";
import { recordGdbSnapshot, RATES } from "./economy";
import { ALL_CITIES } from "./cities";
import { FACTIONS } from "./citizens";
import { isValidPublicKey, type PublicKeyJwk } from "./crypto";

// ── the wire format ──────────────────────────────────────────────────────────

export interface ActionEnvelope {
  type: string;
  payload: Record<string, unknown>;
  /** The acting citizen. Empty for unsigned world maintenance. */
  address: string;
  nonce: string;
  ts: number;
  /** ECDSA signature over actionMessage(). Required for every signed action. */
  sig?: string;
  /** One-time HMAC proof used only by citizen.upgradeKey. */
  legacyProof?: string;
  /** Public key being registered (citizen.register / citizen.upgradeKey). */
  pubKey?: PublicKeyJwk;
  /**
   * The revision the caller already holds. Purely an optimisation hint: if the
   * nation is still at this revision afterwards, the response omits the state
   * instead of shipping a copy the caller already has.
   */
  sinceRev?: number;
}

export interface ActionResult {
  ok: boolean;
  reason?: string;
  data?: Record<string, unknown>;
  /** false = nothing changed; the server should not bump the revision or write. */
  commit?: boolean;
}

interface ActionContext {
  actor: string;
  payload: Record<string, unknown>;
  envelope: ActionEnvelope;
}

interface ActionDef {
  /**
   * true  — must carry a valid signature from `address`, and that citizen must exist.
   * false — unsigned. Only for idempotent, time-gated world maintenance that
   *         cannot be steered by the caller.
   */
  signed: boolean;
  /** Self-authenticating actions verify their own key material in the route. */
  bootstrap?: boolean;
  run(ctx: ActionContext): ActionResult;
}

// ── payload validation ───────────────────────────────────────────────────────

const LIMITS = {
  POST_TEXT: 600,
  IMAGE_CHARS: 250_000, // ~180KB of base64; the whole nation is one document
  TITLE: 120,
  DESCRIPTION: 800,
  USERNAME: 24,
  MEMO: 80,
  CHARGE: 80,
};

class Invalid extends Error {}

function str(payload: Record<string, unknown>, key: string, maxLen: number): string {
  const value = payload[key];
  if (typeof value !== "string") throw new Invalid(`${key} must be text`);
  const trimmed = value.trim();
  if (!trimmed) throw new Invalid(`${key} cannot be empty`);
  if (trimmed.length > maxLen) throw new Invalid(`${key} is too long (max ${maxLen})`);
  return trimmed;
}

function optionalStr(
  payload: Record<string, unknown>,
  key: string,
  maxLen: number
): string | undefined {
  const value = payload[key];
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") throw new Invalid(`${key} must be text`);
  if (value.length > maxLen) throw new Invalid(`${key} is too long (max ${maxLen})`);
  return value.trim();
}

// Row ids and catalog ids: a lowercase prefix, then alphanumerics and underscores
// (store items look like `badge_brainrot_veteran`). Deliberately narrow so an id can
// never carry path separators or anything that isn't a plain key.
function id(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !/^[a-z]+_[a-zA-Z0-9_]{1,48}$/.test(value)) {
    throw new Invalid(`${key} is not a valid id`);
  }
  return value;
}

function address(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || !/^0x[a-zA-Z0-9_]{4,60}$/.test(value)) {
    throw new Invalid(`${key} is not a valid address`);
  }
  return value;
}

function positiveInt(payload: Record<string, unknown>, key: string, max: number): number {
  const value = payload[key];
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || Math.floor(n) !== n || n <= 0) {
    throw new Invalid(`${key} must be a whole number above zero`);
  }
  if (n > max) throw new Invalid(`${key} is above the limit of ${max}`);
  return n;
}

function oneOf<T extends string>(
  payload: Record<string, unknown>,
  key: string,
  allowed: readonly T[]
): T {
  const value = payload[key];
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new Invalid(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return value as T;
}

function bool(payload: Record<string, unknown>, key: string): boolean {
  return payload[key] === true;
}

function imageDataUrl(payload: Record<string, unknown>): string | null {
  const value = payload.image;
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new Invalid("image must be a data URL");
  if (!/^data:image\/(png|jpeg|jpg|gif|webp);base64,/.test(value)) {
    throw new Invalid("image must be a base64 PNG, JPEG, GIF or WEBP data URL");
  }
  if (value.length > LIMITS.IMAGE_CHARS) throw new Invalid("that image is too large");
  return value;
}

const CITY_NAMES = ALL_CITIES.map((c) => c.name);

// World-tick pacing. In memory, not in state — see the note on "world.tick".
let lastWorldTickAt = 0;
const GDB_SNAPSHOT_INTERVAL_MS = 2 * 60 * 1000;

// ── the registry ─────────────────────────────────────────────────────────────

export const ACTIONS: Record<string, ActionDef> = {
  // Self-authenticating: the route checks that `address` is the hash of `pubKey`,
  // which is all the proof needed to claim a brand-new address.
  "citizen.register": {
    signed: true,
    bootstrap: true,
    run({ envelope, payload }) {
      const addr = envelope.address;
      if (getCitizen(addr)) return { ok: false, reason: "That citizenship already exists." };
      if (!isValidPublicKey(envelope.pubKey)) {
        return { ok: false, reason: "Missing or malformed public key." };
      }

      const username = str(payload, "username", LIMITS.USERNAME);
      const faction = oneOf(payload, "faction", FACTIONS);
      const pfp = optionalStr(payload, "pfp", LIMITS.IMAGE_CHARS);
      const city = payload.city == null ? undefined : oneOf(payload, "city", CITY_NAMES);
      const party = optionalStr(payload, "party", 60);

      const citizen = registerCitizen({
        address: addr,
        pubKey: envelope.pubKey,
        username,
        faction,
        pfp,
        city,
        party,
      });
      return { ok: true, data: { citizen } };
    },
  },

  // Legacy citizens trade their shared-state secret for a real keypair. Authorised
  // by the HMAC proof checked in the route; the secret is destroyed here.
  "citizen.upgradeKey": {
    signed: true,
    bootstrap: true,
    run({ envelope }) {
      const citizen = getCitizen(envelope.address);
      if (!citizen) return { ok: false, reason: "No such citizen." };
      if (!isValidPublicKey(envelope.pubKey)) {
        return { ok: false, reason: "Missing or malformed public key." };
      }
      upgradeCitizenKey(envelope.address, envelope.pubKey);
      return { ok: true };
    },
  },

  "citizen.equip": {
    signed: true,
    run({ actor, payload }) {
      return equipCosmetic(actor, id(payload, "itemId"), bool(payload, "equip"));
    },
  },

  "post.create": {
    signed: true,
    run({ actor, payload }) {
      const postId = id(payload, "id");
      const text = optionalStr(payload, "text", LIMITS.POST_TEXT) || "";
      const image = imageDataUrl(payload);
      if (!text && !image) return { ok: false, reason: "A post needs words or a picture." };
      if (getPost(postId)) return { ok: true, data: { postId } }; // replayed, already landed

      const post = createPost({ author: actor, text, image, id: postId });
      return { ok: true, data: { postId: post.id } };
    },
  },

  "post.vote": {
    signed: true,
    run({ actor, payload }) {
      const postId = id(payload, "postId");
      const dir = oneOf(payload, "dir", ["up", "down"] as const);
      const post = getPost(postId);
      if (!post) return { ok: false, reason: "That post is gone." };
      votePost(postId, actor, dir);
      return { ok: true };
    },
  },

  "post.boost": {
    signed: true,
    run({ actor, payload }) {
      const postId = id(payload, "postId");
      if (!getPost(postId)) return { ok: false, reason: "That post is gone." };
      return boostPost(postId, actor);
    },
  },

  // A fixed-price tip, so the amount can't be dictated by the caller.
  "post.tip": {
    signed: true,
    run({ actor, payload }) {
      const post = getPost(id(payload, "postId"));
      if (!post) return { ok: false, reason: "That post is gone." };
      if (post.author === actor) return { ok: false, reason: "You can't tip yourself." };
      const author = getCitizen(post.author);
      return ledger.transfer(
        actor,
        post.author,
        RATES.TIP,
        `tipped @${author?.username ?? "citizen"}`
      );
    },
  },

  "mmc.transfer": {
    signed: true,
    run({ actor, payload }) {
      const to = address(payload, "to");
      const amount = positiveInt(payload, "amount", 1_000_000);
      const memo = optionalStr(payload, "memo", LIMITS.MEMO) || "transfer";
      if (to === actor) return { ok: false, reason: "You can't send MMC to yourself." };
      if (!getCitizen(to)) return { ok: false, reason: "No citizen at that address." };
      return ledger.transfer(actor, to, amount, memo);
    },
  },

  "proposal.create": {
    signed: true,
    run({ actor, payload }) {
      const proposalId = id(payload, "proposalId");
      const postId = id(payload, "postId");
      if (governance.getProposal(proposalId)) return { ok: true, data: { proposalId } };
      const result = governance.createProposal(
        actor,
        str(payload, "title", LIMITS.TITLE),
        str(payload, "description", LIMITS.DESCRIPTION),
        { proposalId, postId }
      );
      return { ok: result.ok, reason: result.reason, data: { proposalId, postId: result.postId } };
    },
  },

  "proposal.vote": {
    signed: true,
    run({ actor, payload }) {
      const proposalId = id(payload, "proposalId");
      const choice = oneOf(payload, "vote", ["yes", "no"] as const);
      if (!governance.getProposal(proposalId)) return { ok: false, reason: "No such proposal." };
      return governance.vote(proposalId, actor, choice);
    },
  },

  // Lobbying an AI minister. The server decides whether the argument landed and
  // casts the minister's vote — a browser can't just declare itself persuasive.
  "minister.bribe": {
    signed: true,
    run({ actor, payload }) {
      const result = bribeMinister(
        actor,
        id(payload, "proposalId"),
        address(payload, "ministerAddress")
      );
      return { ok: result.ok, reason: result.reason, data: { newVote: result.newVote } };
    },
  },

  "minister.persuade": {
    signed: true,
    run({ payload }) {
      const result = persuadeMinister(
        id(payload, "proposalId"),
        address(payload, "ministerAddress"),
        str(payload, "message", LIMITS.DESCRIPTION)
      );
      return { ok: result.ok, reason: result.reason, data: { newVote: result.newVote } };
    },
  },

  "election.vote": {
    signed: true,
    run({ actor, payload }) {
      const candidate = address(payload, "candidate");
      const election = elections.getElection();
      if (!election.candidates.includes(candidate)) {
        return { ok: false, reason: "That citizen isn't on the ballot." };
      }
      return elections.vote(actor, candidate);
    },
  },

  "election.declareCandidacy": {
    signed: true,
    run({ actor, payload }) {
      const result = elections.declareCandidacy(actor, id(payload, "postId"));
      return { ok: result.ok, reason: result.reason, data: { postId: result.postId } };
    },
  },

  "market.buy": {
    signed: true,
    run({ actor, payload }) {
      return buyCosmetic(actor, id(payload, "itemId"));
    },
  },

  "city.skirmish": {
    signed: true,
    run({ actor, payload }) {
      const attackerCity = oneOf(payload, "attackerCity", CITY_NAMES);
      const defenderCity = oneOf(payload, "defenderCity", CITY_NAMES);
      const skirmishId = id(payload, "skirmishId");

      // You fight for your own city — not as whoever you'd like to be today.
      const citizen = getCitizen(actor);
      if (citizen?.city && citizen.city !== attackerCity) {
        return { ok: false, reason: `You can only lead ${citizen.city} into battle.` };
      }
      if ((db.get().skirmishLog ?? []).some((s) => s.id === skirmishId)) {
        return { ok: true }; // replayed
      }

      const outcome = launchSkirmish(attackerCity, defenderCity, actor, skirmishId);
      if (outcome.error) return { ok: false, reason: outcome.error };
      return {
        ok: true,
        data: { result: outcome.result, territories: outcome.territories },
      };
    },
  },

  "trial.file": {
    signed: true,
    run({ actor, payload }) {
      const trialId = id(payload, "trialId");
      const postId = id(payload, "postId");
      const defendant = address(payload, "defendant");
      if (defendant === actor) return { ok: false, reason: "You cannot sue yourself." };
      if ((db.get().trials ?? []).some((t) => t.id === trialId)) {
        return { ok: true, data: { trialId } };
      }
      const result = fileCharge(
        actor,
        defendant,
        str(payload, "charge", LIMITS.CHARGE),
        str(payload, "description", LIMITS.DESCRIPTION),
        undefined,
        { trialId, postId }
      );
      return { ok: result.ok, reason: result.reason, data: { trialId: result.trialId } };
    },
  },

  "trial.vote": {
    signed: true,
    run({ actor, payload }) {
      return voteOnTrial(
        id(payload, "trialId"),
        actor,
        oneOf(payload, "vote", ["guilty", "innocent"] as const)
      );
    },
  },

  // The nap widget. Cooldown enforced here, because a client-side timer is a
  // suggestion, not a rule.
  "nap.complete": {
    signed: true,
    run({ actor }) {
      const citizen = getCitizen(actor);
      if (!citizen) return { ok: false, reason: "No such citizen." };
      const now = Date.now();
      if (citizen.lastNapAt && now - citizen.lastNapAt < 10_000) {
        return { ok: false, reason: "You just woke up. Nap again in a moment." };
      }
      db.update((s) => {
        const c = s.citizens[actor];
        if (c) c.lastNapAt = now;
      });
      adjustAura(actor, 10);
      return { ok: true };
    },
  },

  // Unsigned world maintenance. Safe to leave open because every effect is gated
  // on wall-clock deadlines that already passed — a caller can hurry nothing along,
  // and calling it a thousand times does the same thing as calling it once.
  //
  // The throttle is deliberately in memory rather than in state: persisting a
  // "last ticked at" made every single tick a write, which bumped the revision,
  // which pushed a full copy of the nation to every client every few seconds.
  // Now a tick that finds nothing to do commits nothing at all.
  "world.tick": {
    signed: false,
    run() {
      const now = Date.now();
      if (now - lastWorldTickAt < 4_000) {
        return { ok: true, commit: false, data: { skipped: true } };
      }
      lastWorldTickAt = now;

      const state = db.get();
      let changed = false;

      if (elections.resolveElection()) changed = true;
      if (governance.resolveExpired()) changed = true;
      if (resolveTrials() > 0) changed = true;

      // A GDB reading is a state change, so taking one every 30s meant pushing
      // the nation to every client twice a minute for a single number.
      if (now - (state.lastGdbSnapshotAt ?? 0) > GDB_SNAPSHOT_INTERVAL_MS) {
        recordGdbSnapshot();
        db.update((s) => {
          s.lastGdbSnapshotAt = now;
        });
        changed = true;
      }

      return { ok: true, commit: changed, data: { changed } };
    },
  },
};

export function isKnownAction(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACTIONS, type);
}

export function actionDef(type: string): ActionDef | null {
  return isKnownAction(type) ? ACTIONS[type] : null;
}

/**
 * Apply an action to whatever state is currently in scope. Must be called inside
 * `withState()` on the server; on the client it edits the optimistic cache.
 *
 * Authentication is NOT done here — the route does that before calling this.
 */
export function applyAction(envelope: ActionEnvelope): ActionResult {
  const def = actionDef(envelope.type);
  if (!def) return { ok: false, reason: `Unknown action "${envelope.type}".` };

  const payload = (envelope.payload || {}) as Record<string, unknown>;

  try {
    const result = def.run({ actor: envelope.address, payload, envelope });
    return { commit: result.ok, ...result };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, reason: err.message, commit: false };
    throw err;
  }
}
