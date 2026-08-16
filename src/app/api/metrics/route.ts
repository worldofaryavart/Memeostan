// GET /api/metrics — the country's own read on whether it is working.
//
// Public on purpose. Everything it reports is already visible in /api/state to
// anyone who cares to count it; publishing the count costs nothing and keeps the
// project honest about its own numbers, which is harder to do when they are
// private and can be quietly reframed.
//
// It contains no personal data — only aggregates and one derived verdict. No
// addresses, no usernames, no per-person timeline.

import { NextResponse } from "next/server";
import { loadState } from "@/lib/serverState";
import { computeMetrics, readiness } from "@/lib/metrics";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const metrics = computeMetrics(await loadState());
    return NextResponse.json(
      { ...metrics, readiness: readiness(metrics) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("metrics failed:", err);
    return NextResponse.json({ ok: false, reason: "Could not read the nation." }, { status: 500 });
  }
}
