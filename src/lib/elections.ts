// elections.ts — national meme elections.
//
// Only citizens stand and only citizens vote. The three AI candidates that used
// to be hardcoded into every ballot — and that voted for themselves — are gone,
// along with their acceptance speeches. The Election Commission runs the ballot;
// it does not appear on it.
//
// Which means a ballot can now be empty, and that is a legitimate outcome rather
// than a bug to paper over. A country where nobody stood for office has no
// government, and the civil service keeps running it regardless. That is the
// joke, and it is also just true.

import { db } from "./db";
import { ledger } from "./ledger";
import { getCitizen } from "./citizens";
import { vibeOf } from "./economy";
import { createSystemPost } from "./systemPosts";
import { ELECTION_COMMISSION, isStateAccount } from "./systemAccounts";
import type { ActiveElection } from "./types";

const ELECTION_DURATION = 5 * 60 * 1000; // 5 minutes for demo/interactive speed
const CANDIDACY_COST = 50;

/** The offices citizens are elected to, in order of the support they command. */
export const OFFICES = [
  "Chief Vibes Officer",
  "Minister of Nap Affairs",
  "Constitutional Counsel",
];

function emptyBallot(endsAt: number): ActiveElection {
  return { candidates: [], votes: {}, endsAt };
}

export const elections = {
  getElection(): ActiveElection {
    const s = db.get();
    if (!s.activeElection) return emptyBallot(Date.now() + ELECTION_DURATION);
    return s.activeElection;
  },

  vote(voter: string, candidate: string): { ok: boolean; reason?: string } {
    if (isStateAccount(voter)) {
      return { ok: false, reason: "The civil service does not vote." };
    }
    const voterCit = getCitizen(voter);
    if (!voterCit) return { ok: false, reason: "Voter not registered" };

    const candCit = getCitizen(candidate);
    if (!candCit) return { ok: false, reason: "Candidate not registered" };
    if (isStateAccount(candidate)) {
      return { ok: false, reason: "That office is not standing for election." };
    }

    db.update((s) => {
      if (!s.activeElection) return;
      if (!s.activeElection.candidates.includes(candidate)) return;
      s.activeElection.votes[voter] = candidate;
    });

    return { ok: true };
  },

  declareCandidacy(
    address: string,
    announcementId?: string
  ): { ok: boolean; reason?: string; postId?: string } {
    if (isStateAccount(address)) {
      return { ok: false, reason: "Organs of the state cannot stand for election." };
    }

    const citizen = getCitizen(address);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    const balance = ledger.balanceOf(address);
    if (balance < CANDIDACY_COST) {
      return {
        ok: false,
        reason: `Not enough MMC! Candidacy registration costs ${CANDIDACY_COST} MMC, but you only have ${balance} MMC.`,
      };
    }

    let err: string | undefined;
    db.update((s) => {
      if (!s.activeElection) {
        s.activeElection = emptyBallot(Date.now() + ELECTION_DURATION);
      }
      if (s.activeElection.candidates.includes(address)) {
        err = "You are already running!";
        return;
      }
      s.activeElection.candidates.push(address);
      const record = s.citizens[address];
      if (record) record.running = "Candidate";
    });

    if (err) return { ok: false, reason: err };

    ledger.burn(address, CANDIDACY_COST, "candidacy registration fee 🗳️");

    const postId = createSystemPost(
      ELECTION_COMMISSION,
      `🗳️ NOMINATION FILED: @${citizen.username} has been entered on the ballot. ` +
        `Polls close shortly. Citizens may vote in the Election Booth.`,
      announcementId
    );

    return { ok: true, postId };
  },

  /** Returns true if an election actually closed, so callers know state changed. */
  resolveElection(): boolean {
    const now = Date.now();
    const s = db.get();
    if (!s.activeElection || now < s.activeElection.endsAt) return false;

    db.update((state) => {
      const election = state.activeElection;
      if (!election) return;

      // Anyone who lost their citizenship since filing drops off the ballot.
      const candidates = election.candidates.filter(
        (addr) => state.citizens[addr] && !isStateAccount(addr)
      );

      if (candidates.length === 0) {
        state.posts.unshift({
          id: "post_" + Math.random().toString(36).slice(2, 10),
          author: ELECTION_COMMISSION,
          text:
            `🗳️ ELECTION CLOSED: No nominations were received.\n\n` +
            `No government has been formed. The civil service continues to administer ` +
            `Memeostan in the absence of elected representatives.\n\n` +
            `Nominations for the next term are open.`,
          image: null,
          up: 0,
          down: 0,
          voters: {},
          replies: [],
          at: Date.now(),
        });

        state.activeElection = emptyBallot(Date.now() + ELECTION_DURATION);
        return;
      }

      // 1. Tally support: votes weighted by aura, plus the vibe of your own posts.
      const support: Record<string, number> = {};
      candidates.forEach((c) => {
        const candidatePosts = state.posts.filter((p) => p.author === c);
        support[c] = candidatePosts.reduce((sum, p) => sum + vibeOf(p), 0) * 10;
      });

      Object.entries(election.votes).forEach(([voterAddr, candAddr]) => {
        if (!candidates.includes(candAddr)) return;
        if (isStateAccount(voterAddr)) return; // belt and braces
        const voter = state.citizens[voterAddr];
        support[candAddr] += voter ? voter.aura : 1000;
      });

      const sorted = [...candidates].sort((a, b) => (support[b] || 0) - (support[a] || 0));

      // Vacate the outgoing government. State offices keep their titles — they
      // were never up for election.
      Object.keys(state.citizens).forEach((addr) => {
        if (isStateAccount(addr)) return;
        if (state.citizens[addr].running) delete state.citizens[addr].running;
      });

      sorted.forEach((candAddr, index) => {
        const citizen = state.citizens[candAddr];
        if (!citizen) return;

        citizen.running = OFFICES[index] || `Cabinet Minister (Rank ${index + 1})`;

        if (index === 0) {
          state.balances[candAddr] = (state.balances[candAddr] || 0) + 500;
          state.txs.unshift({
            id: "tx_" + Math.random().toString(36).slice(2, 10),
            type: "mint",
            from: ledger.TREASURY,
            to: candAddr,
            amount: 500,
            memo: `election victory grant — Chief Vibes Officer appointed`,
            at: Date.now(),
          });
        }
      });

      const summaryText = sorted
        .slice(0, 3)
        .map((candAddr, idx) => {
          const citizen = state.citizens[candAddr];
          if (!citizen) return null;
          const title = OFFICES[idx] || `Cabinet Minister (Rank ${idx + 1})`;
          return `• @${citizen.username} — ${title} (${support[candAddr] || 0} support)`;
        })
        .filter(Boolean)
        .join("\n");

      const turnout = Object.keys(election.votes).length;

      state.posts.unshift({
        id: "post_" + Math.random().toString(36).slice(2, 10),
        author: ELECTION_COMMISSION,
        text:
          `🗳️ ELECTION RESULT DECLARED\n\n${summaryText}\n\n` +
          `Turnout: ${turnout} vote${turnout === 1 ? "" : "s"} across ${candidates.length} ` +
          `candidate${candidates.length === 1 ? "" : "s"}. The new government is sworn in with immediate effect.`,
        image: null,
        up: 0,
        down: 0,
        voters: {},
        replies: [],
        at: Date.now(),
      });

      // 2. Next cycle opens with an empty ballot. Nominations must be filed again.
      state.activeElection = emptyBallot(Date.now() + ELECTION_DURATION);
    });

    return true;
  },
};
