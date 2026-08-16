// posts.ts — the feed: creating posts, voting, and the economic consequences.
// City rules are applied here at every reward/penalty callsite.

import { db } from "./db";
import { ledger } from "./ledger";
import { RATES, vibeOf, getDailyMintedAmount, getDecayedReward } from "./economy";
import { adjustAura, getCitizen } from "./citizens";
import { getRulesForCitizen } from "./cities";
import { isStateAccount } from "./systemAccounts";
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
  /**
   * Caller-supplied id. The client generates it so its optimistic copy of a post
   * has the same id as the one the server commits — otherwise reconciling would
   * make the post jump. Server-side actions pass the id from the signed payload.
   */
  id?: string;
}

function runCyberPoliceAudit(post: Post): void {
  const text = (post.text || "").toLowerCase();
  const author = post.author;
  
  // Ignore system accounts/AIs to prevent self-audit loops
  if (author === "0xai_cyberpolice000000000000000000police" || author.startsWith("0xai_") || author === "0xtreasury000000000000000000000000treasur") {
    return;
  }

  const logicWords = ["logical", "makes sense", "therefore", "scientific", "reasoning", "empirical", "rational", "evidence"];
  const grassWords = ["touch grass", "went outside", "sunlight", "park", "nature", "trees", "offline", "walk"];

  const hasLogic = logicWords.some((word) => text.includes(word));
  const hasGrass = grassWords.some((word) => text.includes(word));

  if (hasLogic) {
    const fine = 15;
    ledger.burn(author, fine, "cyber fine — excessive logic & reasoning usage 👮");
    db.update((s) => {
      const p = s.posts.find((x) => x.id === post.id);
      if (p) {
        p.replies.push({
          author: "0xai_cyberpolice000000000000000000police",
          text: `🚨 CYBER POLICE WARNING: Excessive logic and/or rational thought detected. Sensible thinking is strictly prohibited under Article 1 of the Constitution. Fined ${fine} MMC! 👮`,
          at: Date.now()
        });
      }
    });
  } else if (hasGrass) {
    const auraPenalty = 25;
    adjustAura(author, -auraPenalty);
    db.update((s) => {
      const p = s.posts.find((x) => x.id === post.id);
      if (p) {
        p.replies.push({
          author: "0xai_cyberpolice000000000000000000police",
          text: `🚨 CYBER POLICE WARNING: Outdoor activities and/or 'grass touching' references detected! Real-world contact is a Class A vibe offense. Deducted ${auraPenalty} Aura! Get back to scrolling. 👮`,
          at: Date.now()
        });
      }
    });
  }
}

export function createPost({ author, text, image, id }: NewPost): Post {
  const post: Post = {
    id: id || newId(),
    author,
    text: text || "",
    image: image || null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
  };
  db.update((s) => {
    if (s.posts.some((p) => p.id === post.id)) return; // idempotent on retry
    s.posts.unshift(post);
  });

  // Fetch city rules for this author
  const authorCitizen = getCitizen(author);
  const cityRules = getRulesForCitizen(authorCitizen);

  if (looksLowEffort(post)) {
    // Sigma (Neo Ohio) citizens are immune to spam tax burns, but still lose aura
    if (!cityRules.spamTaxImmune) {
      ledger.burn(author, RATES.SPAM_TAX, "spam tax — low-effort post (meme dilution)");
    }
    adjustAura(author, -10);
  } else {
    const baseReward = Math.round(RATES.POST * cityRules.postRewardMult);
    const decayed = getDecayedReward(baseReward);
    const alreadyMinted = getDailyMintedAmount(author);
    const allowed = Math.max(0, 500 - alreadyMinted);
    const finalReward = Math.min(decayed, allowed);
    if (finalReward > 0) {
      ledger.mint(author, finalReward, `posted to the public square (${cityRules.name} bonus applied)`);
    }
  }

  // Run AI Cyber Police audit
  runCyberPoliceAudit(post);

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

  // City rules apply to the POST AUTHOR (who receives the reward/penalty)
  const authorCitizen = getCitizen(p.author);
  const cityRules = getRulesForCitizen(authorCitizen);

  if (dir === "up" && p.voters[voter] === "up") {
    const baseReward = Math.round(RATES.UPVOTE_REWARD * cityRules.upvoteRewardMult);
    const decayed = getDecayedReward(baseReward);
    const alreadyMinted = getDailyMintedAmount(p.author);
    const allowed = Math.max(0, 500 - alreadyMinted);
    const finalReward = Math.min(decayed, allowed);
    if (finalReward > 0) {
      ledger.mint(p.author, finalReward, `upvote reward (${cityRules.name} multiplier applied)`);
    }
    adjustAura(p.author, 5);
  } else if (dir === "down" && p.voters[voter] === "down") {
    ledger.burn(p.author, RATES.DOWNVOTE_BURN, "ratio tax — downvoted");
    // Napistan citizens take zero aura penalty; Neo Ohio citizens take extra
    if (!cityRules.downvoteAuraImmune) {
      adjustAura(p.author, -cityRules.downvoteAuraPenalty);
    }
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
    // The Supreme Court is not competing for top shitposter. Its verdicts get
    // upvoted like anything else, and it was quietly winning the leaderboard.
    .filter(([address]) => !isStateAccount(address))
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
