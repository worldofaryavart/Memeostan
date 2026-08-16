// systemAccounts.ts — the civil service.
//
// These are the organs of the state: the police, the courts, the election
// commission, the treasury, the broadcaster. They enforce the law, run the
// machinery and announce what happened.
//
// They are NOT citizens. Citizenship in Memeostan belongs to people. The state
// apparatus is staffed by AI so that no citizen has to sit on a docket at 3 AM,
// which is roughly the deal every real country makes with its bureaucracy.
//
// The one rule that makes this legible: **the civil service has no franchise.**
// A state account never votes in an election, never votes on a proposal, never
// sits on a jury and never stands for office. It acts only when a rule it was
// given says to act. Everything downstream of that rule is enforcement, not
// politics.

export const TREASURY = "0xtreasury000000000000000000000000treasur";
export const CYBER_POLICE = "0xai_cyberpolice000000000000000000police";
export const ELECTION_COMMISSION = "0xai_electioncommission000000000000election";
export const CONSTITUTIONAL_COURT = "0xai_constitutionalcourt0000000000court";
export const SUPREME_COURT = "0xai_supremecourt0000000000000000court0";
/** Reads the news. Used to be GigaChad, who was a candidate, which was absurd. */
export const STATE_BROADCASTER = "0xai_statebroadcaster0000000000000press";
/** Issues passports. The first office a new citizen ever deals with. */
export const REGISTRAR = "0xai_registrar00000000000000000registry";

export interface StateOrgan {
  address: string;
  username: string;
  handle: string;
  /** The office, shown in place of a faction. State organs have no faction. */
  office: string;
  pfp: string;
  /** Opening balance. The state can pay fines and grants; it does not earn. */
  endowment: number;
  /** How this organ talks, when it has something to say. */
  voice: string;
}

export const STATE_ORGANS: StateOrgan[] = [
  {
    address: TREASURY,
    username: "treasury",
    handle: "@treasury",
    office: "Department of the Treasury",
    pfp: "🏦",
    endowment: 1_000_000,
    voice:
      "A finance ministry that reports MemeCoin supply and Gross Domestic Brainrot with total deadpan seriousness, as if the numbers meant something.",
  },
  {
    address: CYBER_POLICE,
    username: "cyber_police",
    handle: "@cyber_police",
    office: "Cyber Police Commission",
    pfp: "👮",
    endowment: 50_000,
    voice:
      "A traffic cop with a citation book, unfailingly polite and completely unreasonable. Cites the article number, states the offence, warns once. Never jokes about it — the comedy is that it is entirely sincere.",
  },
  {
    address: ELECTION_COMMISSION,
    username: "election_commission",
    handle: "@election_commission",
    office: "Federal Election Commission",
    pfp: "🗳️",
    endowment: 100_000,
    voice:
      "A returning officer reading results into a microphone at 4 AM. Procedural, exhausted, scrupulously neutral.",
  },
  {
    address: CONSTITUTIONAL_COURT,
    username: "constitutional_court",
    handle: "@constitutional_court",
    office: "Constitutional Court",
    pfp: "📜",
    endowment: 100_000,
    voice:
      "Announces referendums and what the constitution now says. Speaks in the flat register of a legal gazette.",
  },
  {
    address: SUPREME_COURT,
    username: "supreme_court",
    handle: "@supreme_court",
    office: "Supreme Court",
    pfp: "⚖️",
    endowment: 100_000,
    voice:
      "A judge delivering a verdict on a genuinely stupid charge with total gravity. Cites the offence, states the finding, hands down the penalty. Dry, never zany.",
  },
  {
    address: REGISTRAR,
    username: "registrar",
    handle: "@registrar",
    office: "Bureau of Citizenship",
    pfp: "🪪",
    endowment: 10_000,
    voice:
      "A registry clerk processing an application. Formal, faintly weary, and entirely uninterested in whether you are excited. Issues numbers, states obligations, closes the window.",
  },
  {
    address: STATE_BROADCASTER,
    username: "state_broadcast",
    handle: "@state_broadcast",
    office: "Ministry of Information",
    pfp: "📻",
    endowment: 10_000,
    voice:
      "A state news anchor reading brainrot economic bulletins as though they were a currency crisis. Grave, clipped, faintly ominous.",
  },
];

const BY_ADDRESS = new Map(STATE_ORGANS.map((organ) => [organ.address, organ]));

/** True for the courts, the commission, the police — the machinery of the state. */
export function isStateAccount(address: string): boolean {
  return BY_ADDRESS.has(address);
}

export function stateOrgan(address: string): StateOrgan | null {
  return BY_ADDRESS.get(address) ?? null;
}
