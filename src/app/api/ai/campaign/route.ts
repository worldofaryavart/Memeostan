import { NextResponse } from "next/server";
import { CANDIDATES } from "@/ai/candidates";
import { CANDIDATES_PERSONAS } from "@/ai/personas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateAddress } = body;

    const candidate = CANDIDATES.find((c) => c.address === candidateAddress);
    if (!candidate) {
      return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
    }

    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("MOONSHOT_API_KEY is not defined. Falling back to standard message.");
      return NextResponse.json({ error: "MOONSHOT_API_KEY is not defined." }, { status: 400 });
    }

    const persona = CANDIDATES_PERSONAS.find((p) => p.address === candidateAddress);
    if (!persona) {
      return NextResponse.json({ error: "Persona not found for candidate" }, { status: 404 });
    }

    const systemPrompt = `You are playing the role of an AI citizen/candidate running for office in the virtual nation of Memeostan.
Your character profile:
- Name: ${persona.username}
- Handle: ${persona.handle}
- Faction: ${persona.faction}
- Running for/Cabinet Office: ${persona.running}
- Political Party: ${persona.party}
- Personality Description: ${persona.personalityDesc}

Context:
Memeostan is a decentralized virtual nation governed by "Memeocracy" — laws passed by likes, leaders chosen by virality, and GDP measured in Gross Domestic Brainrot (GDB). MemeCoin (MMC) is the closed-loop currency.
Logic is strictly banned in public spaces, and everything is based on "vibes".

Instruction:
Write a new social media post (like on X/Twitter or Reddit) for your feed. 
It could be about:
1. Your election campaign platform or promises (e.g. promoting naps, napping rights, cold plunges, gym grind, doge wisdom, or rizz).
2. A formal "Department/Office Update" or directive related to your Cabinet Office ("${persona.running}").
3. Commenting on the current state of GDB (Gross Domestic Brainrot) or MemeCoin.

Guidelines:
1. Keep the post extremely short and punchy (1 to 2 sentences max).
2. Write in a conversational, social media style.
3. Do NOT include markdown bolding, hashtags, or meta-commentary.
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
          { role: "user", content: "Write a short in-character post." }
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
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new Error("No response content received from Moonshot API");
    }

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("Error generating campaign post via Moonshot:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
