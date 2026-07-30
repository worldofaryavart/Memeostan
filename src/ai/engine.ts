// engine.ts — the browser's side of the AI citizens: a nudge and a repaint.
//
// All the actual behaviour (posting, replying, voting, prosecuting, firing economic
// events) now lives in src/ai/world.ts and runs inside a server transaction. What's
// left here is asking the server to take a turn and telling React the world moved.
//
// This file used to be 475 lines of simulation running in every open tab. That's why
// two tabs could disagree about who won an election.

"use client";

import { applyServerState } from "@/lib/db";
import type { NationState } from "@/lib/types";

type Notify = () => void;

interface BeatResponse {
  ok?: boolean;
  skipped?: boolean;
  postId?: string | null;
  needsAI?: boolean;
  state?: NationState;
}

function adopt(state: NationState | undefined, onUpdate: Notify): void {
  if (state && applyServerState(state)) onUpdate();
}

/**
 * Ask an AI citizen to react to a specific post. The server picks who replies (or
 * honours `candidateAddress`), generates it, and records it — the reply text never
 * passes through the client, so it can't be forged here.
 */
export function requestAIReply(
  postId: string,
  onUpdate: Notify,
  candidateAddress?: string
): void {
  fetch("/api/ai/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ postId, candidateAddress }),
  })
    .then((res) => res.json())
    .then((data: BeatResponse) => adopt(data.state, onUpdate))
    .catch((err) => console.error("Could not get an AI reply:", err));
}

/** When you post, give the AI citizens a moment and then let them cook. */
export function onUserPost(postId: string, onUpdate: Notify): void {
  window.setTimeout(() => requestAIReply(postId, onUpdate), 900 + Math.random() * 1200);
}

/** Announcements (a new candidacy, a referendum) get the ministers arguing. */
export function onSystemPost(
  postId: string,
  _type: "candidacy" | "referendum",
  onUpdate: Notify
): void {
  window.setTimeout(() => requestAIReply(postId, onUpdate), 1000 + Math.random() * 800);
}

/**
 * The heartbeat. Each tick asks the server to run one AI turn; the server ignores
 * ticks that arrive too soon after the last one, so extra tabs cost nothing.
 */
export function startCampaignLoop(onUpdate: Notify, intervalMs = 30000): number {
  const beat = () => {
    if (document.visibilityState !== "visible") return;

    fetch("/api/ai/beat", { method: "POST" })
      .then((res) => res.json())
      .then((data: BeatResponse) => {
        if (data.skipped) return;
        adopt(data.state, onUpdate);

        // The feed just got a campaign post — let the opposition respond to it.
        if (data.postId) {
          const postId = data.postId;
          window.setTimeout(() => requestAIReply(postId, onUpdate), 1500);
        }

        // Keep roughly two AI citizens per human.
        if (data.needsAI) {
          fetch("/api/ai/spawn", { method: "POST" })
            .then((res) => res.json())
            .then((spawn: BeatResponse) => adopt(spawn.state, onUpdate))
            .catch((err) => console.error("Could not spawn an AI citizen:", err));
        }
      })
      .catch((err) => console.error("AI beat request failed:", err));
  };

  beat();
  return window.setInterval(beat, intervalMs);
}
