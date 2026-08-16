// engine.ts — the browser's side of the state: a nudge and a repaint.
//
// All the actual behaviour (policing, prosecuting, judging, tuning the economy,
// reading the news) lives in src/ai/world.ts and runs inside a server
// transaction. What's left here is asking the server to take a turn and telling
// React the world moved.
//
// There used to be a second endpoint here — an AI citizen answering your post —
// and a `spawn` call that invented new bots when the population dipped. Both are
// gone with the AI citizen layer. Nothing in Memeostan converses with you now;
// the state acts on you, on its own schedule, and you find out in the feed.

"use client";

import { applyServerState, db } from "@/lib/db";
import type { NationState } from "@/lib/types";

type Notify = () => void;

interface BeatResponse {
  ok?: boolean;
  skipped?: boolean;
  citations?: number;
  verdicts?: number;
  state?: NationState;
}

function adopt(state: NationState | undefined, onUpdate: Notify): void {
  if (state && applyServerState(state)) onUpdate();
}

/** The revision we already hold, so the server can skip re-sending it. */
function sinceRev(): number {
  return db.get().rev ?? 0;
}

/**
 * Ask the server to take one turn of government. The server ignores turns that
 * arrive too soon after the last one, so extra tabs cost nothing.
 */
export function requestStateBeat(onUpdate: Notify): void {
  fetch("/api/ai/beat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sinceRev: sinceRev() }),
  })
    .then((res) => res.json())
    .then((data: BeatResponse) => {
      if (data.skipped) return;
      adopt(data.state, onUpdate);
    })
    .catch((err) => console.error("State beat request failed:", err));
}

/**
 * You posted. Let the police know there is something to look at — the beat's own
 * cooldown decides whether they get to it now or on the next patrol.
 */
export function onUserPost(_postId: string, onUpdate: Notify): void {
  window.setTimeout(() => requestStateBeat(onUpdate), 1200 + Math.random() * 900);
}

/** The heartbeat. */
export function startGovernmentLoop(onUpdate: Notify, intervalMs = 30000): number {
  const beat = () => {
    if (document.visibilityState !== "visible") return;
    requestStateBeat(onUpdate);
  };

  beat();
  return window.setInterval(beat, intervalMs);
}
