// quorum.ts — who counts, how much they count for, and how many of them it takes.
//
// The assembly used to need one vote. Whoever showed up first could enact
// anything, on behalf of everybody, in three minutes. That was survivable while
// the country had no citizens and fatal the moment it had twenty.
//
// Three guards, all of them about the same thing — a small minority must not be
// able to legislate for a large one:
//
//   1. Quorum scales with the population, sublinearly. It has to grow, or it
//      stops meaning anything; it has to grow slowly, or a bill can never pass
//      in a country where most people are lurking.
//   2. Reputation is capped. Aura-weighted voting is the memeocracy and it
//      stays, but an uncapped weight means one ancient citizen outvotes a room.
//   3. A bill that fails for want of turnout LAPSES rather than being defeated.
//      Punishing a proposer because nobody showed up is punishing them for
//      something they had no part in.

import { db } from "./db";
import { isStateAccount } from "./systemAccounts";
import { CLOCK } from "./clock";
import type { Proposal } from "./types";

/** Reputation is worth this much of a vote at most. */
const MAX_VOTE_WEIGHT = 20;
/** What a citizen at the starting aura of 1000 is worth. */
const BASE_VOTE_WEIGHT = 10;


/** Everyone entitled to vote. The civil service is not. */
export function electorate(): number {
  return Object.values(db.get().citizens).filter((c) => !isStateAccount(c.address)).length;
}

/**
 * How many citizens must cast a vote for the result to count.
 *
 * The square root, so it scales without becoming unreachable: 1 citizen needs 1,
 * 4 need 2, 25 need 5, 100 need 10. A linear share would read fairer and would
 * mean that in a country of 200 mostly-lurking citizens no bill ever passes
 * again, which is not fairer — it just moves power from a small quorum to
 * nobody at all.
 */
export function quorumFor(population: number): number {
  return Math.max(1, Math.ceil(Math.sqrt(Math.max(0, population))));
}

export function currentQuorum(): number {
  return quorumFor(electorate());
}

/**
 * What one citizen's vote is worth.
 *
 * Aura still counts — winning arguments in Memeostan is supposed to be partly
 * about standing. But it is capped at twice a new citizen's weight, so a
 * long-standing citizen is worth two newcomers and never twenty. Without the
 * cap, aura 9,999 carried a weight of 99 and could outvote nine ordinary
 * citizens single-handed, which is not a memeocracy, it is a peerage.
 */
export function voteWeight(aura: number): number {
  return Math.min(MAX_VOTE_WEIGHT, Math.max(1, Math.floor(aura / 100)));
}

/** How long a bill stays open. More citizens to reach means more time to reach them. */
export function proposalDuration(population = electorate()): number {
  return Math.min(
    CLOCK.proposalMax,
    CLOCK.proposalBase + quorumFor(population) * CLOCK.proposalPerQuorum
  );
}

export type Outcome = "enacted" | "failed" | "lapsed";

export interface Tally {
  yes: number;
  no: number;
  cast: number;
  yesWeight: number;
  noWeight: number;
  quorum: number;
  quorumMet: boolean;
  outcome: Outcome;
}

/** Count a bill. Pure — used by the resolver and by the UI, so they cannot disagree. */
export function tally(proposal: Pick<Proposal, "yesVotes" | "noVotes">): Tally {
  const state = db.get();
  const weigh = (addresses: string[]) =>
    addresses.reduce((sum, addr) => {
      const citizen = state.citizens[addr];
      return sum + (citizen ? voteWeight(citizen.aura) : BASE_VOTE_WEIGHT);
    }, 0);

  const yes = proposal.yesVotes.length;
  const no = proposal.noVotes.length;
  const cast = yes + no;
  const quorum = currentQuorum();
  const quorumMet = cast >= quorum;

  const yesWeight = weigh(proposal.yesVotes);
  const noWeight = weigh(proposal.noVotes);

  const outcome: Outcome = !quorumMet
    ? "lapsed"
    : yesWeight > noWeight
      ? "enacted"
      : "failed";

  return { yes, no, cast, yesWeight, noWeight, quorum, quorumMet, outcome };
}
