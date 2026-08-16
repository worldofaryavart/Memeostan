// seed.ts — boot the nation.
//
// This used to seed a population: three AI candidates standing for office and
// three "ghost" citizens padding the feed. Both are gone. Memeostan's population
// is whoever has claimed a passport, and on day one that is nobody.
//
// What gets seeded now is the state itself — the police, the courts, the
// commission, the treasury, the broadcaster. A country with no citizens still
// has a bureaucracy; it simply has nothing to do yet.

import { db } from "@/lib/db";
import { STATE_ORGANS } from "@/lib/systemAccounts";
import type { Citizen } from "@/lib/types";

export function bootNation(): void {
  db.update((s) => {
    for (const organ of STATE_ORGANS) {
      if (s.citizens[organ.address]) continue;

      const record: Citizen = {
        address: organ.address,
        username: organ.username,
        handle: organ.handle,
        // State organs have no faction — they serve whoever is in office. The
        // field is required by the type, so it carries the office instead.
        faction: organ.office,
        pfp: organ.pfp,
        aura: 0, // the state has no reputation to win or lose
        isAI: true,
        joinedAt: Date.now(),
        running: organ.office,
        personalityDesc: organ.voice,
      };

      s.citizens[organ.address] = record;
      s.balances[organ.address] = organ.endowment;
    }

    if (!s.founded) s.founded = Date.now();
  });
}
