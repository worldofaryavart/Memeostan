// GET /api/state — read the nation.
//
// Read-only. The POST half of this route used to accept an entire nation document
// from the browser and `replaceOne` it into the database, which meant any caller
// could rewrite every balance and election result, and two open tabs would
// silently overwrite each other. Writes now go through /api/action.

import { NextResponse } from "next/server";
import { publicState } from "@/lib/db";
import { loadState } from "@/lib/serverState";

export async function GET() {
  try {
    const state = await loadState();
    // publicState() strips legacy secret keys and replay bookkeeping — those used
    // to be served to every visitor along with the feed.
    return NextResponse.json(publicState(state), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("Could not read nation state:", err);
    return NextResponse.json({ error: "Could not read nation state." }, { status: 500 });
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "The nation is no longer writable in bulk. Send a signed intent to /api/action instead.",
    },
    { status: 405, headers: { Allow: "GET" } }
  );
}
