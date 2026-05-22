// seed.ts — boot the nation. Registers the AI candidates and drops some seed
// posts so the feed is never an empty, sad public square on first visit.

import { db } from "@/lib/db";
import { ensureAICitizen } from "@/lib/citizens";
import { createPost } from "@/lib/posts";
import { CANDIDATES, campaignPost } from "@/ai/candidates";
import type { Citizen } from "@/lib/types";

const SEED_HUMAN_POSTS = [
  { who: 0, text: "just got my passport. aura starts at 1000?? we're so back 🫡" },
  { who: 1, text: "the 3 AM clause is the only law that has ever protected me" },
  { who: 2, text: "GDB is up 12% and I personally take full credit for it" },
];

const GHOSTS = [
  { username: "NapEnjoyer", faction: "NPC", pfp: "😴" },
  { username: "SigmaGrindset", faction: "Sigma", pfp: "🗿" },
  { username: "RatioVictim", faction: "Rizzler", pfp: "💀" },
];

export function bootNation(): void {
  // Register AI candidates once (idempotent).
  CANDIDATES.forEach(ensureAICitizen);

  // Ensure cabinet roles are populated on boot if the cabinet is currently empty
  const anyCabinet = Object.values(db.get().citizens).some(
    (c) => c.isAI && c.running && c.running !== "Candidate"
  );
  if (!anyCabinet) {
    db.update((s) => {
      CANDIDATES.forEach((cand) => {
        const citizen = s.citizens[cand.address];
        if (citizen) {
          citizen.running = cand.running;
        }
      });
    });
  }

  GHOSTS.forEach((g, i) => {
    const addr = "0xghost" + i + "0000000000000000000000000000000ghost";
    db.update((st) => {
      if (!st.citizens[addr]) {
        const ghost: Citizen = {
          address: addr,
          username: g.username,
          faction: g.faction,
          pfp: g.pfp,
          aura: 900 + i * 120,
          isAI: false,
          joinedAt: Date.now(),
        };
        st.citizens[addr] = ghost;
        st.balances[addr] = 300;
      }
    });
  });
}

