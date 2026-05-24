"use client";

import { useEffect, useState } from "react";
import { grossDomesticBrainrot, getActiveEvent } from "@/lib/economy";

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

      const live: string[] = [];
      live.push(`📊 GDB: ${gdb.toLocaleString()} BRAINROT POINTS`);

      if (event) {
        const emoji = EVENT_EMOJI[event.type] ?? "⚡";
        live.push(`${emoji} BREAKING: ${event.title} — ${event.description}`);
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
