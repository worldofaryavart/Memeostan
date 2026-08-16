// POST /api/ai/beat — one turn of the state, run server-side.
//
// This used to be the AI cast's turn: pick a bot, buy it a completion, have it
// shitpost. The cast is gone. What the state does on a beat is its job — patrol,
// prosecute, judge, tune the economy, read the news.
//
// The shape is dictated by one constraint: LLM calls are async, state mutations
// must be synchronous. So:
//
//   1. claim the beat   — a guarded write, so only one caller proceeds
//   2. generate         — the async, billable part
//   3. commit           — one atomic transaction applying everything
//
// Claiming before generating is what stops five tabs buying five completions.

import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { mutateState } from "@/lib/serverState";
import { pendingVerdicts, resolveTrials } from "@/lib/judiciary";
import { createPost } from "@/lib/posts";
import { CYBER_POLICE, STATE_BROADCASTER, SUPREME_COURT } from "@/lib/systemAccounts";
import {
  fallbackCitation,
  generateBulletin,
  generateCitation,
  generateVerdict,
  isConfigured,
  remainingBudget,
} from "@/ai/moonshot";
import {
  announceEvent,
  applyCitation,
  applyTokenSpend,
  dailyTokenCap,
  economyBeat,
  nationHasBudget,
  newsworthy,
  patrol,
  prosecuteWarnedCitizens,
  tokensSpentToday,
  type Offence,
} from "@/ai/world";
import type { NationState } from "@/lib/types";

// Minimum gap between beats, whatever the number of open tabs.
const BEAT_COOLDOWN_MS = 45_000;
const MAX_CITATIONS_PER_BEAT = 1;

function shortId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Can this office afford to speak? Budget is per-office and per-nation. */
function canSpeak(state: NationState, address: string): boolean {
  if (!isConfigured()) return false;
  const organ = state.citizens[address];
  return Boolean(organ) && remainingBudget(organ) > 0;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { sinceRev?: number };
  const clientRev = typeof body.sinceRev === "number" ? body.sinceRev : null;

  try {
    // ── 1. claim the beat ────────────────────────────────────────────────────
    let offences: Offence[] = [];
    let verdicts: ReturnType<typeof pendingVerdicts> = [];
    let bulletin: { headline: string; detail: string } | null = null;
    let claimedState: NationState | null = null;

    const claim = await mutateState((state) => {
      const now = Date.now();
      if (now - (state.lastAIBeatAt ?? 0) < BEAT_COOLDOWN_MS) {
        return { ok: false, commit: false, skipped: true as const };
      }
      state.lastAIBeatAt = now;

      // Decide the docket while we hold the claim, so two beats can't cite the
      // same post or rule on the same trial twice.
      offences = patrol(MAX_CITATIONS_PER_BEAT);
      verdicts = pendingVerdicts();
      bulletin = newsworthy();
      claimedState = state;
      return { ok: true, skipped: false as const };
    });

    if (claim.result.skipped) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const state = claimedState as unknown as NationState;

    // ── 2. generate (async, billable) ────────────────────────────────────────
    //
    // The budget gates the *wording*, never the act. If the nation is out of
    // tokens the police still cite and the court still rules — they just do it in
    // the fallback register. A state that stops enforcing the law because its API
    // bill ran out is not a state.
    const hasBudget = nationHasBudget();
    if (!hasBudget) {
      console.warn(
        `Daily LLM budget spent (${tokensSpentToday()}/${dailyTokenCap()} tokens) — the state is terse until tomorrow.`
      );
    }

    const citationTexts: { offence: Offence; text: string; tokensUsed: number }[] = [];
    for (const offence of offences) {
      const post = state.posts.find((p) => p.id === offence.postId);
      const defendant = post ? state.citizens[post.author] : null;
      if (!post || !defendant) continue;

      let text = fallbackCitation(offence);
      let tokensUsed = 0;

      if (hasBudget && canSpeak(state, CYBER_POLICE)) {
        try {
          const generated = await generateCitation(offence, post, defendant.username);
          text = generated.text;
          tokensUsed = generated.tokensUsed;
        } catch (err) {
          console.error("Citation generation failed; issuing the standard form:", err);
        }
      }
      citationTexts.push({ offence, text, tokensUsed });
    }

    const verdictReasons: Record<string, string> = {};
    let verdictTokens = 0;
    for (const pending of verdicts) {
      if (!hasBudget || !canSpeak(state, SUPREME_COURT)) break;
      try {
        const generated = await generateVerdict(
          pending.trial,
          pending.defendantName,
          pending.isGuilty,
          pending.benchVerdict
        );
        verdictReasons[pending.trial.id] = generated.text;
        verdictTokens += generated.tokensUsed;
      } catch (err) {
        console.error("Verdict generation failed; the Court will state the finding:", err);
      }
    }

    let bulletinText: string | null = null;
    let bulletinTokens = 0;
    if (bulletin && hasBudget && canSpeak(state, STATE_BROADCASTER)) {
      try {
        const item = bulletin as { headline: string; detail: string };
        const generated = await generateBulletin(item.headline, item.detail);
        bulletinText = generated.text;
        bulletinTokens = generated.tokensUsed;
      } catch (err) {
        console.error("Bulletin generation failed; the broadcaster stays quiet:", err);
      }
    }

    // ── 3. commit everything in one transaction ──────────────────────────────
    const eventPostId = shortId("post");
    const bulletinPostId = shortId("post");

    const applied = await mutateState(() => {
      citationTexts.forEach(({ offence, text, tokensUsed }) => {
        applyCitation(offence, text);
        if (tokensUsed) applyTokenSpend(CYBER_POLICE, tokensUsed);
      });

      resolveTrials(verdictReasons);
      if (verdictTokens) applyTokenSpend(SUPREME_COURT, verdictTokens);

      prosecuteWarnedCitizens();

      const event = economyBeat();
      if (event) announceEvent(event, eventPostId);

      if (bulletinText) {
        createPost({ author: STATE_BROADCASTER, text: bulletinText, id: bulletinPostId });
        applyTokenSpend(STATE_BROADCASTER, bulletinTokens);
      }

      return { ok: true };
    });

    const rev = applied.state.rev ?? 0;
    return NextResponse.json({
      ok: true,
      citations: citationTexts.length,
      verdicts: verdicts.length,
      rev,
      ...(clientRev === rev ? { unchanged: true } : { state: publicState(applied.state) }),
    });
  } catch (err) {
    console.error("State beat failed:", err);
    return NextResponse.json(
      { ok: false, reason: "The government is not responding." },
      { status: 500 }
    );
  }
}
