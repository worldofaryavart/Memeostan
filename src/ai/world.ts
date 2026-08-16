// world.ts — the state doing its job, as pure synchronous logic.
//
// This file used to run a cast of AI citizens: they posted, voted on referendums,
// voted in elections, sat on juries and stood for office. All of that is gone.
// Citizenship belongs to people; what is left here is the civil service.
//
// The line that governs everything below: **the civil service has no franchise.**
// Nothing in this file casts a vote. The state detects, charges, tries, fines,
// pays and announces — it never decides what the law should be. That is the
// citizens' job, and the whole point of the split.
//
// Everything here stays synchronous. The LLM calls that give these offices a
// voice happen first, in src/ai/moonshot.ts, and their text is passed in.

import { db } from "@/lib/db";
import { addReply, createPost, getPost } from "@/lib/posts";
import { checkAndFireEvents, tuneRatesAI, vibeOf } from "@/lib/economy";
import {
  SUPREME_COURT_ADDRESS,
  fileCharge,
  getActiveTrials,
  resolveTrials,
} from "@/lib/judiciary";
import {
  CYBER_POLICE,
  STATE_BROADCASTER,
  isStateAccount,
} from "@/lib/systemAccounts";
import { chargeTokens } from "./moonshot";
import type { Citizen, EconomicEvent, Post } from "@/lib/types";

// ── who the state is talking to ──────────────────────────────────────────────

/** Everyone who holds a passport. State organs are not citizens. */
export function population(): Citizen[] {
  return Object.values(db.get().citizens).filter((c) => !isStateAccount(c.address));
}

// ── policing ─────────────────────────────────────────────────────────────────

export interface Offence {
  postId: string;
  /** The article of the constitution the post is alleged to have broken. */
  article: string;
  charge: string;
  /** Plain statement of what triggered it, handed to the LLM and to the court. */
  basis: string;
}

const SPAM_WINDOW_MS = 5 * 60 * 1000;
const SPAM_THRESHOLD = 3;

/**
 * Words that constitute Logic, which is banned in public spaces under Article 1.
 * A joke, but an enforceable one: the police need something they can actually
 * detect, and "did the citizen try to reason" is at least a rule you can read.
 */
const LOGIC_MARKERS = [
  "actually",
  "technically",
  "the data",
  "statistically",
  "in fact",
  "evidence",
  "objectively",
  "scientifically",
  "correlation",
  "therefore",
];

/**
 * What the Cyber Police found on patrol.
 *
 * Only citizens are policed, only recent posts are in scope, and a post is only
 * ever cited once — the police get one bite, then it is the court's problem.
 */
export function patrol(limit = 1): Offence[] {
  const state = db.get();
  const now = Date.now();
  const found: Offence[] = [];

  const recent = state.posts.filter(
    (p) => p.at >= now - SPAM_WINDOW_MS && !isStateAccount(p.author)
  );

  const alreadyCited = (post: Post) =>
    post.replies.some((r) => r.author === CYBER_POLICE);

  for (const post of recent) {
    if (found.length >= limit) break;
    if (alreadyCited(post)) continue;

    const text = (post.text || "").toLowerCase();

    const marker = LOGIC_MARKERS.find((word) => text.includes(word));
    if (marker) {
      found.push({
        postId: post.id,
        article: "Article 1",
        charge: "LOGIC USAGE IN A PUBLIC SPACE",
        basis: `The post contains the word "${marker}", which is reasoning. Public spaces are for vibes.`,
      });
      continue;
    }

    const byAuthor = recent.filter((p) => p.author === post.author).length;
    if (byAuthor >= SPAM_THRESHOLD) {
      found.push({
        postId: post.id,
        article: "Article 4",
        charge: "SPAM FLOODING THE COMMONS",
        basis: `The author has published ${byAuthor} posts in five minutes. This dilutes Gross Domestic Brainrot.`,
      });
      continue;
    }

    if (post.down >= 3 && post.down > post.up) {
      found.push({
        postId: post.id,
        article: "Article 7",
        charge: "EXCESSIVE CRINGE DISTRIBUTION",
        basis: `The post stands at ${post.down} downvotes against ${post.up} upvotes. This is public vibe contamination.`,
      });
    }
  }

  return found;
}

