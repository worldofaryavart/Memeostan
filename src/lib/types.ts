// types.ts — the shared shapes of the nation. Keep these clean and chain-portable.

import type { PublicKeyJwk } from "./crypto";

export type Faction =
  | "Sigma"
  | "NPC"
  | "Rizzler"
  | "Brainrot Veteran"
  | "Meme Lord";

export interface Citizen {
  address: string; // wallet address = citizen ID, derived from pubKey
  pubKey?: PublicKeyJwk; // public half of the citizen's keypair; verifies their actions
  secret?: string; // DEPRECATED legacy key. Server-side only, destroyed on key upgrade.
  username: string;
  faction: string;
  pfp: string; // emoji or data URL
  aura: number; // reputation, starts at 1000
  /**
   * True only for organs of the state (see systemAccounts.ts). Citizens are
   * people; the police, the courts and the commission are AI. There is no third
   * category — `isStateAccount(address)` is the authoritative test, this flag is
   * what the UI reads.
   */
  isAI: boolean;
  joinedAt: number;
  /** Sequential national ID, issued by the Registrar. Citizens only. */
  citizenNo?: number;
  running?: string; // elected office, or "Candidate" while standing for one
  handle?: string;
  equippedBadge?: string; // equipped badge ID
  equippedBorder?: string; // equipped border class/style ID
  city?: string;
  party?: string;
  lastNapAt?: number; // nap-widget cooldown, enforced server-side

  // State organs only — how the office speaks, and its LLM spend. Server-managed.
  personalityDesc?: string;
  tokenLimit?: number;
  dailyTokensUsed?: number;
  lastTokensResetAt?: number;
}

export type VoteDir = "up" | "down";

export type EconomicEventType = "boom" | "crash" | "inflation" | "tax_hike" | "airdrop";

export interface EconomicEvent {
  id: string;
  type: EconomicEventType;
  title: string;
  description: string;
  at: number;
  resolved: boolean;
}

/**
 * What a law actually *does*. A bill without one is a resolution: it passes, it
 * is recorded, and it binds nobody. A bill with one becomes an article the Cyber
 * Police can check a post against without asking anybody's opinion — see
 * src/lib/constitution.ts for why that matters.
 */
export type LawRuleType =
  | "ban_word"
  | "require_image"
  | "post_limit"
  | "min_length"
  | "ratio_limit"
  | "repeal";

export interface LawRule {
  type: LawRuleType;
  words?: string[]; // ban_word
  n?: number; // post_limit, min_length, ratio_limit
  target?: string; // repeal — the id of the article being struck out
}

export interface Proposal {
  id: string;
  creator: string; // wallet address
  title: string;
  description: string;
  /** `lapsed` = the assembly never reached quorum; not a defeat, and unpunished. */
  status: "draft" | "active" | "passed" | "failed" | "enacted" | "lapsed";
  yesVotes: string[]; // citizen addresses
  noVotes: string[]; // citizen addresses
  endsAt: number;
  at: number;

  // Set on enactment, when the bill becomes part of the constitution.
  rule?: LawRule;
  article?: number; // its number in the constitution
  enactedAt?: number; // enforcement starts here; never retroactive
  repealedBy?: string; // the id of the bill that struck it out
}

export interface ActiveElection {
  candidates: string[]; // candidate addresses
  votes: Record<string, string>; // voterAddress -> candidateAddress
  endsAt: number;
}

export interface Reply {
  author: string;
  text: string;
  at: number;
}

export interface Post {
  id: string;
  author: string; // wallet address
  text: string;
  image: string | null; // data URL
  up: number;
  down: number;
  voters: Record<string, VoteDir>;
  replies: Reply[];
  at: number;
  boosts?: number; // boosts count
}

export type TxType = "mint" | "burn" | "transfer";

export interface Tx {
  id: string;
  type: TxType;
  from: string;
  to: string;
  amount: number;
  memo: string;
  at: number;
}

export interface NationState {
  version?: number;
  // Monotonic revision. Every accepted write bumps it; writes are conditional on
  // it, so two concurrent writers can never silently clobber each other.
  rev?: number;
  citizens: Record<string, Citizen>;
  balances: Record<string, number>;
  txs: Tx[];
  posts: Post[];
  /** @deprecated identity is client-local now — see src/lib/session.ts */
  me?: string | null;
  founded: number | null;

  // Replay protection + world-tick throttling (server-authoritative bookkeeping)
  seenNonces?: { n: string; at: number }[];
  lastTickAt?: number;
  lastGdbSnapshotAt?: number;
  lastAIBeatAt?: number; // throttles AI world beats (and therefore LLM spend)
  /** Nation-wide LLM spend for the day. Per-citizen budgets don't bound the bill
   *  once every AI citizen is eligible to speak — this does. */
  llmSpend?: { date: string; tokens: number };

  // Phase 2 additions
  proposals?: Proposal[];
  activeElection?: ActiveElection;
  gdbHistory?: { at: number; gdb: number }[];
  purchasedCosmetics?: Record<string, string[]>; // citizenAddress -> itemIds
  economicEvents?: EconomicEvent[];
  taxHikeEndsAt?: number; // timestamp until elevated transfer fee is active

  // Phase 4 — AI Judiciary & Mock Trials
  trials?: Trial[];
}

export interface Trial {
  id: string;
  defendant: string;     // wallet address
  plaintiff: string;     // wallet address or "THE STATE"
  charge: string;
  description: string;
  status: "voting" | "resolved";
  yesVotes: string[];    // citizen addresses (guilty)
  noVotes: string[];     // citizen addresses (innocent)
  verdict: "GUILTY" | "INNOCENT" | "DISMISSED" | null;
  /** True when no citizen sat on the jury and the AI bench ruled alone. */
  benchVerdict?: boolean;
  penalty: string;
  postId?: string;       // corresponding announcement feed post ID
  at: number;
  endsAt: number;
}

