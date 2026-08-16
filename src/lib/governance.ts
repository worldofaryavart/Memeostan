// governance.ts — implements the Proposal lifecycle.

import { db } from "./db";
import { ledger } from "./ledger";
import { adjustAura, getCitizen } from "./citizens";
import { createSystemPost } from "./systemPosts";
import { CONSTITUTIONAL_COURT, isStateAccount } from "./systemAccounts";
import {
  PROPORTIONALITY_LIMIT,
  describeRule,
  enact,
  proportionality,
} from "./constitution";
import { proposalDuration, tally } from "./quorum";
import type { LawRule, Proposal } from "./types";

const PROPOSAL_COST = 100; // MMC burn cost to file a proposal (spam tax)

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
    description: string,
    // Caller-supplied so the client's optimistic copy and the server's committed
    // copy share ids. See the note in posts.ts.
    ids: { proposalId?: string; postId?: string } = {},
    rule?: LawRule
  ): { ok: boolean; reason?: string; proposal?: Proposal; postId?: string } {
    const citizen = getCitizen(creator);
    if (!citizen) return { ok: false, reason: "Citizen not registered" };

    // Check the repeal target now rather than on enactment, so a citizen doesn't
    // burn 100 MMC and three minutes of the assembly's time on a bill aimed at
    // an article that was never in force.
    if (rule?.type === "repeal") {
      const target = (db.get().proposals ?? []).find((p) => p.id === rule.target);
      if (!target || target.status !== "enacted" || !target.rule) {
        return { ok: false, reason: "There is no such article to repeal." };
      }
      if (target.repealedBy) {
        return { ok: false, reason: `Article ${target.article} has already been repealed.` };
      }
    }

    // A law has to leave something legal. See constitution.ts — the parameter
    // bounds cannot catch "ban the word 'the'", because the problem is not the
    // parameter, it is the effect.
    if (rule) {
      const reach = proportionality(rule);
      if (reach.conclusive && reach.share > PROPORTIONALITY_LIMIT) {
        return {
          ok: false,
          reason:
            `That rule would make ${reach.caught} of the last ${reach.tested} posts unlawful ` +
            `(${Math.round(reach.share * 100)}%). A law has to leave something legal — ` +
            `the assembly cannot criminalise ordinary posting in one bill.`,
        };
      }
    }

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
      id: ids.proposalId || "prop_" + Math.random().toString(36).slice(2, 10),
      creator,
      title,
      description,
      status: "active",
      yesVotes: [],
      noVotes: [],
      endsAt: Date.now() + proposalDuration(),
      at: Date.now(),
      rule,
    };

    db.update((s) => {
      if (!s.proposals) s.proposals = [];
      if (s.proposals.some((p) => p.id === proposal.id)) return; // idempotent on retry
      s.proposals.unshift(proposal);
    });

    const effect = rule
      ? `If carried: ${describeRule(rule)}`
      : "A resolution of the assembly. It creates no enforceable duty.";

    // Post referendum alert to the feed
    const postId = createSystemPost(
      CONSTITUTIONAL_COURT,
      `📜 BILL TABLED: @${citizen.username} has proposed "${title}".\n\n"${description}"\n\n${effect}\n\nThe assembly is open. Vote YES or NO in the High Chambers. 🗳️`,
      ids.postId
    );

    return { ok: true, proposal, postId };
  },

  vote(
    proposalId: string,
    voter: string,
    voteType: "yes" | "no"
  ): { ok: boolean; reason?: string } {
    // Legislating is the citizens' job. The civil service enforces what they pass
    // and has no say in what it is.
    if (isStateAccount(voter)) {
      return { ok: false, reason: "The civil service does not vote on legislation." };
    }
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

  // Auto-resolve any active proposals that have expired.
  // Returns true if any actually resolved, so callers know state changed.
  resolveExpired(): boolean {
    const now = Date.now();
    const anyExpired = (db.get().proposals ?? []).some(
      (p) => p.status === "active" && now > p.endsAt
    );
    if (!anyExpired) return false;

    db.update((s) => {
      if (!s.proposals) s.proposals = [];
      s.proposals.forEach((prop) => {
        if (prop.status === "active" && now > prop.endsAt) {
          // One counting function, shared with the UI, so what a citizen is
          // shown while voting is exactly what decides the bill.
          const count = tally(prop);
          let effect = "";

          if (count.outcome === "enacted") {
            prop.status = "enacted";
            // The bill becomes part of the constitution here. Before this, a
            // passed referendum awarded MMC and changed nothing — citizens
            // legislated into a void while the police enforced a hardcoded list.
            effect = enact(prop);
            // Reward creator
            const creator = s.citizens[prop.creator];
            if (creator) {
              creator.aura = Math.max(0, creator.aura + 50);
              // Mint a small legislative grant of 200 MMC to the author of the law!
              s.balances[prop.creator] = (s.balances[prop.creator] || 0) + 200;
              s.txs.unshift({
                id: "tx_" + Math.random().toString(36).slice(2, 10),
                type: "mint",
                from: ledger.TREASURY,
                to: prop.creator,
                amount: 200,
                memo: `legislative grant — passed proposal "${prop.title.slice(0, 15)}"`,
                at: Date.now(),
              });
              }
          } else if (count.outcome === "failed") {
            prop.status = "failed";
            // Penalize creator slightly
            const creator = s.citizens[prop.creator];
            if (creator) {
              creator.aura = Math.max(0, creator.aura - 30);
            }
          } else {
            // Lapsed: the assembly never turned up. No aura penalty — the
            // proposer was not rejected, they were ignored, and docking them for
            // other people's absence would make filing a bill a gamble on
            // whether anyone happened to be online.
            prop.status = "lapsed";
          }

          // Post referendum resolution to the feed!
          const creator = s.citizens[prop.creator];
          const creatorLabel = creator ? `@${creator.username}` : "a citizen";

          const record =
            count.outcome === "enacted"
              ? `📜 ENACTED: "${prop.title}"\n\n` +
                `Carried ${count.yes} to ${count.no} on a quorum of ${count.quorum}.\n\n${effect}\n\n` +
                `Proposer ${creatorLabel} is awarded 200 MMC and 50 Aura.`
              : count.outcome === "failed"
                ? `📜 DEFEATED: "${prop.title}"\n\n` +
                  `Failed ${count.yes} to ${count.no}. The bill does not enter the constitution.`
                : `📜 LAPSED: "${prop.title}"\n\n` +
                  `${count.cast} vote${count.cast === 1 ? "" : "s"} cast against a quorum of ${count.quorum}. ` +
                  `The assembly was not constituted and the bill falls without a decision.\n\n` +
                  `No penalty is recorded against ${creatorLabel}. It may be tabled again.`;

          // The court records what the assembly decided. It has no opinion about
          // it — this used to carry fifty lines of AI ministers reacting in
          // character to a vote they had themselves cast, which was three bots
          // applauding their own legislature.
          s.posts.unshift({
            id: "post_" + Math.random().toString(36).slice(2, 10),
            author: CONSTITUTIONAL_COURT,
            text: record,
            image: null,
            up: 0,
            down: 0,
            voters: {},
            replies: [],
            at: Date.now(),
          });
        }
      });
    });

    return true;
  },
};
