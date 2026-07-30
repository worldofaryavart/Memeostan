// actionClient.ts — how the browser asks the nation to do something.
//
// The client no longer writes state; it sends signed intents and adopts whatever
// comes back. To keep the UI as instant as it was when everything was local:
//
//   1. apply the action to the local cache immediately (optimistic)
//   2. sign it and queue it
//   3. replace the cache with the canonical state in the response
//
// If the server disagrees — insufficient MMC, a cooldown, a rejected signature —
// its state comes back anyway, so the optimistic change disappears on its own.
// No manual rollback, and the server is always the one telling the truth.

"use client";

import { applyAction, type ActionEnvelope, type ActionResult } from "./actions";
import { applyServerState, db } from "./db";
import { getSession, setSession, type Session } from "./session";
import {
  createCitizenKeys,
  legacyProof,
  makeNonce,
  signAction,
  type PublicKeyJwk,
  type SignableAction,
} from "./crypto";
import type { NationState } from "./types";

export const NATION_UPDATE = "nation-update";
export const NATION_ERROR = "nation-error";

/**
 * Mint an id for a row an action is about to create. The client generates these so
 * its optimistic copy and the server's committed copy are the same row — and so a
 * retried request lands on it instead of creating a duplicate.
 */
export function newActionId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function announceUpdate(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(NATION_UPDATE));
  }
}

/** Surfaced to the UI so a server rejection isn't silent. */
export function reportRejection(reason: string): void {
  if (typeof window === "undefined") return;
  console.warn("[memeostan] the nation rejected an action:", reason);
  window.dispatchEvent(new CustomEvent(NATION_ERROR, { detail: reason }));
}

// ── the outbound queue ───────────────────────────────────────────────────────
//
// One request in flight at a time. Responses each carry a full state snapshot, so
// letting two overlap would mean a slower reply could land after a newer one and
// undo it on screen.

type QueuedTask = () => Promise<void>;

let chain: Promise<void> = Promise.resolve();

function enqueue(task: QueuedTask): Promise<void> {
  chain = chain.then(task).catch((err) => {
    console.error("[memeostan] action queue error:", err);
  });
  return chain;
}

interface SendOptions {
  pubKey?: PublicKeyJwk;
  useLegacyProof?: boolean;
}

async function sign(
  session: Session | null,
  signable: SignableAction,
  options: SendOptions
): Promise<Partial<ActionEnvelope>> {
  if (options.useLegacyProof) {
    if (!session?.legacySecret) throw new Error("no legacy key to prove");
    return { legacyProof: await legacyProof(session.legacySecret, signable) };
  }
  if (!session?.privateKey) throw new Error("no signing key in this browser");
  return { sig: await signAction(session.privateKey, signable) };
}

async function send(
  envelope: ActionEnvelope,
  signable: SignableAction,
  options: SendOptions
): Promise<ActionResult> {
  const session = getSession();
  const proof = await sign(session, signable, options);

  const res = await fetch("/api/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...envelope, ...proof }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    reason?: string;
    data?: Record<string, unknown>;
    state?: NationState;
  };

  if (body.state) applyServerState(body.state);
  announceUpdate();

  if (!res.ok || body.ok === false) {
    const reason = body.reason || `the nation returned ${res.status}`;
    reportRejection(reason);
    return { ok: false, reason };
  }

  return { ok: true, data: body.data };
}

function envelopeFor(type: string, payload: Record<string, unknown>): {
  envelope: ActionEnvelope;
  signable: SignableAction;
} {
  const address = getSession()?.address ?? "";
  const nonce = makeNonce();
  const ts = Date.now();
  const signable: SignableAction = { type, payload, address, nonce, ts };
  return { envelope: { type, payload, address, nonce, ts }, signable };
}

// ── the public API ───────────────────────────────────────────────────────────

/**
 * Fire an action. Returns the *optimistic* result synchronously so existing UI
 * that reads `{ ok, reason }` keeps working; the server's verdict arrives later
 * and corrects the local state either way.
 */
export function act(type: string, payload: Record<string, unknown> = {}): ActionResult {
  const { envelope, signable } = envelopeFor(type, payload);

  // Optimistic pass. Local rules mirror the server's, so an obvious "you're broke"
  // still shows up instantly instead of after a round trip.
  const optimistic = applyAction(envelope);
  announceUpdate();

  if (!optimistic.ok) {
    // Don't spend a request on something our own copy of the rules already refuses.
    return optimistic;
  }

  void enqueue(async () => {
    await send(envelope, signable, {});
  });

  return optimistic;
}

