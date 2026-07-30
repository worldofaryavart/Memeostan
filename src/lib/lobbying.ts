// lobbying.ts — leaning on an AI minister to change their vote.
//
// The mechanics moved out of the page component because the browser was deciding
// whether it had been persuasive, and then writing the minister's vote itself. Both
// halves of that belong to the server: it checks the argument (or takes the money)
// and it casts the vote.

import { governance } from "./governance";
import { getCitizen } from "./citizens";
import { ledger } from "./ledger";

export const BRIBE_COST = 50;

/** Each minister has their own weakness. Say the magic word. */
const PERSUASION_KEYWORDS: { match: string; words: string[] }[] = [
  { match: "gigachad", words: ["grind", "aura", "sigma", "lift", "gdb", "mewing", "chad"] },
  { match: "spongebob", words: ["sleep", "nap", "burger", "cozy", "chillin", "jellyfish"] },
  { match: "dogeoracle", words: ["wow", "such", "very", "amaze", "doge"] },
];

export function isPersuaded(ministerAddress: string, message: string): boolean {
  const text = message.toLowerCase();
  const entry = PERSUASION_KEYWORDS.find((e) => ministerAddress.includes(e.match));
  if (!entry) return false;
  return entry.words.some((word) => text.includes(word));
}

export interface LobbyOutcome {
  ok: boolean;
  reason?: string;
  newVote?: "yes" | "no";
}

function checkTarget(
  proposalId: string,
  ministerAddress: string
): { error?: string; currentVote?: "yes" | "no" } {
  const proposal = governance.getProposal(proposalId);
  if (!proposal) return { error: "No such proposal." };
  if (proposal.status !== "active") return { error: "That referendum has already closed." };

  const minister = getCitizen(ministerAddress);
  if (!minister) return { error: "No such minister." };
  if (!minister.isAI) return { error: "You can only lobby AI ministers." };

  return { currentVote: proposal.yesVotes.includes(ministerAddress) ? "yes" : "no" };
}

/** Pay for the vote. Openly. It's that kind of country. */
export function bribeMinister(
  briber: string,
  proposalId: string,
  ministerAddress: string
): LobbyOutcome {
  const { error, currentVote } = checkTarget(proposalId, ministerAddress);
  if (error || !currentVote) return { ok: false, reason: error };

  if (briber === ministerAddress) return { ok: false, reason: "You can't bribe yourself." };

  const balance = ledger.balanceOf(briber);
  if (balance < BRIBE_COST) {
    return { ok: false, reason: `A bribe costs ${BRIBE_COST} MMC. You have ${balance} MMC.` };
  }

  const transfer = ledger.transfer(
    briber,
    ministerAddress,
    BRIBE_COST,
    `bribe to change vote on proposal ${proposalId}`
  );
  if (!transfer.ok) return { ok: false, reason: transfer.reason };

  const newVote = currentVote === "yes" ? "no" : "yes";
  governance.vote(proposalId, ministerAddress, newVote);
  return { ok: true, newVote };
}

/** Or make an argument in their own dialect, which is free. */
export function persuadeMinister(
  proposalId: string,
  ministerAddress: string,
  message: string
): LobbyOutcome {
  const { error, currentVote } = checkTarget(proposalId, ministerAddress);
  if (error || !currentVote) return { ok: false, reason: error };

  if (!isPersuaded(ministerAddress, message)) {
    return { ok: false, reason: "not-persuaded" };
  }

  const newVote = currentVote === "yes" ? "no" : "yes";
  governance.vote(proposalId, ministerAddress, newVote);
  return { ok: true, newVote };
}
