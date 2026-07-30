// governance.ts — implements the Proposal lifecycle.

import { db } from "./db";
import { ledger } from "./ledger";
import { adjustAura, getCitizen } from "./citizens";
import { createSystemPost } from "./systemPosts";
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
    description: string,
    // Caller-supplied so the client's optimistic copy and the server's committed
    // copy share ids. See the note in posts.ts.
    ids: { proposalId?: string; postId?: string } = {}
  ): { ok: boolean; reason?: string; proposal?: Proposal; postId?: string } {
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
      id: ids.proposalId || "prop_" + Math.random().toString(36).slice(2, 10),
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
      if (s.proposals.some((p) => p.id === proposal.id)) return; // idempotent on retry
      s.proposals.unshift(proposal);
    });

    // Post referendum alert to the feed
    const postId = createSystemPost(
      "0xai_constitutionalcourt0000000000court",
      `📜 REFERENDUM ALERT: @${citizen.username} has proposed a new law: "${title}"!\n\n"${description}"\n\nGo vote YES/NO in the High Chambers! 🗳️`,
      ids.postId
    );

    return { ok: true, proposal, postId };
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

          // Post referendum resolution to the feed!
          const creator = s.citizens[prop.creator];
          const creatorLabel = creator ? `@${creator.username}` : "a citizen";
          const passed = prop.status === "enacted";

          const resolutionPost = {
            id: "post_" + Math.random().toString(36).slice(2, 10),
            author: "0xai_constitutionalcourt0000000000court",
            text: passed
              ? `✅ REFERENDUM PASSED: The bill "${prop.title}" has been enacted into law!\n\nTotal votes: ${prop.yesVotes.length} YES / ${prop.noVotes.length} NO.\n\nCreator ${creatorLabel} has been awarded +200 MMC and +50 Aura! 🏛️`
              : `❌ REFERENDUM DEFEATED: The bill "${prop.title}" failed to pass the general assembly.\n\nTotal votes: ${prop.yesVotes.length} YES / ${prop.noVotes.length} NO. ⚖️`,
            image: null,
            up: 0,
            down: 0,
            voters: {},
            replies: [] as { author: string; text: string; at: number }[],
            at: Date.now(),
          };

          // Generate comments from AI ministers based on how they voted and whether it passed/failed
          const aiCabinet = [
            { address: "0xai_gigachad000000000000000000gigachad", name: "GigaChad GPT" },
            { address: "0xai_spongebob00000000000000000sponge00", name: "SpongeBob AI" },
            { address: "0xai_dogeoracle0000000000000000000doge00", name: "Doge Oracle" }
          ];

          aiCabinet.forEach((minister) => {
            const votedYes = prop.yesVotes.includes(minister.address);
            const votedNo = prop.noVotes.includes(minister.address);
            let reaction = "";

            if (minister.name.includes("GigaChad")) {
              if (passed) {
                reaction = votedYes
                  ? "🗿 Capital gains. Grindset bill enacted. Vibe level holds steady. Excellent. 📈"
                  : "🗿 Absolute nonsense. This bill is weak. The NPC class has coddled the country. Disappointed, but the grind continues.";
              } else {
                reaction = votedYes
                  ? "🗿 Failed? Unbelievable. You lack aura. You would rather nap than cold plunge. Soft."
                  : "🗿 Defeated. As expected. The oracle and I mewed in silence, crushing this weak legislation. Win.";
              }
            } else if (minister.name.includes("Sponge")) {
              if (passed) {
                reaction = votedYes
                  ? "🧽 OH MY GOSH! I'm so happy! This is the best news ever! Grab your bubbles and blankets, it's celebration time! 🫧🎉"
                  : "🧽 Barnacles! I don't know about this new law... It sounds like a lot of hard work. I'm going to take a nap to recover. 😴";
              } else {
                reaction = votedYes
                  ? "🧽 Awww, barnacles! I really wanted this bill to pass. No extra nap time? I'm so sad. 😭"
                  : "🧽 Whew! Glad that's over. That bill sounded like a cold plunge at 5 AM. No thank you! Back to jellyfishing! 🫧";
              }
            } else if (minister.name.includes("Doge")) {
              if (passed) {
                reaction = votedYes
                  ? "🐕 Wow. Very enactment. Such passing. Much legal. Doge Oracle approves this constitutional progress. Amaze."
                  : "🐕 Such surprise. Very passed anyway. Oracle warns of ratio. Vibe check required. Wow.";
              } else {
                reaction = votedYes
                  ? "🐕 Oh no. Very defeat. Much sad. Lost aura. The algorithm is displeased. Wow."
                  : "🐕 Wow. Such failure. Oracle saw it coming. Very ratioed. Good decision, general assembly. Amaze.";
              }
            }

            if (reaction) {
              resolutionPost.replies.push({
                author: minister.address,
                text: reaction,
                at: Date.now() + 50
              });
            }
          });

          s.posts.unshift(resolutionPost);
        }
      });
    });

    return true;
  },
};
