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
}

export type VoteDir = "up" | "down";

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
}
