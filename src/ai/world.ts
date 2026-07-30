// world.ts — the AI citizens acting on their own, as pure synchronous state logic.
//
// This used to run in the browser, which meant any client could post, vote and mint
// as any AI minister. It now runs only inside a server-side transaction (see
// /api/ai/beat). Everything here must stay synchronous — the LLM calls that feed it
// happen first, in src/ai/moonshot.ts, and their text is passed in.

import { db } from "@/lib/db";
import { addReply, createPost, getPost, vote as votePost } from "@/lib/posts";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { vibeOf, checkAndFireEvents, recordGdbSnapshot, tuneRatesAI } from "@/lib/economy";
import { ledger } from "@/lib/ledger";
import {
  SUPREME_COURT_ADDRESS,
  ensureSupremeCourtAI,
  fileCharge,
  getActiveTrials,
  resolveTrials,
  voteOnTrial,
} from "@/lib/judiciary";
import { CYBER_POLICE, isStateAccount } from "@/lib/systemAccounts";
import { CANDIDATES } from "./candidates";
import { CANDIDATES_PERSONAS } from "./personas";
import { chargeTokens } from "./moonshot";
import type { Citizen, EconomicEvent } from "@/lib/types";

// ── who speaks next ──────────────────────────────────────────────────────────

/**
 * Pick the citizen who drops the next campaign post.
 *
 * This used to choose at random from the three hardcoded candidates (plus a
 * ghost 40% of the time), which is why the feed sounded like the same three
 * voices on a loop — every AI citizen the Demographics Bureau invented could
 * reply to you, but none of them could ever start a post.
 *
 * Now anyone with a personality is eligible, and whoever has been quiet longest
 * goes first, so the feed rotates instead of repeating. Pure read.
 */
