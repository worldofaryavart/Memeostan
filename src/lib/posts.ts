// posts.ts — the feed: creating posts, voting, and the economic consequences.

import { db } from "./db";
import { ledger } from "./ledger";
import { RATES, vibeOf, getDailyMintedAmount, getDecayedReward } from "./economy";
import { adjustAura } from "./citizens";
import type { Citizen, Post, VoteDir } from "./types";

function newId(): string {
  return "post_" + Math.random().toString(36).slice(2, 10);
}

// Heuristic for "low-effort": tiny text posts with no image. Spam gets taxed.
function looksLowEffort(post: Post): boolean {
  return !post.image && (post.text || "").trim().length < 4;
}

interface NewPost {
  author: string;
  text?: string;
  image?: string | null;
}

export function createPost({ author, text, image }: NewPost): Post {
  const post: Post = {
    id: newId(),
    author,
    text: text || "",
    image: image || null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
  };
  db.update((s) => s.posts.unshift(post));

  if (looksLowEffort(post)) {
    ledger.burn(author, RATES.SPAM_TAX, "spam tax — low-effort post (meme dilution)");
    adjustAura(author, -10);
  } else {
    const baseReward = RATES.POST;
    const decayed = getDecayedReward(baseReward);
    const alreadyMinted = getDailyMintedAmount(author);
    const allowed = Math.max(0, 500 - alreadyMinted);
    const finalReward = Math.min(decayed, allowed);
    if (finalReward > 0) {
      ledger.mint(author, finalReward, "posted to the public square");
    }
  }
  return post;
}

export function getPost(id: string): Post | null {
  return db.get().posts.find((p) => p.id === id) || null;
}

export function allPosts(): Post[] {
  return db.get().posts;
}

// Vote on a post. One vote per citizen; re-voting flips/clears it.
// Upvotes mint MMC to the author; downvotes (ratios) burn it.
export function vote(postId: string, voter: string, dir: VoteDir): void {
  db.update((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (!p) return;
    const prev = p.voters[voter];
    if (prev === dir) {
      delete p.voters[voter];
      if (dir === "up") p.up -= 1;
      else p.down -= 1;
    } else {
      if (prev === "up") p.up -= 1;
      else if (prev === "down") p.down -= 1;
      p.voters[voter] = dir;
      if (dir === "up") p.up += 1;
      else p.down += 1;
    }
  });

  const p = getPost(postId);
  if (!p) return;
  if (dir === "up" && p.voters[voter] === "up") {
    const baseReward = RATES.UPVOTE_REWARD;
    const decayed = getDecayedReward(baseReward);
    const alreadyMinted = getDailyMintedAmount(p.author);
    const allowed = Math.max(0, 500 - alreadyMinted);
    const finalReward = Math.min(decayed, allowed);
    if (finalReward > 0) {
      ledger.mint(p.author, finalReward, "upvote reward");
    }
    adjustAura(p.author, 5);
  } else if (dir === "down" && p.voters[voter] === "down") {
    ledger.burn(p.author, RATES.DOWNVOTE_BURN, "ratio tax — downvoted");
    adjustAura(p.author, -5);
  }
}

export function addReply(postId: string, author: string, text: string): void {
  db.update((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (p) p.replies.push({ author, text, at: Date.now() });
  });
}

export interface LeaderRow {
  citizen: Citizen;
  vibe: number;
}

// Leaderboard: citizens ranked by total vibe across their posts.
export function leaderboard(
  byId: Record<string, Citizen>,
  limit = 6
): LeaderRow[] {
  const score: Record<string, number> = {};
  for (const p of db.get().posts) {
    score[p.author] = (score[p.author] || 0) + vibeOf(p);
  }
  return Object.entries(score)
    .map(([address, vibe]) => ({ citizen: byId[address], vibe }))
    .filter((r): r is LeaderRow => Boolean(r.citizen))
    .sort((a, b) => b.vibe - a.vibe)
    .slice(0, limit);
}

export function boostPost(postId: string, citizenAddress: string): { ok: boolean; reason?: string } {
  const balance = ledger.balanceOf(citizenAddress);
  const cost = RATES.BOOST_COST;
  if (balance < cost) {
    return {
      ok: false,
      reason: `Boosting costs ${cost} MMC. You only have ${balance} MMC.`,
    };
  }

  ledger.burn(citizenAddress, cost, `post boost — boosted reach`);
  
  db.update((s) => {
    const p = s.posts.find((x) => x.id === postId);
    if (p) {
      p.boosts = (p.boosts || 0) + 1;
    }
  });

  return { ok: true };
}