/** Record a citation on the offending post, in the Cyber Police's own words. */
export function applyCitation(offence: Offence, text: string): void {
  const post = getPost(offence.postId);
  if (!post) return;
  if (post.replies.some((r) => r.author === CYBER_POLICE)) return;
  addReply(offence.postId, CYBER_POLICE, text);
}

// ── prosecution ──────────────────────────────────────────────────────────────

const RETRIAL_COOLDOWN_MS = 5 * 60 * 1000;

/**
 * The state prosecutes a citizen the police already warned.
 *
 * A warning has to come first. The old version invented charges out of nothing —
 * including a 5% chance per beat of charging a citizen with "SUSPICION OF BEING
 * AN NPC" for no reason at all, which is funny exactly once and then is just a
 * random fine. Now every trial traces back to a citation someone can go and read.
 */
export function prosecuteWarnedCitizens(): boolean {
  const state = db.get();
  if (getActiveTrials().length > 0) return false;

  const now = Date.now();

  const cited = state.posts.filter((post) => {
    if (isStateAccount(post.author)) return false;
    const citation = post.replies.find((r) => r.author === CYBER_POLICE);
    if (!citation) return false;
    // Give the citizen a moment between the warning and the charge.
    return now - citation.at > 60_000;
  });

  for (const post of cited) {
    const defendant = post.author;

    const recentlyTried = (state.trials || []).some(
      (t) => t.defendant === defendant && now - t.at < RETRIAL_COOLDOWN_MS
    );
    if (recentlyTried) continue;

    const alreadyCharged = (state.trials || []).some(
      (t) => t.description.includes(post.id)
    );
    if (alreadyCharged) continue;

    const citation = post.replies.find((r) => r.author === CYBER_POLICE)!;
    const citizen = state.citizens[defendant];
    if (!citizen) continue;

    fileCharge(
      SUPREME_COURT_ADDRESS,
      defendant,
      "IGNORING A LAWFUL CITATION",
      `Citizen @${citizen.username} was cited by the Cyber Police and the citation stands unanswered.\n\n` +
        `Citation: "${citation.text}"\n\nRef: ${post.id}`
    );
    return true; // at most one prosecution per beat
  }

  return false;
}

/** Run the docket: resolve what has expired, then charge what deserves charging. */
export function judiciaryBeat(): void {
  resolveTrials();
  prosecuteWarnedCitizens();
}

// ── the economy and the news ─────────────────────────────────────────────────

export function economyBeat(): EconomicEvent | null {
  // No GDB snapshot here — the world tick already takes one on its own schedule,
  // and taking a second one every beat meant every beat changed state, which
  // pushed a fresh copy of the nation to every open tab.
  tuneRatesAI();
  return checkAndFireEvents();
}

/** Post the breaking-news card for an economic event and return its id. */
export function announceEvent(event: EconomicEvent, postId: string): string {
  createPost({
    author: STATE_BROADCASTER,
    text: `📻 STATE BULLETIN: ${event.title}\n\n${event.description}`,
    id: postId,
  });
  return postId;
}

/** The bulletin the broadcaster would read, if it has anything worth reading. */
export function newsworthy(): { headline: string; detail: string } | null {
  const state = db.get();
  const people = population();
  if (people.length === 0) return null;

  const now = Date.now();
  const recent = state.posts.filter((p) => p.at >= now - 30 * 60 * 1000);
  if (recent.length < 3) return null;

  const top = recent
    .filter((p) => !isStateAccount(p.author))
    .sort((a, b) => vibeOf(b) - vibeOf(a))[0];
  if (!top || vibeOf(top) < 6) return null;

  const author = state.citizens[top.author];
  return {
    headline: "post of national significance",
    detail: `A post by @${author?.username ?? "a citizen"} is at ${vibeOf(top)} vibe: "${(top.text || "").slice(0, 140)}"`,
  };
}

// ── LLM spend ────────────────────────────────────────────────────────────────

/** Book LLM spend against the office that did the talking, and against the nation. */
export function applyTokenSpend(address: string, tokens: number): void {
  db.update((s) => {
    const organ = s.citizens[address];
    if (organ) chargeTokens(organ, tokens);

    const today = new Date().toDateString();
    if (!s.llmSpend || s.llmSpend.date !== today) s.llmSpend = { date: today, tokens: 0 };
    s.llmSpend.tokens += Math.max(0, tokens);
  });
}

/**
 * The nation's own daily ceiling on LLM spend. Override with
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
