// candidates.ts — loads persona details from personas.ts and implements text generators.

import { CANDIDATES_PERSONAS } from "./personas";
import type { Citizen, Post } from "@/lib/types";

export const CANDIDATES: Citizen[] = CANDIDATES_PERSONAS.map((p) => ({
  address: p.address,
  username: p.username,
  handle: p.handle,
  faction: p.faction,
  running: p.running,
  pfp: p.pfp,
  isAI: p.isAI,
  joinedAt: p.joinedAt,
  aura: p.aura,
}));

export function campaignPost(candidate: Citizen, seed = Date.now()): string {
  const p = CANDIDATES_PERSONAS.find((x) => x.address === candidate.address);
  const lines = p ? p.campaignLines : ["vote for me 🗳️"];
  return lines[Math.abs(seed) % lines.length];
}

// Given a post's current reception, an AI candidate fires a reply in character.
export function generateReply(candidate: Citizen, post: Post): string {
  const p = CANDIDATES_PERSONAS.find((x) => x.address === candidate.address);
  if (!p) return "woof! 🐕";
  
  const net = post.up - post.down;
  let mood: "banger" | "mid" | "cringe" | "fresh" = "fresh";
  if (post.up + post.down >= 2) {
    if (net >= 3) mood = "banger";
    else if (net <= -2) mood = "cringe";
    else mood = "mid";
  }
  const lines = p.replyMoods[mood] || p.replyMoods.fresh;
  const seed = post.id.length + candidate.username.length + post.up * 7 - post.down * 3;
  return lines[Math.abs(seed) % lines.length];
}