/** Same as `act`, but waits for the server's verdict. Use when you need certainty. */
export async function actAsync(
  type: string,
  payload: Record<string, unknown> = {}
): Promise<ActionResult> {
  const { envelope, signable } = envelopeFor(type, payload);

  const optimistic = applyAction(envelope);
  announceUpdate();
  if (!optimistic.ok) return optimistic;

  let confirmed: ActionResult = { ok: false, reason: "not sent" };
  await enqueue(async () => {
    confirmed = await send(envelope, signable, {});
  });
  return confirmed;
}

/**
 * Ask the server to advance the world clock (resolve elections, trials, events).
 *
 * Sends the revision we already hold, so a tick that changed nothing — which is
 * most of them — comes back as a couple of hundred bytes instead of the whole
 * nation.
 */
export function requestWorldTick(): void {
  const { envelope } = envelopeFor("world.tick", {});
  envelope.sinceRev = db.get().rev ?? 0;

  void enqueue(async () => {
    const res = await fetch("/api/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(envelope),
    });
    const body = (await res.json().catch(() => ({}))) as {
      state?: NationState;
      unchanged?: boolean;
    };
    if (body.unchanged || !body.state) return;
    applyServerState(body.state);
    announceUpdate();
  });
}

// ── claiming and restoring citizenship ───────────────────────────────────────

export interface ClaimFields {
  username: string;
  faction: string;
  pfp?: string;
  city?: string;
  party?: string;
}

/**
 * Mint a keypair in this browser, derive the address from it, and file the
 * passport. The private key is written to localStorage and never sent anywhere.
 */
export async function claimCitizenship(fields: ClaimFields): Promise<ActionResult> {
  let keys;
  try {
    keys = await createCitizenKeys();
  } catch (err) {
    console.error("Could not generate a citizen keypair:", err);
    return { ok: false, reason: "This browser can't generate a citizenship key." };
  }

  setSession({ address: keys.address, privateKey: keys.privateKey });

  const payload: Record<string, unknown> = {
    username: fields.username,
    faction: fields.faction,
  };
  if (fields.pfp) payload.pfp = fields.pfp;
  if (fields.city) payload.city = fields.city;
  if (fields.party) payload.party = fields.party;

  const nonce = makeNonce();
  const ts = Date.now();
  const signable: SignableAction = {
    type: "citizen.register",
    payload,
    address: keys.address,
    nonce,
    ts,
  };
  const envelope: ActionEnvelope = {
    type: "citizen.register",
    payload,
    address: keys.address,
    nonce,
    ts,
    pubKey: keys.publicKey,
  };

  applyAction(envelope);
  announceUpdate();

  let confirmed: ActionResult = { ok: false, reason: "not sent" };
  await enqueue(async () => {
    confirmed = await send(envelope, signable, { pubKey: keys.publicKey });
  });

  return confirmed;
}

/**
 * Citizens claimed before signed actions existed hold a random hex secret. Trade
 * it for a real keypair once, then it's destroyed server-side. Silent no-op for
 * everyone else.
 */
export async function upgradeLegacyKeyIfNeeded(): Promise<void> {
  const session = getSession();
  if (!session?.legacySecret || session.privateKey) return;

  const citizen = db.get().citizens[session.address];
  if (!citizen) return;

  let keys;
  try {
    keys = await createCitizenKeys();
  } catch (err) {
    console.error("Could not generate a replacement keypair:", err);
    return;
  }

  const payload = {};
  const nonce = makeNonce();
  const ts = Date.now();
  const signable: SignableAction = {
    type: "citizen.upgradeKey",
    payload,
    address: session.address,
    nonce,
    ts,
  };
  const envelope: ActionEnvelope = {
    type: "citizen.upgradeKey",
    payload,
    address: session.address,
    nonce,
    ts,
    pubKey: keys.publicKey,
  };

  const result = await send(envelope, signable, { useLegacyProof: true });
  if (result.ok) {
    // Keep the address; swap the key material and forget the secret.
    setSession({ address: session.address, privateKey: keys.privateKey });
    console.info("[memeostan] citizenship key upgraded to a real keypair");
  }
}
