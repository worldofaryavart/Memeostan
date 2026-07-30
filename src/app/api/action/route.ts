// POST /api/action — the only way to change the nation.
//
// Replaces the old "client POSTs the entire nation document" write path. That
// endpoint let anyone rewrite balances, laws and election results with one curl,
// and made two open tabs overwrite each other. Here the client sends an intent,
// the server checks the signature and applies its own rules under a revision guard.
//
// Order matters:
//   1. shape-check the envelope        (cheap, no database)
//   2. reject stale/replayed requests  (timestamp window + nonce)
//   3. verify the signature            (against the stored public key)
//   4. apply + commit                  (authoritative, retried on conflict)

import { NextResponse } from "next/server";
import { applyAction, actionDef, type ActionEnvelope } from "@/lib/actions";
import { publicState } from "@/lib/db";
import {
  hasSeenNonce,
  loadState,
  mutateState,
  rememberNonce,
} from "@/lib/serverState";
import {
  deriveAddress,
  isValidPublicKey,
  verifyAction,
  verifyLegacyProof,
  type SignableAction,
} from "@/lib/crypto";

// How far a client's clock may drift before we refuse to accept its signature.
const CLOCK_SKEW_MS = 2 * 60 * 1000;

function bad(reason: string, status = 400) {
  return NextResponse.json({ ok: false, reason }, { status });
}

export async function POST(req: Request) {
  let envelope: ActionEnvelope;
  try {
    envelope = (await req.json()) as ActionEnvelope;
  } catch {
    return bad("Malformed request body.");
  }

  if (!envelope || typeof envelope.type !== "string") return bad("Missing action type.");

  const def = actionDef(envelope.type);
  if (!def) return bad(`Unknown action "${envelope.type}".`);

  if (typeof envelope.nonce !== "string" || envelope.nonce.length < 8) {
    return bad("Missing nonce.");
  }
  if (typeof envelope.ts !== "number" || Math.abs(Date.now() - envelope.ts) > CLOCK_SKEW_MS) {
    return bad("Request timestamp is outside the accepted window — check your clock.");
  }
  if (envelope.payload == null || typeof envelope.payload !== "object") {
    envelope.payload = {};
  }

  const signable: SignableAction = {
    type: envelope.type,
    payload: envelope.payload,
    address: envelope.address ?? "",
    nonce: envelope.nonce,
    ts: envelope.ts,
  };

  // ── authentication ─────────────────────────────────────────────────────────
  if (def.signed) {
    if (typeof envelope.address !== "string" || !envelope.address) {
      return bad("Signed actions need an address.");
    }

    const state = await loadState();
    if (hasSeenNonce(state, envelope.nonce)) {
      return bad("That request was already used.", 409);
    }

    const citizen = state.citizens[envelope.address];

    if (envelope.type === "citizen.register") {
      // No stored key to check against yet — the address itself is the proof, since
      // it is a hash of the public key being registered.
      if (!isValidPublicKey(envelope.pubKey)) return bad("Missing or malformed public key.");
      const derived = await deriveAddress(envelope.pubKey);
      if (derived !== envelope.address) {
        return bad("That address does not belong to that public key.", 403);
      }
      if (!envelope.sig || !(await verifyAction(envelope.pubKey, signable, envelope.sig))) {
        return bad("Bad signature.", 403);
      }
    } else if (envelope.type === "citizen.upgradeKey") {
      // One-time migration: prove knowledge of the old shared-state secret.
      if (!citizen) return bad("No such citizen.", 404);
      if (!citizen.secret) return bad("This citizenship already uses a real key.", 409);
      if (!isValidPublicKey(envelope.pubKey)) return bad("Missing or malformed public key.");
      if (
        !envelope.legacyProof ||
        !(await verifyLegacyProof(citizen.secret, signable, envelope.legacyProof))
      ) {
        return bad("Could not verify the old key.", 403);
      }
    } else {
      if (!citizen) return bad("Claim a passport first.", 403);
      // AI citizens are driven by the server (see /api/ai/*), never by a browser.
      if (citizen.isAI) return bad("You cannot act as an AI citizen.", 403);
      if (!isValidPublicKey(citizen.pubKey)) {
        return bad("This citizenship needs its key upgraded before it can act.", 409);
      }
      if (!envelope.sig || !(await verifyAction(citizen.pubKey, signable, envelope.sig))) {
        return bad("Bad signature.", 403);
      }
    }
  }

  // ── apply + commit ─────────────────────────────────────────────────────────
  try {
    const { result, state } = await mutateState((current) => {
      // Re-check inside the committed state: on a conflict retry this runs again
      // against a newer read, which is where a duplicate would otherwise slip in.
      if (def.signed && hasSeenNonce(current, envelope.nonce)) {
        return { ok: false, reason: "That request was already used.", commit: false };
      }
      const outcome = applyAction(envelope);
      if (outcome.commit !== false && def.signed) {
        rememberNonce(current, envelope.nonce);
      }
      return outcome;
    });

    // Only ship the nation if the caller doesn't already have this revision.
    // World ticks fire every few seconds and almost always change nothing; sending
    // a full copy each time cost ~158MB an hour per open tab.
    const rev = state.rev ?? 0;
    const clientRev = typeof envelope.sinceRev === "number" ? envelope.sinceRev : null;
    const unchanged = clientRev !== null && clientRev === rev;

    return NextResponse.json(
      {
        ok: result.ok,
        reason: result.reason,
        data: result.data,
        rev,
        ...(unchanged ? { unchanged: true } : { state: publicState(state) }),
      },
      { status: result.ok ? 200 : 400 }
    );
  } catch (err) {
    console.error(`Action "${envelope.type}" failed:`, err);
    return NextResponse.json(
      { ok: false, reason: "The nation could not process that right now." },
      { status: 500 }
    );
  }
}
