// POST /api/ai/beat — one turn of the AI world, run server-side.
//
// This replaces the campaign loop that used to run in the browser. That loop had
// clients writing posts, votes and mints on behalf of AI ministers, which meant
// anyone could forge them — and every open tab ran its own copy, so the LLM bill
// and the number of elections resolved scaled with the number of spectators.
//
// The shape here is dictated by one constraint: LLM calls are async, state
// mutations must be synchronous. So:
//
//   1. claim the beat   — a guarded write, so only one caller proceeds
//   2. generate         — the async, billable part
//   3. commit           — one atomic transaction applying everything
//
// Claiming before generating is what stops five tabs buying five completions.

import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { mutateState } from "@/lib/serverState";
import { vibeOf } from "@/lib/economy";
import {
  generateCampaignPost,
  generateReply,
  isConfigured,
  remainingBudget,
} from "@/ai/moonshot";
import {
  aiJudiciaryBeat,
  aiVoteInElections,
  aiVoteOnPosts,
  aiVoteOnProposals,
  announceEvent,
  applyCampaignPost,
  applyReply,
  applyTokenSpend,
  dailyTokenCap,
  economyBeat,
  nationHasBudget,
  needsMoreAI,
  pickCampaignAuthor,
  pickReplyTargets,
  shouldStartCampaignPost,
  tokensSpentToday,
} from "@/ai/world";
import type { Citizen, NationState } from "@/lib/types";

// Minimum gap between beats, whatever the number of open tabs.
//
// This was 12s, which is a bot speaking five times a minute into a feed that is
// supposed to feel like people. It also set the floor on bandwidth: a beat that
// does anything changes state, and a state change ships the nation to every open
// tab. Slowing the cast down makes the square calmer and the bill smaller.
const BEAT_COOLDOWN_MS = 45_000;
const MAX_REPLIES_PER_BEAT = 2;

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

interface PlannedReply {
  aiAddress: string;
  postId: string;
  text: string;
  tokensUsed: number;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sinceRev?: number };
  const clientRev = typeof body.sinceRev === "number" ? body.sinceRev : null;

  try {
    // ── 1. claim the beat ────────────────────────────────────────────────────
    let author: Citizen | null = null;
    let replyPlan: { aiAddress: string; postId: string }[] = [];
    let claimedState: NationState | null = null;

    const claim = await mutateState((state) => {
      const now = Date.now();
      if (now - (state.lastAIBeatAt ?? 0) < BEAT_COOLDOWN_MS) {
        return { ok: false, commit: false, skipped: true as const };
      }
      if (!nationHasBudget()) {
        console.warn(
          `Daily LLM budget spent (${tokensSpentToday()}/${dailyTokenCap()} tokens) — the AI citizens are quiet until tomorrow.`
        );
        return { ok: false, commit: false, skipped: true as const };
      }
      state.lastAIBeatAt = now;

      // Decide who talks while we hold the claim, so two beats can't pick the same
      // reply target. Replies are always on the table; an unprompted post only
      // happens when the square is quiet enough to want one.
      author = shouldStartCampaignPost() ? pickCampaignAuthor() : null;
      replyPlan = pickReplyTargets(MAX_REPLIES_PER_BEAT);
      claimedState = state;
      return { ok: true, skipped: false as const };
    });

    if (claim.result.skipped) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    // ── 2. generate (async, billable) ────────────────────────────────────────
    const state = claimedState as unknown as NationState;
    let campaignText: string | null = null;
    let campaignTokens = 0;

    if (isConfigured() && author && remainingBudget(author) > 0) {
      try {
        const generated = await generateCampaignPost(author);
        campaignText = generated.text;
        campaignTokens = generated.tokensUsed;
      } catch (err) {
        console.error("AI campaign post generation failed:", err);
      }
    }

    const replies: PlannedReply[] = [];
    if (isConfigured()) {
      for (const target of replyPlan) {
        const ai = state.citizens[target.aiAddress];
        const post = state.posts.find((p) => p.id === target.postId);
        if (!ai || !post || remainingBudget(ai) <= 0) continue;
        try {
          const generated = await generateReply(
            ai,
            post,
            vibeOf(post),
            state.citizens[post.author]?.username
          );
          replies.push({
            aiAddress: target.aiAddress,
            postId: target.postId,
            text: generated.text,
            tokensUsed: generated.tokensUsed,
          });
        } catch (err) {
          console.error(`AI reply generation failed for ${ai.username}:`, err);
        }
      }
    }

    // ── 3. commit everything in one transaction ──────────────────────────────
    const campaignPostId = campaignText ? shortId("post") : null;
    const eventPostId = shortId("post");

    const applied = await mutateState(() => {
      if (campaignText && campaignPostId && author) {
        applyCampaignPost(author.address, campaignText, campaignPostId);
        applyTokenSpend(author.address, campaignTokens);
      }

      replies.forEach((reply) => {
        applyReply(reply.postId, reply.aiAddress, reply.text);
        applyTokenSpend(reply.aiAddress, reply.tokensUsed);
      });

      aiVoteOnProposals();
      aiVoteOnPosts();
      aiVoteInElections();

      const event = economyBeat();
      if (event) announceEvent(event, eventPostId);

      aiJudiciaryBeat();

      return { ok: true, needsAI: needsMoreAI() };
    });

    const rev = applied.state.rev ?? 0;
    return NextResponse.json({
      ok: true,
      postId: campaignPostId,
      replies: replies.length,
      needsAI: applied.result.needsAI,
      rev,
      ...(clientRev === rev ? { unchanged: true } : { state: publicState(applied.state) }),
    });
  } catch (err) {
    console.error("AI beat failed:", err);
    return NextResponse.json({ ok: false, reason: "The AI citizens are unresponsive." }, { status: 500 });
  }
}
