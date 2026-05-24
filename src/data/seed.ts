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

const CYBER_POLICE_CITIZEN: Citizen = {
  address: "0xai_cyberpolice000000000000000000police",
  username: "cyber_police",
  faction: "NPC",
  pfp: "👮",
  aura: 9999,
  isAI: true,
  joinedAt: Date.now(),
  running: "AI Cyber Police Commissioner",
  city: "Brainrot City",
  party: "Global Brainrot Party",
};

const ELECTION_COMMISSION_CITIZEN: Citizen = {
  address: "0xai_electioncommission000000000000election",
  username: "election_commission",
  faction: "NPC",
  pfp: "🗳️",
  aura: 9999,
  isAI: true,
  joinedAt: Date.now(),
  running: "AI Federal Election Bureau",
  city: "Brainrot City",
  party: "Global Brainrot Party",
};

const CONSTITUTIONAL_COURT_CITIZEN: Citizen = {
  address: "0xai_constitutionalcourt0000000000court",
  username: "constitutional_court",
  faction: "NPC",
  pfp: "⚖️",
  aura: 9999,
  isAI: true,
  joinedAt: Date.now(),
  running: "AI High Judiciary Court",
  city: "Brainrot City",
  party: "Global Brainrot Party",
};

export function bootNation(): void {
  // Ensure AI system citizens are seeded
  db.update((s) => {
    if (!s.citizens[CYBER_POLICE_CITIZEN.address]) {
      s.citizens[CYBER_POLICE_CITIZEN.address] = CYBER_POLICE_CITIZEN;
      s.balances[CYBER_POLICE_CITIZEN.address] = 50000;
    }
    if (!s.citizens[ELECTION_COMMISSION_CITIZEN.address]) {
      s.citizens[ELECTION_COMMISSION_CITIZEN.address] = ELECTION_COMMISSION_CITIZEN;
      s.balances[ELECTION_COMMISSION_CITIZEN.address] = 100000;
    }
    if (!s.citizens[CONSTITUTIONAL_COURT_CITIZEN.address]) {
      s.citizens[CONSTITUTIONAL_COURT_CITIZEN.address] = CONSTITUTIONAL_COURT_CITIZEN;
      s.balances[CONSTITUTIONAL_COURT_CITIZEN.address] = 100000;
    }
  });

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

