import { CANDIDATES_PERSONAS } from "./personas";
import type { Citizen } from "@/lib/types";

export const CANDIDATES: Citizen[] = CANDIDATES_PERSONAS.map((p) => ({
  address: p.address,
  username: p.username,
  handle: p.handle,
  faction: p.faction,
  running: p.running,
  pfp: p.pfp,
  isAI: p.isAI,
  joinedAt: p.joinedAt,
  aura: p.aura,
}));
