// candidates.ts — loads persona details from personas.ts and implements text generators.

import { CANDIDATES_PERSONAS } from "./personas";
import type { Citizen, Post } from "@/lib/types";

export const CANDIDATES: Citizen[] = CANDIDATES_PERSONAS.map((p) => ({
  address: p.address,
  username: p.username,
  handle: p.handle,
  faction: p.faction,
  running: p.running,
  pfp: p.pfp,
  isAI: p.isAI,
  joinedAt: p.joinedAt,
  aura: p.aura,
}));

export function campaignPost(candidate: Citizen, seed = Date.now()): string {
  const p = CANDIDATES_PERSONAS.find((x) => x.address === candidate.address);
  if (!p) return "vote for me 🗳️";

  // If candidate holds an elected office, 50% chance to post a Department/Office update
  if (candidate.running && candidate.running !== "Candidate" && (Math.abs(seed) % 100) < 50) {
    const officeUpdates: Record<string, string[]> = {
      "Chief Vibes Officer": [
        "🏛️ CVO COMMUNIQUE: Today's aura audit is complete. Mewing levels are up 42%. Stay sigma. 🗿",
        "🏛️ CVO EXECUTIVE DECISION: I have officially banned logic on the feed. Continue posting bangers. 🗿",
        "🏛️ CVO REPORT: GDB (Gross Domestic Brainrot) index is climbing. Excellent work, citizens. 🗿",
        "🏛️ CVO NOTICE: 5 AM cold plunge attendance was only 84%. Aura deduction notices are being prepared. 🗿",
      ],
      "Minister of Nap Affairs": [
        "😴 MNA COMMUNIQUE: Afternoon nap hour is now in session. All screens must be dimmed to 10% brightness. 🧽💤",
        "😴 MNA DIRECTIVE: Soft blankets have been successfully deployed in Rizzland. Sleep well. 🧽💤",
        "😴 MNA LAW ENFORCEMENT: I have vetoed GigaChad's 5 AM cold plunge directive. Back to sleep, citizens. 🧽💤",
        "😴 MNA ANNOUNCEMENT: Today's national holiday is: Sleeping in till noon. Enjoy your dreams. 🧽💤",
      ],
      "Constitutional Counsel": [
        "⚖️ CC DECREE: Much constitution. Checked Article 4. Wow. Doge approved. 🐕",
        "⚖️ CC STATEMENT: Is logic illegal? Yes, very illegal. Such jail. Amaze. 🐕",
        "⚖️ CC MEMORANDUM: We have audited the Cyber Police records. Very warnings. Much grass touched. 🐕",
        "⚖️ CC ORACLE MESSAGE: Follow the vibe. The algorithm is the guide. Wow. 🐕",
      ],
    };

    const updates = officeUpdates[candidate.running] || [
      `🏛️ CABINET UPDATE: Department of ${candidate.running} is running smoothly.`,
    ];
    return updates[Math.abs(seed) % updates.length];
  }

  const lines = p.campaignLines;
  return lines[Math.abs(seed) % lines.length];
}

// Given a post's current reception, an AI candidate fires a reply in character.
export function generateReply(candidate: Citizen, post: Post): string {
  const p = CANDIDATES_PERSONAS.find((x) => x.address === candidate.address);
  if (!p) return "woof! 🐕";
  
  const net = post.up - post.down;
  let mood: "banger" | "mid" | "cringe" | "fresh" = "fresh";
  if (post.up + post.down >= 2) {
    if (net >= 3) mood = "banger";
    else if (net <= -2) mood = "cringe";
    else mood = "mid";
  }
  const lines = p.replyMoods[mood] || p.replyMoods.fresh;
  const seed = post.id.length + candidate.username.length + post.up * 7 - post.down * 3;
  return lines[Math.abs(seed) % lines.length];
}
