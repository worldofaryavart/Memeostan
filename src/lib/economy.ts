// economy.ts — national metrics, all derived from real ledger + feed activity.
// GDB is the nation's GDP; dilution is its inflation.

import { db } from "./db";
import { ledger } from "./ledger";
import type { Post } from "./types";

// MMC earned/burned per action. The whole economy is tuned from here.
export const RATES = {
  POST: 50, // mint for posting
  UPVOTE_REWARD: 5, // mint to author per upvote
  DOWNVOTE_BURN: 3, // burn from author per downvote (the ratio tax)
  SPAM_TAX: 20, // burn for low-effort posts (dilution control)
  WELCOME_GRANT: 250, // starting MMC for a new citizen
  BOOST_COST: 50, // cost to boost a post
} as const;

// Gross Domestic Brainrot: posts produced × engagement × money velocity.
export function grossDomesticBrainrot(): number {
  const s = db.get();
  const posts = s.posts.length;
  const engagement = s.posts.reduce((n, p) => n + p.up + p.down, 0);
  const velocity = s.txs.length;
  return posts * 100 + engagement * 25 + velocity * 10;
}

// Meme Dilution (inflation %): how much circulating MMC chases low-vibe posts.
export function memeDilution(): number {
  const s = db.get();
  if (s.posts.length === 0) return 0;
  const cringe = s.posts.filter((p) => p.down > p.up).length;
  const ratio = cringe / s.posts.length;
  const supplyPressure = Math.min(ledger.circulatingSupply() / 100000, 1);
  return +(ratio * 60 + supplyPressure * 40).toFixed(1);
}

// Vibe score for a single post = net reception.
export function vibeOf(post: Post): number {
  const base = post.up * 2 - post.down * 3;
  const multiplier = 1 + (post.boosts || 0) * 0.5;
  return Math.round(base * multiplier);
}

// Get total MMC minted by a citizen in the last 24 hours, excluding welcome grants and legislative/election grants
export function getDailyMintedAmount(address: string): number {
  const s = db.get();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return s.txs
    .filter(
      (t) =>
        t.to === address &&
        t.type === "mint" &&
        !t.memo.startsWith("welcome grant") &&
        !t.memo.startsWith("legislative grant") &&
        !t.memo.startsWith("election victory grant") &&
        t.at >= oneDayAgo
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

// Get decayed reward amount based on the current meme dilution percentage
export function getDecayedReward(baseReward: number): number {
  const dilution = memeDilution();
  return Math.max(0, Math.round(baseReward * (1 - dilution / 100)));
}

// Record a snapshot of Gross Domestic Brainrot history, capped at 20 entries
export function recordGdbSnapshot(): void {
  db.update((s) => {
    if (!s.gdbHistory) s.gdbHistory = [];
    s.gdbHistory.push({ at: Date.now(), gdb: grossDomesticBrainrot() });
    if (s.gdbHistory.length > 20) {
      s.gdbHistory = s.gdbHistory.slice(-20);
    }
  });
}

