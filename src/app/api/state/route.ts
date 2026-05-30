import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { freshState } from "@/lib/db";

export async function GET() {
  try {
    const { db } = await connectToDatabase();
    const collection = db.collection("state");
    let state = await collection.findOne({ _id: "nation" as any });

    if (!state) {
      const defaultState = freshState();
      // Insert default state
      await collection.insertOne({ _id: "nation" as any, ...defaultState });
      state = { _id: "nation" as any, ...defaultState };
    }

    // Strip MongoDB _id from returned object
    const { _id, ...rest } = state;
    return NextResponse.json(rest);
  } catch (err: any) {
    console.error("MongoDB GET State error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { db } = await connectToDatabase();
    const collection = db.collection("state");

    const existing = await collection.findOne({ _id: "nation" as any });
    if (existing && existing.citizens && body.citizens) {
      for (const addr of Object.keys(body.citizens)) {
        const incomingCit = body.citizens[addr];
        const existingCit = existing.citizens[addr];
        if (existingCit && incomingCit) {
          if (existingCit.dailyTokensUsed !== undefined) {
            incomingCit.dailyTokensUsed = existingCit.dailyTokensUsed;
          }
          if (existingCit.tokenLimit !== undefined) {
            incomingCit.tokenLimit = existingCit.tokenLimit;
          }
          if (existingCit.lastTokensResetAt !== undefined) {
            incomingCit.lastTokensResetAt = existingCit.lastTokensResetAt;
          }
        }
      }
    }

    // Wipes/updates the entire nation document
    await collection.replaceOne(
      { _id: "nation" as any },
      { _id: "nation" as any, ...body },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("MongoDB POST State error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