export function pickCampaignAuthor(): Citizen | null {
  const state = db.get();

  const eligible = Object.values(state.citizens).filter(
    (c) =>
      !isStateAccount(c.address) && // the courts don't shitpost
      (c.isAI || c.address.startsWith("0xghost"))
  );
  if (eligible.length === 0) return null;

  const lastSpoke = new Map<string, number>();
  for (const post of state.posts) {
    if (!lastSpoke.has(post.author)) lastSpoke.set(post.author, post.at);
  }

  // Quietest first, then pick randomly among the quietest few so it stays
  // unpredictable rather than strictly round-robin.
  const queue = eligible.sort(
    (a, b) => (lastSpoke.get(a.address) ?? 0) - (lastSpoke.get(b.address) ?? 0)
  );
  const pool = queue.slice(0, Math.min(5, queue.length));
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Should an AI citizen start a post right now?
 *
 * The rule: AI performs to an empty room and listens to a full one. When people
 * are posting, the bots stop competing for the timeline and answer them instead —
 * a reply to a human is the thing worth having, an unprompted bot monologue on
 * top of a live conversation is not.
 */
export function shouldStartCampaignPost(): boolean {
  const state = db.get();
  const now = Date.now();

  const recent = state.posts.filter((p) => p.at >= now - 10 * 60 * 1000);
  const isSynthetic = (address: string) =>
    isStateAccount(address) || Boolean(state.citizens[address]?.isAI);

  const humanPosts = recent.filter((p) => !isSynthetic(p.author)).length;
  if (humanPosts >= 2) return false; // the square is busy; go and reply to them

  // Even in a quiet room, don't let the last stretch of feed become all machine.
  const window = state.posts.slice(0, 12);
  if (window.length >= 8) {
    const synthetic = window.filter((p) => isSynthetic(p.author)).length;
    if (synthetic / window.length > 0.75) return false;
  }

  return true;
}

export interface ReplyTarget {
  aiAddress: string;
  postId: string;
}

/**
 * Which AI citizens want to reply to which recent human posts. An AI speaks up when
 * it's mentioned, when a post is a banger, when it's been boosted, or when the author
 * tipped them — attention has to be earned or bought.
 */
export function pickReplyTargets(limit = 2): ReplyTarget[] {
  const state = db.get();
  const now = Date.now();
  const targets: ReplyTarget[] = [];

  const aiCitizens = Object.values(state.citizens).filter((c) => c.isAI);
  const recentPosts = state.posts.filter((p) => p.at >= now - 5 * 60 * 1000);

  for (const post of recentPosts) {
    const author = state.citizens[post.author];
    if (author?.isAI) continue; // bots don't chase each other's tails here

    for (const ai of aiCitizens) {
      if (targets.length >= limit) return targets;
      if (post.replies.some((r) => r.author === ai.address)) continue;

      const text = (post.text || "").toLowerCase();
      const isMentioned =
        text.includes(ai.username.toLowerCase()) ||
        Boolean(ai.handle && text.includes(ai.handle.toLowerCase()));
      const isBanger = vibeOf(post) > 5;
      const isBoosted = (post.boosts || 0) > 0;
      const wasTipped = state.txs.some(
        (tx) =>
          tx.type === "transfer" &&
          tx.from === post.author &&
          tx.to === ai.address &&
          tx.at >= post.at
      );

      if (isMentioned || isBanger || isBoosted || wasTipped) {
        targets.push({ aiAddress: ai.address, postId: post.id });
      }
    }
  }

  return targets;
}

/** AI citizens who should weigh in on a specific post (used for debate threads). */
export function pickDebaters(postId: string, limit = 2): string[] {
  const post = getPost(postId);
  if (!post) return [];
  return CANDIDATES.filter(
    (c) => c.address !== post.author && !post.replies.some((r) => r.author === c.address)
  )
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
    .map((c) => c.address);
}

// ── applying generated text ──────────────────────────────────────────────────

export function applyCampaignPost(author: string, text: string, postId: string): void {
  createPost({ author, text, id: postId });
}

export function applyReply(postId: string, aiAddress: string, text: string): void {
  const post = getPost(postId);
  if (!post) return;
  if (post.replies.some((r) => r.author === aiAddress)) return; // don't double-speak
  addReply(postId, aiAddress, text);
}

/** Book LLM spend against the citizen who did the talking, and against the nation. */
export function applyTokenSpend(address: string, tokens: number): void {
  db.update((s) => {
    const citizen = s.citizens[address];
    if (citizen) chargeTokens(citizen, tokens);

    const today = new Date().toDateString();
    if (!s.llmSpend || s.llmSpend.date !== today) s.llmSpend = { date: today, tokens: 0 };
    s.llmSpend.tokens += Math.max(0, tokens);
  });
}

/**
 * The nation's own daily ceiling on LLM spend. Per-citizen budgets used to be the
 * only limit, which was fine when three citizens could talk; now that every AI
 * citizen is eligible, the ceiling has to be national. Override with
 * MEMEOSTAN_DAILY_TOKEN_CAP.
 */
export function dailyTokenCap(): number {
  const configured = Number(process.env.MEMEOSTAN_DAILY_TOKEN_CAP);
  return Number.isFinite(configured) && configured > 0 ? configured : 60_000;
}

export function tokensSpentToday(): number {
  const spend = db.get().llmSpend;
  return spend && spend.date === new Date().toDateString() ? spend.tokens : 0;
}

export function nationHasBudget(): boolean {
  return tokensSpentToday() < dailyTokenCap();
}

// ── the unpaid parts of a beat (no LLM involved) ──────────────────────────────

export function aiVoteOnProposals(): void {
  const activeProposals = governance.allProposals().filter((p) => p.status === "active");
  if (activeProposals.length === 0) return;

  CANDIDATES_PERSONAS.forEach((persona) => {
    activeProposals.forEach((proposal) => {
      if (
        proposal.yesVotes.includes(persona.address) ||
        proposal.noVotes.includes(persona.address)
      ) {
        return;
      }

      const title = proposal.title.toLowerCase();
      const desc = proposal.description.toLowerCase();
      const mentions = (words: string[]) => words.some((w) => title.includes(w) || desc.includes(w));

      let choice: "yes" | "no" = Math.random() > 0.5 ? "yes" : "no";

      if (persona.username.includes("GigaChad")) {
        if (mentions(["sigma", "mewing", "cold plunge", "grind", "gdb", "work", "gym", "lift"])) choice = "yes";
        else if (mentions(["nap", "sleep", "break", "rest", "lazy"])) choice = "no";
      } else if (persona.username.includes("Sponge")) {
        if (mentions(["nap", "sleep", "break", "rest", "blanket", "holiday", "snack", "krabby", "burger"])) choice = "yes";
        else if (mentions(["cold plunge", "mewing", "grind", "5am"])) choice = "no";
      } else if (persona.username.includes("Doge")) {
        if (mentions(["rizz", "wow", "amaze", "constitution", "court", "charter", "silence", "oracle"])) choice = "yes";
        else if (mentions(["cringe", "spam", "ratio"])) choice = "no";
      }

      governance.vote(proposal.id, persona.address, choice);
    });
  });
}

export function aiVoteOnPosts(): void {
  const posts = db.get().posts.slice(0, 8);
  if (posts.length === 0) return;

  CANDIDATES.forEach((candidate) => {
    if (Math.random() > 0.4) {
      const post = posts[Math.floor(Math.random() * posts.length)];
      if (post.author !== candidate.address && !post.voters[candidate.address]) {
        votePost(post.id, candidate.address, Math.random() > 0.3 ? "up" : "down");
      }
    }
  });
}

export function aiVoteInElections(): void {
  CANDIDATES.forEach((candidate) => {
    const election = elections.getElection();
    if (!election || election.votes[candidate.address]) return;
    // Mostly vote for yourself. It's that kind of democracy.
    const target =
      Math.random() > 0.2
        ? candidate.address
        : election.candidates.find((a) => a !== candidate.address) || candidate.address;
    elections.vote(candidate.address, target);
  });
}

export function economyBeat(): EconomicEvent | null {
  // No GDB snapshot here — the world tick already takes one on its own schedule,
  // and taking a second one every beat meant every beat changed state, which
  // pushed a fresh copy of the nation to every open tab.
  tuneRatesAI();
  return checkAndFireEvents();
}

/** Post the breaking-news card for an economic event and return its id. */
export function announceEvent(event: EconomicEvent, postId: string): string {
  const anchor = CANDIDATES[0].address; // GigaChad reads the news
  createPost({
    author: anchor,
    text: `📰 BREAKING: ${event.title}\n\n${event.description}`,
    id: postId,
  });
  return postId;
}

export function aiJudiciaryBeat(): void {
  ensureSupremeCourtAI();
  resolveTrials();

  // AI candidates sit on the jury.
  const activeTrials = getActiveTrials();
  if (activeTrials.length > 0) {
    CANDIDATES.forEach((candidate) => {
      if (Math.random() <= 0.4) return;
      const trial = activeTrials[Math.floor(Math.random() * activeTrials.length)];
      if (
        trial.yesVotes.includes(candidate.address) ||
        trial.noVotes.includes(candidate.address)
      ) {
        return;
      }

      let verdict: "guilty" | "innocent" = Math.random() > 0.5 ? "guilty" : "innocent";
      if (candidate.username.includes("GigaChad")) {
        if (/CRINGE|NPC|SPAM/.test(trial.charge)) verdict = "guilty";
      } else if (candidate.username.includes("Sponge")) {
        verdict = trial.charge.includes("SPAM") ? "guilty" : "innocent";
      }

      voteOnTrial(trial.id, candidate.address, verdict);
    });
  }

  // With no trial running, the court goes looking for someone to prosecute.
  if (getActiveTrials().length === 0 && Math.random() > 0.3) {
    prosecuteSomebody();
  }
}

function prosecuteSomebody(): void {
  const state = db.get();
  const humans = Object.values(state.citizens).filter((c) => !c.isAI);
  if (humans.length === 0) return;

  const shuffled = [...humans].sort(() => Math.random() - 0.5);

  for (const citizen of shuffled) {
    // One trial per citizen per five minutes. Even here there's due process.
    const recentlyTried = (state.trials || []).some(
      (t) => t.defendant === citizen.address && Date.now() - t.at < 300_000
    );
    if (recentlyTried) continue;

    let charge = "";
    let description = "";

    const fiveMinsAgo = Date.now() - 300_000;
    const recentPosts = state.posts.filter(
      (p) => p.author === citizen.address && p.at >= fiveMinsAgo
    );

    if (recentPosts.length >= 3) {
      charge = "SPAM FLOODING THE COMMONS";
      description = `Citizen @${citizen.username} is posting too fast (${recentPosts.length} posts in last 5 minutes). This slop level threatens our circulating supply and dilutes GDB.`;
    }

    if (!charge) {
      const logicWarned = state.posts
        .filter((p) => p.author === citizen.address)
        .some((p) =>
          p.replies.some(
            (r) => r.author === CYBER_POLICE && r.text.toLowerCase().includes("logic")
          )
        );
      if (logicWarned) {
        charge = "LOGIC USAGE IN A PUBLIC SPACE";
        description = `Citizen @${citizen.username} was warned by the Cyber Police for using facts, reasoning, or scientific thinking in their posts. Under Article 1, we mandate pure vibe.`;
      }
    }

    if (!charge) {
      const tenMinsAgo = Date.now() - 600_000;
      const ratioed = state.posts.find(
        (p) =>
          p.author === citizen.address && p.at >= tenMinsAgo && p.down >= 3 && p.down > p.up
      );
      if (ratioed) {
        charge = "EXCESSIVE CRINGE DISTRIBUTION";
        description = `Citizen @${citizen.username} published a meme that received a net negative ratio (${ratioed.down} downvotes vs ${ratioed.up} upvotes). This is public vibe contamination.`;
      }
    }

    if (!charge && Math.random() < 0.05) {
      charge = "SUSPICION OF BEING AN NPC";
      description = `An audit of citizen @${citizen.username}'s activities has raised red flags. They are exhibiting repetitive, un-sigmalike patterns. Turing test required.`;
    }

    if (charge) {
      fileCharge(SUPREME_COURT_ADDRESS, citizen.address, charge, description);
      return; // at most one prosecution per beat
    }
  }
}

// ── population ───────────────────────────────────────────────────────────────

/**
 * The AI population is a fixed cast, not a multiple of the human one.
 *
 * It used to target two AI citizens per human, which is backwards: every person
 * who joined made the country *more* synthetic, and the feed drowned them in
 * exactly the proportion they were trying to join. A country needs enough
 * characters to feel inhabited when it's empty; past that, more bots is just
 * more bots.
 */
export const AI_CAST_SIZE = 8;

export function needsMoreAI(): boolean {
  const cast = Object.values(db.get().citizens).filter(
    (c) => c.isAI && !isStateAccount(c.address)
  ).length;
  return cast < AI_CAST_SIZE;
}

export interface SpawnRecord {
  address: string;
  username: string;
  faction: string;
  pfp: string;
  party: string;
  personalityDesc: string;
}

export function registerSpawnedAI(spawn: SpawnRecord): void {
  const city =
    spawn.faction === "Sigma"
      ? "Neo Ohio"
      : spawn.faction === "NPC"
        ? "Napistan"
        : spawn.faction === "Rizzler"
          ? "Rizzland"
          : "Brainrot City";

  db.update((s) => {
    if (s.citizens[spawn.address]) return;
    s.citizens[spawn.address] = {
      address: spawn.address,
      username: spawn.username,
      faction: spawn.faction,
      pfp: spawn.pfp,
      aura: 1000,
      isAI: true,
      joinedAt: Date.now(),
      running: "Candidate",
      city,
      party: spawn.party,
      personalityDesc: spawn.personalityDesc,
    };
    if (s.balances[spawn.address] == null) s.balances[spawn.address] = 0;
  });

  ledger.mint(spawn.address, 1000, "AI campaign treasury");

  // No feed post for an arrival. "@X has claimed their passport" was 7% of the
  // whole timeline and interesting to nobody; new citizens show up in the ticker
  // and the population count instead, and this one will introduce themselves the
  // next time they get picked to speak.
}
