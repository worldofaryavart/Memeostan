// systemAccounts.ts — the addresses that belong to the state rather than to a
// citizen.
//
// These are the organs of government: they post decrees, verdicts, fines and
// results. They are not candidates and they are not people, so the feed treats
// them as a category of their own.

export const TREASURY = "0xtreasury000000000000000000000000treasur";
export const CYBER_POLICE = "0xai_cyberpolice000000000000000000police";
export const ELECTION_COMMISSION = "0xai_electioncommission000000000000election";
export const CONSTITUTIONAL_COURT = "0xai_constitutionalcourt0000000000court";
export const SUPREME_COURT = "0xai_supremecourt0000000000000000court0";

const STATE_ACCOUNTS = new Set<string>([
  TREASURY,
  CYBER_POLICE,
  ELECTION_COMMISSION,
  CONSTITUTIONAL_COURT,
  SUPREME_COURT,
]);

/** True for the courts, the commission, the police — the machinery of the state. */
export function isStateAccount(address: string): boolean {
  return STATE_ACCOUNTS.has(address);
}
