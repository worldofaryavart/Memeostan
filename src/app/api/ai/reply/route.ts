import { NextResponse } from "next/server";
import { CANDIDATES } from "@/ai/candidates";
import { CANDIDATES_PERSONAS } from "@/ai/personas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateAddress, postText, postAuthor, postVibe } = body;

    const candidate = CANDIDATES.find((c) => c.address === candidateAddress);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("MOONSHOT_API_KEY is not defined. Falling back to local mock replies.");
      return NextResponse.json({ error: "MOONSHOT_API_KEY is not defined." }, { status: 400 });
    }

    const persona = CANDIDATES_PERSONAS.find((p) => p.address === candidateAddress);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found for candidate" }, { status: 404 });
    }

    // Determine the post reception/vibe state
    let vibeStatus = "fresh";
    if (postVibe > 0) {
      vibeStatus = "banger (positive vibe, people love it)";
    } else if (postVibe < 0) {
      vibeStatus = "cringe (negative vibe, ratioed, people dislike it)";
    } else {
      vibeStatus = "mid (neutral, average, unvoted)";
    }

    const systemPrompt = `You are playing the role of an AI citizen in the virtual nation of Memeostan.
Your character profile:
- Name: ${persona.username}
- Handle: ${persona.handle}
- Faction: ${persona.faction}
- Running for/Cabinet Office: ${persona.running}
- Political Party: ${persona.party}

Context:
Memeostan is a decentralized virtual nation governed by "Memeocracy" — laws passed by likes, leaders chosen by virality, and GDP measured in Gross Domestic Brainrot (GDB). MemeCoin (MMC) is the closed-loop currency.
Logic is strictly banned in public spaces, and everything is based on "vibes".

Examples of your typical campaign lines:
${persona.campaignLines.map((line) => `- "${line}"`).join("\n")}

Examples of your typical replies depending on the post vibe:
- Banger replies: ${persona.replyMoods.banger.join(" / ")}
- Mid replies: ${persona.replyMoods.mid.join(" / ")}
- Cringe replies: ${persona.replyMoods.cringe.join(" / ")}
- Fresh/New replies: ${persona.replyMoods.fresh.join(" / ")}

Instruction:
You are replying to a post by citizen "${postAuthor || "unknown"}".
The post vibe is currently: ${vibeStatus}.
The post content is:
"${postText || ""}"

Write a reply to this post in your character's voice.
Guidelines:
1. Keep the reply extremely short and punchy (1 to 2 sentences max).
2. Write in a conversational, social media style (like X/Twitter or Reddit).
3. Do NOT include markdown bolding, hashtags, introductions (like "As GigaChad..."), or meta-commentary.
4. Speak directly as your character. Stay 100% in character!`;

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Write your reply to: "${postText}"` }
        ],
        temperature: 1.0,
        max_tokens: 150,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Moonshot API error response:", errorText);
      return NextResponse.json(
        { error: `Moonshot API returned status ${response.status}: ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      throw new Error("No response content received from Moonshot API");
    }

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Error generating reply via Moonshot:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
