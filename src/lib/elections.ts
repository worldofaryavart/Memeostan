// elections.ts — manages national meme elections.

import { db } from "./db";
import { ledger } from "./ledger";
import { getCitizen } from "./citizens";
import { vibeOf } from "./economy";
import type { ActiveElection } from "./types";

const ELECTION_DURATION = 5 * 60 * 1000; // 5 minutes for demo/interactive speed

export const elections = {
  getElection(): ActiveElection {
    const s = db.get();
    if (!s.activeElection) {
      // Safety fallback
      return {
        candidates: [
          "0xai_gigachad000000000000000000gigachad",
          "0xai_spongebob00000000000000000sponge00",
          "0xai_dogeoracle0000000000000000000doge00",
        ],
        votes: {},
        endsAt: Date.now() + ELECTION_DURATION,
      };
    }
    return s.activeElection;
  },

  vote(voter: string, candidate: string): { ok: boolean; reason?: string } {
    const voterCit = getCitizen(voter);
    if (!voterCit) return { ok: false, reason: "Voter not registered" };

    const candCit = getCitizen(candidate);
    if (!candCit) return { ok: false, reason: "Candidate not registered" };

    db.update((s) => {
      if (!s.activeElection) return;
      s.activeElection.votes[voter] = candidate;
    });

    return { ok: true };
  },

  declareCandidacy(address: string): { ok: boolean; reason?: string } {
    const citizen = getCitizen(address);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    let err: string | undefined;
    db.update((s) => {
      if (!s.activeElection) return;
      if (s.activeElection.candidates.includes(address)) {
        err = "You are already running!";
        return;
      }
      s.activeElection.candidates.push(address);
      citizen.running = "Candidate"; // mark as running
    });

    if (err) return { ok: false, reason: err };
    return { ok: true };
  },

  resolveElection(): void {
    const now = Date.now();
    const s = db.get();
    if (!s.activeElection || now < s.activeElection.endsAt) return;

    db.update((state) => {
      const election = state.activeElection;
      if (!election) return;

      const candidates = election.candidates;
      const votes = election.votes;

      // 1. Tally support
      const support: Record<string, number> = {};
      candidates.forEach((c) => {
        support[c] = 0;
        // Factor in candidate post vibe (viral support)
        const candidatePosts = state.posts.filter((p) => p.author === c);
        const postVibe = candidatePosts.reduce((sum, p) => sum + vibeOf(p), 0);
        support[c] += postVibe * 10;
      });

      // Factor in votes cast
      Object.entries(votes).forEach(([voterAddr, candAddr]) => {
        if (!candidates.includes(candAddr)) return;
        const voter = state.citizens[voterAddr];
        const weight = voter ? voter.aura : 1000;
        support[candAddr] += weight;
      });

      // Sort candidates by support
      const sorted = [...candidates].sort((a, b) => (support[b] || 0) - (support[a] || 0));

      // Offices to award
      const offices = ["Chief Vibes Officer", "Minister of Nap Affairs", "Constitutional Counsel"];

      // Clear old running titles of AI/humans
      Object.keys(state.citizens).forEach((addr) => {
        if (state.citizens[addr].running) {
          delete state.citizens[addr].running;
        }
      });

      // Appoint winners
      sorted.forEach((candAddr, index) => {
        const citizen = state.citizens[candAddr];
        if (citizen) {
          const office = offices[index] || `Cabinet Minister (Rank ${index + 1})`;
          citizen.running = office; // Assign office

          // Give a small victory/bonus grant to the Chief Vibes Officer
          if (index === 0) {
            state.balances[candAddr] = (state.balances[candAddr] || 0) + 500;
            state.txs.unshift({
              id: "tx_" + Math.random().toString(36).slice(2, 10),
              type: "mint",
              from: "0xtreasury000000000000000000000000treasur",
              to: candAddr,
              amount: 500,
              memo: `election victory grant — Chief Vibes Officer appointed`,
              at: Date.now(),
            });
          }
        }
      });

      // 2. Start next cycle
      state.activeElection = {
        candidates: [
          "0xai_gigachad000000000000000000gigachad",
          "0xai_spongebob00000000000000000sponge00",
          "0xai_dogeoracle0000000000000000000doge00",
        ],
        votes: {},
        endsAt: Date.now() + ELECTION_DURATION,
      };
    });
  },
};
