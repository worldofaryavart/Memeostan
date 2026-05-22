// governance.ts — implements the Proposal lifecycle.

import { db } from "./db";
import { ledger } from "./ledger";
import { adjustAura, getCitizen } from "./citizens";
import type { Proposal } from "./types";

const PROPOSAL_COST = 100; // MMC burn cost to file a proposal (spam tax)
const PROPOSAL_DURATION = 3 * 60 * 1000; // 3 minutes for quick resolution in demo

export const governance = {
  allProposals(): Proposal[] {
    return db.get().proposals || [];
  },

  getProposal(id: string): Proposal | null {
    return db.get().proposals?.find((p) => p.id === id) || null;
  },

  createProposal(
    creator: string,
    title: string,
    description: string
  ): { ok: boolean; reason?: string; proposal?: Proposal } {
    const citizen = getCitizen(creator);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    const balance = ledger.balanceOf(creator);
    if (balance < PROPOSAL_COST) {
      return {
        ok: false,
        reason: `Filing a proposal costs ${PROPOSAL_COST} MMC (spam tax). You only have ${balance} MMC.`,
      };
    }

    // Burn the filing fee
    ledger.burn(creator, PROPOSAL_COST, `proposal filing fee — "${title.slice(0, 20)}..."`);
    adjustAura(creator, 20); // filing shows leadership

    const proposal: Proposal = {
      id: "prop_" + Math.random().toString(36).slice(2, 10),
      creator,
      title,
      description,
      status: "active",
      yesVotes: [],
      noVotes: [],
      endsAt: Date.now() + PROPOSAL_DURATION,
      at: Date.now(),
    };

    db.update((s) => {
      if (!s.proposals) s.proposals = [];
      s.proposals.unshift(proposal);
    });

    return { ok: true, proposal };
  },

  vote(
    proposalId: string,
    voter: string,
    voteType: "yes" | "no"
  ): { ok: boolean; reason?: string } {
    const citizen = getCitizen(voter);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    db.update((s) => {
      if (!s.proposals) s.proposals = [];
      const prop = s.proposals.find((p) => p.id === proposalId);
      if (!prop) return;
      if (prop.status !== "active") return;

      // Remove previous vote
      prop.yesVotes = prop.yesVotes.filter((addr) => addr !== voter);
      prop.noVotes = prop.noVotes.filter((addr) => addr !== voter);

      // Cast new vote
      if (voteType === "yes") {
        prop.yesVotes.push(voter);
      } else {
        prop.noVotes.push(voter);
      }
    });

    return { ok: true };
  },

  // Auto-resolve any active proposals that have expired
  resolveExpired(): void {
    const now = Date.now();
    db.update((s) => {
      if (!s.proposals) s.proposals = [];
      s.proposals.forEach((prop) => {
        if (prop.status === "active" && now > prop.endsAt) {
          // Compute aura-weighted votes
          let yesWeight = 0;
          let noWeight = 0;

          prop.yesVotes.forEach((addr) => {
            const citizen = s.citizens[addr];
            const weight = citizen ? Math.max(1, Math.floor(citizen.aura / 100)) : 1;
            yesWeight += weight;
          });

          prop.noVotes.forEach((addr) => {
            const citizen = s.citizens[addr];
            const weight = citizen ? Math.max(1, Math.floor(citizen.aura / 100)) : 1;
            noWeight += weight;
          });

          const totalVotes = prop.yesVotes.length + prop.noVotes.length;
          // Quorum is met if at least 1 person voted (local simulation context)
          const quorumMet = totalVotes >= 1;

          if (quorumMet && yesWeight > noWeight) {
            prop.status = "enacted";
            // Reward creator
            const creator = s.citizens[prop.creator];
            if (creator) {
              creator.aura = Math.max(0, creator.aura + 50);
              // Mint a small legislative grant of 200 MMC to the author of the law!
              s.balances[prop.creator] = (s.balances[prop.creator] || 0) + 200;
              s.txs.unshift({
                id: "tx_" + Math.random().toString(36).slice(2, 10),
                type: "mint",
                from: "0xtreasury000000000000000000000000treasur",
                to: prop.creator,
                amount: 200,
                memo: `legislative grant — passed proposal "${prop.title.slice(0, 15)}"`,
                at: Date.now(),
              });
            }
          } else {
            prop.status = "failed";
            // Penalize creator slightly
            const creator = s.citizens[prop.creator];
            if (creator) {
              creator.aura = Math.max(0, creator.aura - 30);
            }
          }
        }
      });
    });
  },
};
