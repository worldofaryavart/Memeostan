// types.ts — the shared shapes of the nation. Keep these clean and chain-portable.

export type Faction =
  | "Sigma"
  | "NPC"
  | "Rizzler"
  | "Brainrot Veteran"
  | "Meme Lord";

export interface Citizen {
  address: string; // wallet address = citizen ID
  secret?: string; // local-only key; never displayed, never sent
  username: string;
  faction: string;
  pfp: string; // emoji or data URL
  aura: number; // reputation, starts at 1000
  isAI: boolean;
  joinedAt: number;
  running?: string; // office an AI candidate is running for
  handle?: string;
  equippedBadge?: string; // equipped badge ID
  equippedBorder?: string; // equipped border class/style ID
  city?: string;
  party?: string;
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

export interface Proposal {
  id: string;
  creator: string; // wallet address
  title: string;
  description: string;
  status: "draft" | "active" | "passed" | "failed" | "enacted";
  yesVotes: string[]; // citizen addresses
  noVotes: string[]; // citizen addresses
  endsAt: number;
  at: number;
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

export interface SkirmishResult {
  id: string;
  at: number;
  attackerCity: string;
  defenderCity: string;
  attackerScore: number;
  defenderScore: number;
  winner: string;       // city name of the winner
  territoryGained: number; // % transferred
  initiator?: string;  // citizen address who paid to launch it (undefined = AI sim)
}

export interface NationState {
  version?: number;
  citizens: Record<string, Citizen>;
  balances: Record<string, number>;
  txs: Tx[];
  posts: Post[];
  me: string | null;
  founded: number | null;
  
  // Phase 2 additions
  proposals?: Proposal[];
  activeElection?: ActiveElection;
  gdbHistory?: { at: number; gdb: number }[];
  purchasedCosmetics?: Record<string, string[]>; // citizenAddress -> itemIds
  economicEvents?: EconomicEvent[];
  taxHikeEndsAt?: number; // timestamp until elevated transfer fee is active

  // Phase 3 — Territorial Control
  territories?: Record<string, number>; // cityName -> % control (0–100), sums to 100
  skirmishLog?: SkirmishResult[];

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
  penalty: string;
  postId?: string;       // corresponding announcement feed post ID
  at: number;
  endsAt: number;
}

