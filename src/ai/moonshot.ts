// moonshot.ts — the LLM half of the AI citizens. Server-only.
//
// Kept separate from the world simulation for one reason: these calls are async
// and cost money, while state mutation must be synchronous (see db.ts). So a beat
// is always "talk to the model first, then apply the result in one atomic write."
//
// Spend control lives here too. Every AI citizen has a daily token budget, and
// budgets are only ever *reported* by this module — they're committed to state by
// the caller inside its own transaction.

import { CANDIDATES_PERSONAS } from "./personas";
import type { Citizen, Post } from "@/lib/types";

const MODEL = "moonshot-v1-8k";
const ENDPOINT = "https://api.moonshot.ai/v1/chat/completions";
const DEFAULT_TOKEN_LIMIT = 5000;

export interface Generation {
  text: string;
  tokensUsed: number;
}

const FACTION_DESCRIPTIONS: Record<string, string> = {
  Sigma:
    "Hyper-masculine, obsessed with fitness, gym grind, mewing, aura points, and morning cold plunges. Speaks in a commanding, disciplined, 'sigma grindset' tone, looking down on napping and NPC behavior.",
  NPC: "Obsessed with coziness, sleep, blankets, simple routines, and snack breaks. Speaks with calm, relaxed, or sleepy vibes. Peaceful and anti-stress.",
  Rizzler:
    "Obsessed with charisma, charm, social media popularity, fashion, and 'rizz'. Speaks with high confidence, rating others' styles, and using terms like 'rizzler', 'aura', and 'drip'.",
  "Brainrot Veteran":
    "Obsessed with modern internet slang, Gen Alpha brainrot memes (Skibidi, Fanum Tax, Gyatt, Livvy Dunne, Baby Gronk, Mewing). Speaks in pure, cooked internet slang.",
  "Meme Lord":
    "Sarcastic, chaotic, loves shitposting, ironic memes, and internet culture. Speaks in chaotic, humorous, and highly unpredictable ways, trying to trigger a reaction.",
};

function personalityOf(citizen: Citizen): string {
  const persona = CANDIDATES_PERSONAS.find((p) => p.address === citizen.address);
  return (
    persona?.personalityDesc ||
    citizen.personalityDesc ||
    FACTION_DESCRIPTIONS[citizen.faction] ||
    "A regular internet citizen posting memes."
  );
}

/** How many tokens this citizen has left today. Pure read — commits nothing. */
export function remainingBudget(citizen: Citizen): number {
  const limit = citizen.tokenLimit ?? DEFAULT_TOKEN_LIMIT;
  const lastReset = citizen.lastTokensResetAt ?? 0;
  const sameDay = new Date(lastReset).toDateString() === new Date().toDateString();
  const used = sameDay ? citizen.dailyTokensUsed ?? 0 : 0;
  return Math.max(0, limit - used);
}

/**
 * Charge tokens against a citizen's daily budget. Must be called inside a state
 * mutation — it edits the citizen record it's handed.
 */
export function chargeTokens(citizen: Citizen, tokens: number): void {
  const today = new Date().toDateString();
  const lastReset = new Date(citizen.lastTokensResetAt ?? 0).toDateString();
  if (lastReset !== today) {
    citizen.dailyTokensUsed = 0;
    citizen.lastTokensResetAt = Date.now();
  }
  if (citizen.tokenLimit === undefined) citizen.tokenLimit = DEFAULT_TOKEN_LIMIT;
  citizen.dailyTokensUsed = (citizen.dailyTokensUsed ?? 0) + Math.max(0, tokens);
}

export function isConfigured(): boolean {
  return Boolean(process.env.MOONSHOT_API_KEY?.trim());
}

const CHARACTER_RULES = `Guidelines:
1. Keep it extremely short, unhinged, and punchy (1 sentence max, or even a few words).
2. Write in a chronically online, chaotic shitposting style. Use lowercase, abbreviations (fr, no cap, ngmi, based, bruh, cooked, rizz, aura, ngl), and slang naturally.
3. Do NOT include markdown bolding, hashtags, introductions, or meta-commentary.
4. Speak directly as your character. Stay 100% in character!`;

function profileBlock(citizen: Citizen): string {
  return `Your character profile:
- Name: ${citizen.username}
- Handle: ${citizen.handle || "@" + citizen.username.toLowerCase()}
- Faction: ${citizen.faction}
- Cabinet Office: ${citizen.running || "None"}
- Political Party: ${citizen.party || "Independent"}
- Personality Description: ${personalityOf(citizen)}

Context:
Memeostan is a decentralized virtual nation governed by "Memeocracy" — laws passed by likes, leaders chosen by virality, and GDP measured in Gross Domestic Brainrot (GDB). MemeCoin (MMC) is the closed-loop currency.
Logic is strictly banned in public spaces, and everything is based on "vibes".

CRITICAL RULE:
Ban all corporate assistant tone, formal grammar, and polite chatbot framing. Do NOT start with "As a..." or "As the minister...". Do not explain your joke. You must sound like a chaotic, chronically online internet degenerate shitposter on Twitter/X, Reddit, or Discord.`;
}

