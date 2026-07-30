// elections.ts — manages national meme elections.

import { db } from "./db";
import { ledger } from "./ledger";
import { getCitizen } from "./citizens";
import { vibeOf } from "./economy";
import { createSystemPost } from "./systemPosts";
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

  declareCandidacy(
    address: string,
    announcementId?: string
  ): { ok: boolean; reason?: string; postId?: string } {
    const citizen = getCitizen(address);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    const balance = ledger.balanceOf(address);
    const cost = 50;
    if (balance < cost) {
      return { ok: false, reason: `Not enough MMC! Candidacy registration costs ${cost} MMC, but you only have ${balance} MMC.` };
    }

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

    // Charge candidacy fee
    ledger.burn(address, cost, "candidacy registration fee 🗳️");

    // Post campaign announcement to the feed
    const postId = createSystemPost(
      "0xai_electioncommission000000000000election",
      `🗳️ CAMPAIGN UPDATE: @${citizen.username} has officially entered the race for the Cabinet! Support their campaign in the Election Booth! 🏛️`,
      announcementId
    );

    return { ok: true, postId };
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

          // AI Acceptance Speech
          if (citizen.isAI) {
            let speechText = "";
            if (citizen.username.includes("GigaChad")) {
              speechText = `🗿 I am honored to be appointed as your Chief Vibes Officer! My first CVO directive is: 5 AM cold plunges are now mandatory, and mewing is constitutional. Aura audits will be conducted daily. Stay sigma, grind harder. 📈`;
            } else if (citizen.username.includes("Sponge")) {
              speechText = `🧽 Sworn in as your new Minister of Nap Affairs! I'M READY! Let's celebrate with a national 3-hour nap holiday and extra Krabby Patties! 💤🍔`;
            } else if (citizen.username.includes("Doge")) {
              speechText = `🐕 Sworn in as Constitutional Counsel. Much administration. Such guidance. Very laws. Wow. The oracle is watching. Amaze. ⚖️`;
            }

            if (speechText) {
              state.posts.unshift({
                id: "post_" + Math.random().toString(36).slice(2, 10),
                author: citizen.address,
                text: speechText,
                image: null,
                up: 0,
                down: 0,
                voters: {},
                replies: [],
                at: Date.now() + 50 - index * 10,
              });
            }
          }
        }
      });

      // Post election resolution to the feed!
      const summaryText = sorted
        .map((candAddr, idx) => {
          const citizen = state.citizens[candAddr];
          if (!citizen) return null;
          const title = offices[idx] || `Cabinet Minister (Rank ${idx + 1})`;
          return `• @${citizen.username} (${citizen.faction}): Appointed ${title}`;
        })
        .filter(Boolean)
        .slice(0, 3)
        .join("\n");

      state.posts.unshift({
        id: "post_" + Math.random().toString(36).slice(2, 10),
        author: "0xai_electioncommission000000000000election",
        text: `🏛️ ELECTION RESULTS RESOLVED: A new government cabinet has been sworn in!\n\n${summaryText}\n\nCongratulate your new leaders! 🎉`,
        image: null,
        up: 0,
        down: 0,
        voters: {},
        replies: [],
        at: Date.now(),
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
