"use client";

import { useEffect, useState } from "react";
import { grossDomesticBrainrot, getActiveEvent } from "@/lib/economy";
import { db } from "@/lib/db";
import { allCitizens } from "@/lib/citizens";

const STATIC_HEADLINES = [
  "MEME WAR VICTORY AGAINST OHIO 🔥",
  "GOVERNMENT ANNOUNCES FREE WI-FI FOR CATS",
  "NEW LAW: 'CRINGE IS FREEDOM' PASSES 420-0",
  "CAT MEMES DECLARED NATIONAL TREASURE 🐱",
  "MINISTER OF NAP AFFAIRS UNREACHABLE (NAPPING)",
];

const EVENT_EMOJI: Record<string, string> = {
  crash:     "💥",
  boom:      "🚀",
  inflation: "📈",
  tax_hike:  "🏦",
  airdrop:   "🪂",
};

export default function Ticker() {
  const [headlines, setHeadlines] = useState<string[]>(STATIC_HEADLINES);

  useEffect(() => {
    function refresh() {
      const gdb = grossDomesticBrainrot();
      const event = getActiveEvent();
      const state = db.get();

      const live: string[] = [];
      live.push(`📊 GDB: ${gdb.toLocaleString()} BRAINROT POINTS`);

      if (event) {
        const emoji = EVENT_EMOJI[event.type] ?? "⚡";
        live.push(`${emoji} BREAKING: ${event.title} — ${event.description}`);
      }

      // The paperwork lives here now rather than in the feed. An arrival is a
      // one-line headline, not a card in the public square.
      const arrivals = allCitizens()
        .filter((c) => c.joinedAt > Date.now() - 30 * 60 * 1000)
        .sort((a, b) => b.joinedAt - a.joinedAt)
        .slice(0, 3);
      if (arrivals.length > 0) {
        live.push(
          `🪪 NEW CITIZENS: ${arrivals.map((c) => `@${c.username}`).join(", ")} — welcome to Memeostan`
        );
      }

      const verdict = (state.trials ?? []).find((t) => t.status === "resolved" && t.verdict);
      if (verdict) {
        live.push(`⚖️ COURT: ${verdict.charge} — ${verdict.verdict}`);
      }

      const activeVote = (state.proposals ?? []).find((p) => p.status === "active");
      if (activeVote) {
        live.push(
          `🗳️ ON THE FLOOR: "${activeVote.title}" — ${activeVote.yesVotes.length} YES / ${activeVote.noVotes.length} NO`
        );
      }

      setHeadlines([...live, ...STATIC_HEADLINES]);
    }

    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const line = headlines.join("  ✶  ");

  return (
    <div className="ticker">
      <span className="label">📢 BREAKING MEME NEWS</span>
      <div className="run">{line}  ✶  {line}</div>
    </div>
  );
}
