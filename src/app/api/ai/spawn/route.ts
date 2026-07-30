// POST /api/ai/spawn — the Demographics Bureau invents a new AI citizen.
//
// Previously this hand-rolled its own ledger entry and post objects straight into
// the Mongo document, bypassing ledger.ts entirely (so the mint wasn't hash-chained
// like every other transaction) and clobbering any concurrent write. It now goes
// through the same mint/commit path as everything else.

import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { mutateState } from "@/lib/serverState";
import { generateNewCitizen, isConfigured } from "@/ai/moonshot";
import { needsMoreAI, registerSpawnedAI } from "@/ai/world";

function randomAIAddress(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 35; i++) out += hex[Math.floor(Math.random() * 16)];
  return "0xai_" + out;
}

export async function POST() {
  try {
    if (!isConfigured()) {
      return NextResponse.json({ ok: false, reason: "No LLM key configured." }, { status: 503 });
    }

    // Don't spawn on demand — spawn only when the population actually calls for it,
    // so a caller can't inflate the nation by hammering this route.
    const check = await mutateState(() => ({ commit: false, needed: needsMoreAI() }));
    if (!check.result.needed) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { persona } = await generateNewCitizen();

    const applied = await mutateState(() => {
      if (!needsMoreAI()) return { ok: true, commit: false, skipped: true };
      registerSpawnedAI({
        address: randomAIAddress(),
        username: persona.username,
        faction: persona.faction,
        pfp: persona.pfp,
        party: persona.party,
        personalityDesc: persona.personalityDesc,
        announcementId: `post_${Math.random().toString(36).slice(2, 10)}`,
      });
      return { ok: true, skipped: false };
    });

    return NextResponse.json({
      ok: true,
      skipped: applied.result.skipped,
      state: publicState(applied.state),
    });
  } catch (err) {
    console.error("AI spawning failed:", err);
    return NextResponse.json({ ok: false, reason: "Could not spawn a citizen." }, { status: 500 });
  }
}
