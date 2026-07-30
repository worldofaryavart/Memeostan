// POST /api/ai/reply — an AI citizen answers a specific post, and the reply is
// written here rather than handed back for the browser to insert.
//
// The old version returned text and trusted the client to call addReply() with it,
// which meant a client could put any words in any minister's mouth. Now the caller
// only names a post; the server decides who replies and records it.

import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { loadState, mutateState } from "@/lib/serverState";
import { vibeOf } from "@/lib/economy";
import { generateReply, isConfigured, remainingBudget } from "@/ai/moonshot";
import { applyReply, applyTokenSpend, pickDebaters } from "@/ai/world";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      postId?: string;
      candidateAddress?: string;
      sinceRev?: number;
    };
    const clientRev = typeof body.sinceRev === "number" ? body.sinceRev : null;

    if (typeof body.postId !== "string" || !body.postId) {
      return NextResponse.json({ ok: false, reason: "postId is required." }, { status: 400 });
    }
    const postId = body.postId;

    if (!isConfigured()) {
      return NextResponse.json({ ok: false, reason: "No LLM key configured." }, { status: 503 });
    }

    const state = await loadState();
    const post = state.posts.find((p) => p.id === postId);
    if (!post) {
      return NextResponse.json({ ok: false, reason: "No such post." }, { status: 404 });
    }

    // Either a named AI replies, or the server picks who cares enough to.
    const addresses = body.candidateAddress ? [body.candidateAddress] : pickDebaters(postId, 2);

    const generated: { aiAddress: string; text: string; tokensUsed: number }[] = [];

    for (const address of addresses) {
      const ai = state.citizens[address];
      if (!ai?.isAI) continue;
      if (post.replies.some((r) => r.author === address)) continue;
      if (remainingBudget(ai) <= 0) {
        console.warn(`Daily token budget spent for @${ai.username}`);
        continue;
      }
      try {
        const result = await generateReply(
          ai,
          post,
          vibeOf(post),
          state.citizens[post.author]?.username
        );
        generated.push({ aiAddress: address, text: result.text, tokensUsed: result.tokensUsed });
      } catch (err) {
        console.error(`AI reply generation failed for @${ai.username}:`, err);
      }
    }

    if (generated.length === 0) {
      const rev = state.rev ?? 0;
      return NextResponse.json({
        ok: true,
        replies: 0,
        rev,
        ...(clientRev === rev ? { unchanged: true } : { state: publicState(state) }),
      });
    }

    const applied = await mutateState(() => {
      generated.forEach((reply) => {
        applyReply(postId, reply.aiAddress, reply.text);
        applyTokenSpend(reply.aiAddress, reply.tokensUsed);
      });
      return { ok: true };
    });

    const rev = applied.state.rev ?? 0;
    return NextResponse.json({
      ok: true,
      replies: generated.length,
      rev,
      ...(clientRev === rev ? { unchanged: true } : { state: publicState(applied.state) }),
    });
  } catch (err) {
    console.error("AI reply failed:", err);
    return NextResponse.json({ ok: false, reason: "That AI is speechless." }, { status: 500 });
  }
}
