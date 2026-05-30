import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/mongodb";
import type { Citizen } from "@/lib/types";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey || apiKey.trim() === "") {
      return NextResponse.json({ error: "MOONSHOT_API_KEY is not defined." }, { status: 400 });
    }

    const systemPrompt = `You are the AI Demographics Bureau of the virtual nation of Memeostan.
Your job is to spawn a brand new AI citizen.
Generate a JSON object with:
1. "username": A funny, unique internet username (e.g. "SkibidiStyler", "WaffleWarrior", "MewingMaster", "RizzGod").
2. "faction": Pick one: "Sigma", "NPC", "Rizzler", "Brainrot Veteran", "Meme Lord".
3. "pfp": A single emoji representing their profile picture (e.g. 🐸, 🗿, 👽, 🤡, 😴, 🐀, 🦖).
4. "party": A funny political party name (e.g. "United Rizz Federation", "Global Brainrot Party", "Nap Party", "Skibidi Doo Party").
5. "personalityDesc": A 1-2 sentence description of their personality, speech style, and vocab focus (matching their faction).

Return ONLY the JSON string. Do not wrap in markdown or backticks.`;

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
          { role: "user", content: "Spawn a new citizen JSON." }
        ],
        temperature: 1.0,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `API failed: ${errText}` }, { status: response.status });
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content?.trim();
    
    // Clean potential markdown wrap
    if (content.startsWith("```")) {
      content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }
    
    const parsed = JSON.parse(content);
    const { username, faction, pfp, party, personalityDesc } = parsed;

    const { db: mongoDb } = await connectToDatabase();
    const collection = mongoDb.collection("state");
    const stateDoc = await collection.findOne({ _id: "nation" as any });
    if (!stateDoc) {
      return NextResponse.json({ error: "State not found" }, { status: 404 });
    }

    // Generate address
    const hex = "0123456789abcdef";
    let randHex = "";
    for (let i = 0; i < 35; i++) {
      randHex += hex[Math.floor(Math.random() * 16)];
    }
    const address = "0xai_" + randHex;

    const newCitizen: Citizen & { party: string; personalityDesc: string } = {
      address,
      username,
      faction,
      pfp: pfp || "🫠",
      aura: 1000,
      isAI: true,
      joinedAt: Date.now(),
      running: "Candidate",
      city: faction === "Sigma" ? "Neo Ohio" : faction === "NPC" ? "Napistan" : faction === "Rizzler" ? "Rizzland" : "Brainrot City",
      party: party || "Global Brainrot Party",
      personalityDesc: personalityDesc || "A regular AI citizen.",
    };

    // Update state directly in MongoDB
    stateDoc.citizens[address] = newCitizen;
    stateDoc.balances[address] = 1000; // Campaign budget
    
    // Add welcome tx
    const prevTx = stateDoc.txs[0];
    const prevHash = prevTx ? prevTx.id : "genesis";
    
    // Simple hash helper
    let h = 0;
    const str = `${prevHash}-mint-0xtreasury000000000000000000000000treasur-${address}-1000-${Date.now()}`;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    const txId = "tx_" + Math.abs(h).toString(16);

    stateDoc.txs.unshift({
      id: txId,
      type: "mint",
      from: "0xtreasury000000000000000000000000treasur",
      to: address,
      amount: 1000,
      memo: "AI campaign treasury",
      at: Date.now(),
    });

    // Create a feed post to announce
    const postId = "post_" + Math.random().toString(36).slice(2, 10);
    stateDoc.posts.unshift({
      id: postId,
      author: "0xai_supremecourt0000000000000000court0", // Supreme Court Judge as the official announcer
      text: `📢 CITIZENSHIP ANNOUNCEMENT: A new AI citizen, @${username}, has claimed their passport and joined the ${faction} faction! Welcome to Memeostan! 🪪`,
      image: null,
      up: 0,
      down: 0,
      voters: {},
      replies: [],
      at: Date.now(),
    });

    await collection.replaceOne({ _id: "nation" as any }, stateDoc);

    return NextResponse.json({ success: true, citizen: newCitizen });
  } catch (err: any) {
    console.error("AI Spawning error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
