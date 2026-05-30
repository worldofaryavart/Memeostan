import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import { CANDIDATES_PERSONAS } from "@/ai/personas";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { candidateAddress, postText, postAuthor, postVibe } = body;

    const { db } = await connectToDatabase();
    const collection = db.collection("state");
    const stateDoc = await collection.findOne({ _id: "nation" as any });

    if (!stateDoc) {
      return NextResponse.json({ error: "Nation state not found" }, { status: 404 });
    }

    const citizen = stateDoc.citizens?.[candidateAddress];
    if (!citizen) {
      return NextResponse.json({ error: "Citizen not found in state" }, { status: 404 });
    }

    if (!citizen.isAI) {
      return NextResponse.json({ error: "Citizen is not an AI" }, { status: 400 });
    }

    // Daily Token Budget Check
    if (citizen.tokenLimit === undefined) {
      citizen.tokenLimit = 5000; // default 5k tokens per day
    }
    if (citizen.dailyTokensUsed === undefined) {
      citizen.dailyTokensUsed = 0;
    }
    if (citizen.lastTokensResetAt === undefined) {
      citizen.lastTokensResetAt = Date.now();
    }

    const lastResetDate = new Date(citizen.lastTokensResetAt).toDateString();
    const nowDate = new Date().toDateString();
    if (lastResetDate !== nowDate) {
      citizen.dailyTokensUsed = 0;
      citizen.lastTokensResetAt = Date.now();
    }

    if (citizen.dailyTokensUsed >= citizen.tokenLimit) {
      console.warn(`Token budget exceeded for citizen @${citizen.username} (${citizen.dailyTokensUsed}/${citizen.tokenLimit})`);
      return NextResponse.json({ error: "Token budget exceeded for today" }, { status: 429 });
    }

    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      console.warn("MOONSHOT_API_KEY is not defined.");
      return NextResponse.json({ error: "MOONSHOT_API_KEY is not defined." }, { status: 400 });
    }

    const persona = CANDIDATES_PERSONAS.find((p) => p.address === candidateAddress);

    const factionDescs: Record<string, string> = {
      Sigma: "Hyper-masculine, obsessed with fitness, gym grind, mewing, aura points, and morning cold plunges. Speaks in a commanding, disciplined, 'sigma grindset' tone, looking down on napping and NPC behavior.",
      NPC: "Obsessed with coziness, sleep, blankets, simple routines, and snack breaks. Speaks with calm, relaxed, or sleepy vibes. Peaceful and anti-stress.",
      Rizzler: "Obsessed with charisma, charm, social media popularity, fashion, and 'rizz'. Speaks with high confidence, rating others' styles, and using terms like 'rizzler', 'aura', and 'drip'.",
      "Brainrot Veteran": "Obsessed with modern internet slang, Gen Alpha brainrot memes (Skibidi, Fanum Tax, Gyatt, Livvy Dunne, Baby Gronk, Mewing). Speaks in pure, cooked internet slang.",
      "Meme Lord": "Sarcastic, chaotic, loves shitposting, ironic memes, and internet culture. Speaks in chaotic, humorous, and highly unpredictable ways, trying to trigger a reaction."
    };

    const personality = persona?.personalityDesc || citizen.personalityDesc || factionDescs[citizen.faction] || "A regular internet citizen posting memes.";

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
- Name: ${citizen.username}
- Handle: ${citizen.handle || "@" + citizen.username.toLowerCase()}
- Faction: ${citizen.faction}
- Cabinet Office: ${citizen.running || "None"}
- Political Party: ${citizen.party || "Independent"}
- Personality Description: ${personality}

Context:
Memeostan is a decentralized virtual nation governed by "Memeocracy" — laws passed by likes, leaders chosen by virality, and GDP measured in Gross Domestic Brainrot (GDB). MemeCoin (MMC) is the closed-loop currency.
Logic is strictly banned in public spaces, and everything is based on "vibes".

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

    // Record token usage
    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;
    const totalTokens = data.usage?.total_tokens || (promptTokens + completionTokens) || 200;

    citizen.dailyTokensUsed += totalTokens;
    stateDoc.citizens[candidateAddress] = citizen;

    await collection.replaceOne({ _id: "nation" as any }, stateDoc);

    return NextResponse.json({ reply });
  } catch (err: any) {
    console.error("Error generating reply via Moonshot:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
