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
import { currentQuorum, voteWeight } from "./quorum";
import type { ActiveElection } from "./types";

const ELECTION_DURATION = 5 * 60 * 1000; // 5 minutes for demo/interactive speed
const CANDIDACY_COST = 50;
/** What a candidate's whole campaign is worth, at most: two supporters. */
const MAX_CAMPAIGN_BONUS = 40;

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

      const turnout = Object.keys(election.votes).filter(
        (addr) => !isStateAccount(addr)
      ).length;
      const quorum = currentQuorum();

      // An election nobody voted in does not install a government. The same rule
      // as the assembly, for the same reason: a single citizen must not be able
      // to appoint the cabinet for everybody. An uncontested ballot still needs
      // somebody to turn out and say so.
      if (candidates.length > 0 && turnout < quorum) {
        state.posts.unshift({
          id: "post_" + Math.random().toString(36).slice(2, 10),
          author: ELECTION_COMMISSION,
          text:
            `🗳️ ELECTION VOID: turnout of ${turnout} against a quorum of ${quorum}.\n\n` +
            `${candidates.length} candidate${candidates.length === 1 ? " stood" : "s stood"}, but the ` +
            `electorate was not constituted. No government has been formed and no office changes hands.\n\n` +
            `Nominations carry over to the next term.`,
          image: null,
          up: 0,
          down: 0,
          voters: {},
          replies: [],
          at: Date.now(),
        });

        // Candidates keep their nominations rather than paying the fee again.
        state.activeElection = {
          candidates,
          votes: {},
          endsAt: Date.now() + ELECTION_DURATION,
        };
        return;
      }

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

      // 1. Tally support: votes first, virality second.
      //
      // Campaign vibe used to be multiplied by ten while a vote was worth raw
      // aura (~1000), so posts were noise next to ballots. Capping vote weight
      // at 20 inverted that overnight: a single decent post would have outweighed
      // every voter in the country. Virality still counts — this is a memeocracy —
      // but it is capped at what two supporters are worth, so campaigning can
      // swing a close race and can never win one on its own.
      const support: Record<string, number> = {};
      candidates.forEach((c) => {
        const vibe = state.posts
          .filter((p) => p.author === c)
          .reduce((sum, p) => sum + vibeOf(p), 0);
        support[c] = Math.max(-MAX_CAMPAIGN_BONUS, Math.min(MAX_CAMPAIGN_BONUS, vibe));
      });

      Object.entries(election.votes).forEach(([voterAddr, candAddr]) => {
        if (!candidates.includes(candAddr)) return;
        if (isStateAccount(voterAddr)) return; // belt and braces
        const voter = state.citizens[voterAddr];
        // Same cap as the assembly: aura is worth up to twice a new citizen's
        // vote and never more. Raw aura here meant a 9,999-aura citizen could
        // install a government against nine ordinary ones.
        support[candAddr] += voter ? voteWeight(voter.aura) : 10;
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