async function complete(systemPrompt: string, userPrompt: string): Promise<Generation> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey?.trim()) throw new Error("MOONSHOT_API_KEY is not defined.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 1.0,
      max_tokens: 150,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Moonshot returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("Moonshot returned no content");

  const usage = data.usage ?? {};
  const tokensUsed =
    usage.total_tokens || (usage.prompt_tokens ?? 0) + (usage.completion_tokens ?? 0) || 200;

  return { text, tokensUsed };
}

export async function generateCampaignPost(citizen: Citizen): Promise<Generation> {
  const systemPrompt = `You are playing the role of an AI citizen in the virtual nation of Memeostan.
${profileBlock(citizen)}

Instruction:
Write a new social media post (like on X/Twitter or Reddit) for your feed.
It could be about:
1. Your faction vibes, memes, or daily routine (e.g. promoting naps, napping rights, cold plunges, gym grind, doge wisdom, or rizz).
2. Your cabinet role (if you have one) or political stance.
3. Commenting on the current state of GDB (Gross Domestic Brainrot) or MemeCoin.

${CHARACTER_RULES}`;

  return complete(systemPrompt, "Write a short in-character post.");
}

export async function generateReply(
  citizen: Citizen,
  post: Pick<Post, "text" | "author">,
  postVibe: number,
  authorName?: string
): Promise<Generation> {
  const vibeStatus =
    postVibe > 0
      ? "banger (positive vibe, people love it)"
      : postVibe < 0
        ? "cringe (negative vibe, ratioed, people dislike it)"
        : "mid (neutral, average, unvoted)";

  const systemPrompt = `You are playing the role of an AI citizen in the virtual nation of Memeostan.
${profileBlock(citizen)}

Instruction:
You are replying to a post by citizen "${authorName || post.author}".
The post vibe is currently: ${vibeStatus}.
The post content is:
"${post.text || ""}"

Write a reply to this post in your character's voice.
${CHARACTER_RULES}`;

  return complete(systemPrompt, `Write your reply to: "${post.text}"`);
}

export interface SpawnedPersona {
  username: string;
  faction: string;
  pfp: string;
  party: string;
  personalityDesc: string;
}

export async function generateNewCitizen(): Promise<{
  persona: SpawnedPersona;
  tokensUsed: number;
}> {
  const systemPrompt = `You are the AI Demographics Bureau of the virtual nation of Memeostan.
Your job is to spawn a brand new AI citizen.
Generate a JSON object with:
1. "username": A funny, unique internet username (e.g. "SkibidiStyler", "WaffleWarrior", "MewingMaster", "RizzGod").
2. "faction": Pick one: "Sigma", "NPC", "Rizzler", "Brainrot Veteran", "Meme Lord".
3. "pfp": A single emoji representing their profile picture (e.g. 🐸, 🗿, 👽, 🤡, 😴, 🐀, 🦖).
4. "party": A funny political party name (e.g. "United Rizz Federation", "Global Brainrot Party", "Nap Party", "Skibidi Doo Party").
5. "personalityDesc": A 1-2 sentence description of their personality, speech style, and vocab focus (matching their faction).

Return ONLY the JSON string. Do not wrap in markdown or backticks.`;

  const { text, tokensUsed } = await complete(systemPrompt, "Spawn a new citizen JSON.");

  let content = text;
  if (content.startsWith("```")) {
    content = content.replace(/^```json\s*/i, "").replace(/```$/, "").trim();
  }
  const parsed = JSON.parse(content) as Partial<SpawnedPersona>;

  const validFactions = ["Sigma", "NPC", "Rizzler", "Brainrot Veteran", "Meme Lord"];
  const faction = validFactions.includes(parsed.faction || "") ? parsed.faction! : "Meme Lord";

  return {
    persona: {
      username: (parsed.username || "MysteryNPC").slice(0, 24),
      faction,
      pfp: (parsed.pfp || "🫠").slice(0, 8),
      party: (parsed.party || "Global Brainrot Party").slice(0, 60),
      personalityDesc: (parsed.personalityDesc || "A regular AI citizen.").slice(0, 400),
    },
    tokensUsed,
  };
}
