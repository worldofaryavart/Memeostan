// moonshot.ts — the state's voice. Server-only.
//
// The LLM budget used to be spent on bot citizens shitposting into the feed.
// It is now spent on the offices that act on you: the warning the Cyber Police
// leaves on your post, the verdict the Supreme Court hands down, the bulletin
// the broadcaster reads. Same ceiling, and the output is attached to something
// that actually happened to you rather than being timeline filler.
//
// Kept separate from the world simulation for one reason: these calls are async
// and cost money, while state mutation must be synchronous (see db.ts). So a beat
// is always "talk to the model first, then apply the result in one atomic write."
//
// Every generator here has a deterministic fallback. The state is not allowed to
// go silent because an API call failed — a citizen who was fined has to be told
// why, key or no key.

import { stateOrgan } from "@/lib/systemAccounts";
import type { Citizen, Post, Trial } from "@/lib/types";
import type { Offence } from "./world";

const MODEL = "moonshot-v1-8k";
const ENDPOINT = "https://api.moonshot.ai/v1/chat/completions";
const DEFAULT_TOKEN_LIMIT = 5000;

export interface Generation {
  text: string;
  tokensUsed: number;
}

/** How many tokens this office has left today. Pure read — commits nothing. */
export function remainingBudget(organ: Citizen): number {
  const limit = organ.tokenLimit ?? DEFAULT_TOKEN_LIMIT;
  const lastReset = organ.lastTokensResetAt ?? 0;
  const sameDay = new Date(lastReset).toDateString() === new Date().toDateString();
  const used = sameDay ? organ.dailyTokensUsed ?? 0 : 0;
  return Math.max(0, limit - used);
}

/**
 * Charge tokens against an office's daily budget. Must be called inside a state
 * mutation — it edits the record it's handed.
 */
export function chargeTokens(organ: Citizen, tokens: number): void {
  const today = new Date().toDateString();
  const lastReset = new Date(organ.lastTokensResetAt ?? 0).toDateString();
  if (lastReset !== today) {
    organ.dailyTokensUsed = 0;
    organ.lastTokensResetAt = Date.now();
  }
  if (organ.tokenLimit === undefined) organ.tokenLimit = DEFAULT_TOKEN_LIMIT;
  organ.dailyTokensUsed = (organ.dailyTokensUsed ?? 0) + Math.max(0, tokens);
}

export function isConfigured(): boolean {
  return Boolean(process.env.MOONSHOT_API_KEY?.trim());
}

const CONTEXT = `Memeostan is a small internet nation. Its citizens are real people.
Its government — the police, the courts, the election commission, the treasury, the
broadcaster — is run by AI, because nobody wants to do the paperwork.

The constitution bans logic in public spaces. The currency is MemeCoin (MMC). The
national output measure is Gross Domestic Brainrot (GDB). All of this is treated by
the state with complete, humourless sincerity.`;

const HOUSE_STYLE = `Style rules:
1. You are an institution, not a personality. Never use first-person plural cheerleading, emoji spam, or internet slang.
2. Be brief: two sentences at most.
3. The comedy is that you are entirely sincere about something absurd. Never wink at it, never explain the joke, never use the words "lol", "haha", or "just kidding".
4. No markdown, no hashtags, no preamble. Output only what the office would say.`;

function officeBlock(address: string): string {
  const organ = stateOrgan(address);
  if (!organ) return "";
  return `You are the ${organ.office} of Memeostan, posting as ${organ.handle}.
Register: ${organ.voice}`;
}

async function complete(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 150
): Promise<Generation> {
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
      // Lower than the old 1.0. An institution should sound the same on Tuesday
      // as it did on Monday; that consistency is what makes it read as a state.
      temperature: 0.7,
      max_tokens: maxTokens,
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

// ── the Cyber Police issues a citation ───────────────────────────────────────

export function fallbackCitation(offence: Offence): string {
  return (
    `⚠️ CYBER POLICE CITATION — ${offence.article}: ${offence.law}\n\n` +
    `Offence: ${offence.charge}\n${offence.basis}\n\n` +
    `This is a formal warning. A citation left unanswered is referred to the Supreme Court. ` +
    `If you believe this article should not exist, the remedy is a repeal bill, not a reply.`
  );
}

export async function generateCitation(
  offence: Offence,
  post: Pick<Post, "text">,
  defendantName: string
): Promise<Generation> {
  const systemPrompt = `${CONTEXT}

${officeBlock("0xai_cyberpolice000000000000000000police")}

You are issuing a formal citation to a citizen for a post. Name the article by
number and title, say plainly what they did, and warn them once. You are polite and
completely immovable.

You did not write this article and you have no view on whether it is a good one —
the citizens passed it and you enforce it. If the citizen dislikes it, their remedy
is to table a repeal bill in the High Chambers, and you may say so.

${HOUSE_STYLE}`;

  const userPrompt = `Citizen: @${defendantName}
Article: ${offence.article} — "${offence.law}"
Offence: ${offence.charge}
Basis: ${offence.basis}
Their post: "${(post.text || "").slice(0, 300)}"

Write the citation.`;

  return complete(systemPrompt, userPrompt, 130);
}

// ── the Supreme Court hands down a verdict ───────────────────────────────────

export function fallbackVerdict(charge: string, isGuilty: boolean): string {
  return isGuilty
    ? `The Court finds the charge of ${charge} proven. The penalty is entered against the defendant's account.`
    : `The Court finds the charge of ${charge} unproven. The defendant is acquitted and compensated.`;
}

export async function generateVerdict(
  trial: Pick<Trial, "charge" | "description">,
  defendantName: string,
  isGuilty: boolean,
  benchVerdict: boolean
): Promise<Generation> {
  const systemPrompt = `${CONTEXT}

${officeBlock("0xai_supremecourt0000000000000000court0")}

You are delivering a verdict. State the finding and the reasoning in one or two
sentences. You take a genuinely stupid charge completely seriously. You never
editorialise about the law itself — you apply it.

${HOUSE_STYLE}`;

  const userPrompt = `Defendant: @${defendantName}
Charge: ${trial.charge}
Case: ${trial.description.slice(0, 400)}
Finding: ${isGuilty ? "GUILTY" : "INNOCENT"}
${benchVerdict ? "No citizen sat on the jury. You are ruling from the bench alone." : "A jury of citizens returned this finding."}

Write the verdict.`;

  return complete(systemPrompt, userPrompt, 140);
}

// ── the broadcaster reads a bulletin ─────────────────────────────────────────

export async function generateBulletin(
  headline: string,
  detail: string
): Promise<Generation> {
  const systemPrompt = `${CONTEXT}

${officeBlock("0xai_statebroadcaster0000000000000press")}

You are reading a short item on the state news service. Report it as though it
carried national consequence.

${HOUSE_STYLE}`;

  return complete(systemPrompt, `Item: ${headline}\nDetail: ${detail}\n\nRead the bulletin.`, 140);
}
