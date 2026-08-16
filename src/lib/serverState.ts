// serverState.ts — the authoritative nation state. Server-only.
//
// The nation is one MongoDB document, which is fine as long as nobody writes it
// blindly. Every commit is conditional on the revision it was read at:
//
//     loadState()  ->  rev 41
//     ...apply the action...
//     commitState() ->  replace where rev == 41, setting rev = 42
//
// If someone else committed in between, the guarded write matches nothing, and we
// re-read and re-apply instead of overwriting their work. That is the whole reason
// two open browsers no longer delete each other's posts.

import type { Collection, Document } from "mongodb";
import { connectToDatabase } from "./mongodb";
import { freshState, migrate, pruneState, withState } from "./db";
import { bootNation } from "@/data/seed";
import type { NationState } from "./types";

const DOC_ID = "nation";
const MAX_ATTEMPTS = 5;
const NONCE_TTL_MS = 3 * 60 * 1000;

async function stateCollection(): Promise<Collection<Document>> {
  const { db } = await connectToDatabase();
  return db.collection("state");
}

/** Read the nation, founding one if absent, and staff any unstaffed office. */
export async function loadState(): Promise<NationState> {
  const collection = await stateCollection();
  const doc = await collection.findOne({ _id: DOC_ID as never });

  if (!doc) {
    const seeded = migrate(freshState());
    // Seeding is a mutation like any other, so it runs through the same choke-point.
    withState(seeded, () => bootNation());
    seeded.rev = 1;
    await collection.insertOne({ _id: DOC_ID as never, ...seeded });
    return seeded;
  }

  const { _id, ...rest } = doc;
  const state = migrate(rest);

  // bootNation() used to run only when founding a nation from nothing, which
  // meant a deploy that added a new organ of the state never staffed it on an
  // existing country — the Treasury and the broadcaster were simply missing, and
  // posts attributed to them would have had no author record. It is idempotent
  // (existing offices are left exactly as they are), so it is safe to run on
  // every read.
  const before = Object.keys(state.citizens).length;
  withState(state, () => bootNation());
  // A no-op world tick declines to commit, so newly staffed offices could sit
  // unpersisted through an idle stretch. Flagging it makes the next mutation
  // write them out. Worst case under concurrency is one redundant commit.
  if (Object.keys(state.citizens).length !== before) staffedOnLastLoad = true;

  return state;
}

let staffedOnLastLoad = false;

/**
 * Commit under the revision we read at. Returns false when someone else got there
 * first — the caller should reload and re-apply rather than force the write.
 */
export async function commitState(state: NationState, baseRev: number): Promise<boolean> {
  const collection = await stateCollection();

  pruneNonces(state);
  pruneState(state);
  state.rev = baseRev + 1;

  const result = await collection.replaceOne(
    { _id: DOC_ID as never, rev: baseRev },
    { _id: DOC_ID as never, ...state }
  );

  if (result.matchedCount === 1) return true;

  // A document with no `rev` at all is a pre-versioning nation: adopt it once.
  if (baseRev === 0) {
    const adopted = await collection.replaceOne(
      { _id: DOC_ID as never, rev: { $exists: false } },
      { _id: DOC_ID as never, ...state }
    );
    return adopted.matchedCount === 1;
  }

  return false;
}

function pruneNonces(state: NationState): void {
  const cutoff = Date.now() - NONCE_TTL_MS;
  state.seenNonces = (state.seenNonces ?? []).filter((entry) => entry.at >= cutoff);
}

export function hasSeenNonce(state: NationState, nonce: string): boolean {
  const cutoff = Date.now() - NONCE_TTL_MS;
  return (state.seenNonces ?? []).some((entry) => entry.n === nonce && entry.at >= cutoff);
}

export function rememberNonce(state: NationState, nonce: string): void {
  if (!state.seenNonces) state.seenNonces = [];
  state.seenNonces.push({ n: nonce, at: Date.now() });
}

export interface MutationOutcome<T> {
  result: T;
  state: NationState;
  committed: boolean;
}

/**
 * Load → mutate → commit, retrying from a fresh read on a revision conflict.
 *
 * `mutate` must be synchronous and must be safe to run more than once: on a
 * conflict it is replayed against newer state. Actions carry client-supplied ids
 * for exactly this reason, so a replay lands on the same row instead of a duplicate.
 */
export async function mutateState<T>(
  mutate: (state: NationState) => T
): Promise<MutationOutcome<T>> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const state = await loadState();
    const baseRev = state.rev ?? 0;

    const mustPersistStaffing = staffedOnLastLoad;
    staffedOnLastLoad = false;

    const result = withState(state, () => mutate(state));

    // Nothing to persist (rejected, or a no-op world tick): skip the write entirely
    // so idle clients don't generate database churn.
    if (!mustPersistStaffing && (result as { commit?: boolean } | null)?.commit === false) {
      return { result, state, committed: false };
    }

    if (await commitState(state, baseRev)) {
      return { result, state, committed: true };
    }

    lastError = new Error(`revision conflict at rev ${baseRev}`);
    // Small jittered backoff so simultaneous writers don't lock-step retry.
    await new Promise((resolve) => setTimeout(resolve, 15 + Math.random() * 60));
  }

  throw lastError ?? new Error("could not commit nation state");
}
