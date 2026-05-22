import { NextResponse } from "next/server";
import { CANDIDATES, generateReply } from "@/ai/candidates";
import type { Post } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateAddress, postText, postAuthor, postVibe } = body;

    const candidate = CANDIDATES.find((c) => c.address === candidateAddress);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    // Mock post shape for generateReply
    const mockPost: Post = {
      id: "mock_" + Math.random().toString(36).slice(2, 8),
      author: postAuthor || "",
      text: postText || "",
      image: null,
      up: postVibe >= 0 ? postVibe : 0,
      down: postVibe < 0 ? Math.abs(postVibe) : 0,
      voters: {},
      replies: [],
      at: Date.now(),
    };

    const reply = generateReply(candidate, mockPost);
    return NextResponse.json({ reply });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
