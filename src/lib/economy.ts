// economy.ts — national metrics, all derived from real ledger + feed activity.
// GDB is the nation's GDP; dilution is its inflation.
// Economic events fire from the campaign loop and mutate the ledger in real-time.

import { db } from "./db";
import { ledger } from "./ledger";
import type { Post, EconomicEvent, EconomicEventType } from "./types";

// MMC earned/burned per action. The whole economy is tuned from here.
export const RATES = {
  POST: 50, // mint for posting
  UPVOTE_REWARD: 5, // mint to author per upvote
  DOWNVOTE_BURN: 3, // burn from author per downvote (the ratio tax)
  SPAM_TAX: 20, // burn for low-effort posts (dilution control)
  WELCOME_GRANT: 250, // starting MMC for a new citizen
  BOOST_COST: 50, // cost to boost a post
  TIP: 10, // fixed "meme it" tip on a post — priced here, never by the caller
};

// Gross Domestic Brainrot: posts produced × engagement × money velocity.
export function grossDomesticBrainrot(): number {
  const s = db.get();
  const posts = s.posts.length;
  const engagement = s.posts.reduce((n, p) => n + p.up + p.down, 0);
  const velocity = s.txs.length;
  return posts * 100 + engagement * 25 + velocity * 10;
}

// Meme Dilution (inflation %): how much circulating MMC chases low-vibe posts.
export function memeDilution(): number {
  const s = db.get();
  if (s.posts.length === 0) return 0;
  const cringe = s.posts.filter((p) => p.down > p.up).length;
  const ratio = cringe / s.posts.length;
  const supplyPressure = Math.min(ledger.circulatingSupply() / 100000, 1);
  return +(ratio * 60 + supplyPressure * 40).toFixed(1);
}

// Vibe score for a single post = net reception.
export function vibeOf(post: Post): number {
  const base = post.up * 2 - post.down * 3;
  const multiplier = 1 + (post.boosts || 0) * 0.5;
  return Math.round(base * multiplier);
}

// Get total MMC minted by a citizen in the last 24 hours, excluding welcome grants and legislative/election grants
export function getDailyMintedAmount(address: string): number {
  const s = db.get();
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  return s.txs
    .filter(
      (t) =>
        t.to === address &&
        t.type === "mint" &&
        !t.memo.startsWith("welcome grant") &&
        !t.memo.startsWith("legislative grant") &&
        !t.memo.startsWith("election victory grant") &&
        t.at >= oneDayAgo
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

// Get decayed reward amount based on the current meme dilution percentage
export function getDecayedReward(baseReward: number): number {
  const dilution = memeDilution();
  return Math.max(0, Math.round(baseReward * (1 - dilution / 100)));
}

// Record a snapshot of Gross Domestic Brainrot history, capped at 20 entries
export function recordGdbSnapshot(): void {
  db.update((s) => {
    if (!s.gdbHistory) s.gdbHistory = [];
    s.gdbHistory.push({ at: Date.now(), gdb: grossDomesticBrainrot() });
    if (s.gdbHistory.length > 20) {
      s.gdbHistory = s.gdbHistory.slice(-20);
    }
  });
}
// ─── Economic Events Engine ───────────────────────────────────────────────────

// Minimum milliseconds between two events of the same type
const EVENT_COOLDOWN: Record<EconomicEventType, number> = {
  crash:     3 * 60 * 1000, // 3 min
  boom:      3 * 60 * 1000,
  inflation: 2 * 60 * 1000,
  tax_hike:  5 * 60 * 1000,
  airdrop:   5 * 60 * 1000,
};

// Scripted random events — pick one at random when the dice roll hits
const SCRIPTED_EVENTS: { type: EconomicEventType; title: string; description: string }[] = [
  {
    type: "tax_hike",
    title: "🏦 EMERGENCY TAX HIKE",
    description: "The Ministry of Finance has imposed a 3 MMC transfer surcharge for the next 10 minutes to cover national meme debt.",
  },
  {
    type: "airdrop",
    title: "🪂 NATIONAL MEME STIMULUS",
    description: "The Federal Reserve of Brainrot has printed 50 MMC for every citizen. Nothing could go wrong.",
  },
  {
    type: "inflation",
    title: "📈 INFLATION ALERT",
    description: "Cringe output is at record levels. MMC purchasing power declines. Citizens advised to post harder.",
  },
];

function makeEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Returns the timestamp of the last fired event of a given type, or 0 if none. */
function lastEventAt(type: EconomicEventType): number {
  const events = db.get().economicEvents ?? [];
  const matches = events.filter((e) => e.type === type);
  return matches.length > 0 ? Math.max(...matches.map((e) => e.at)) : 0;
}

/** Persist a new event and return it. */
function fireEvent(
  type: EconomicEventType,
  title: string,
  description: string
): EconomicEvent {
  const event: EconomicEvent = {
    id: makeEventId(),
    type,
    title,
    description,
    at: Date.now(),
    resolved: false,
  };
  db.update((s) => {
    if (!s.economicEvents) s.economicEvents = [];
    s.economicEvents.push(event);
    // Keep log capped at 30 entries
    if (s.economicEvents.length > 30) {
      s.economicEvents = s.economicEvents.slice(-30);
    }
  });
  applyEvent(event);
  return event;
}

/** Apply an event's mechanical effects to the ledger and citizens. */
export function applyEvent(event: EconomicEvent): void {
  const s = db.get();
  const citizenAddresses = Object.keys(s.citizens).filter(
    (addr) => !s.citizens[addr].isAI
  );

  if (event.type === "crash") {
    // Burn 5% from each human citizen wallet (capped at 50 MMC)
    citizenAddresses.forEach((addr) => {
      const bal = ledger.balanceOf(addr);
      const burn = Math.min(Math.floor(bal * 0.05), 50);
      if (burn > 0) ledger.burn(addr, burn, `market crash — meme recession`);
    });

    // Knock aura from top-5 highest-aura citizens (up to -100 or -8% each)
    const ranked = citizenAddresses
      .map((addr) => ({ addr, aura: s.citizens[addr].aura }))
      .sort((a, b) => b.aura - a.aura)
      .slice(0, 5);

    db.update((st) => {
      ranked.forEach(({ addr }) => {
        const cit = st.citizens[addr];
        if (cit) {
          const loss = Math.min(100, Math.floor(cit.aura * 0.08));
          cit.aura = Math.max(0, cit.aura - loss);
        }
      });
      const ev = st.economicEvents?.find((e) => e.id === event.id);
      if (ev) ev.resolved = true;
    });

  } else if (event.type === "boom") {
    // Mint 25 MMC airdrop to every human citizen
    citizenAddresses.forEach((addr) => {
      ledger.mint(addr, 25, `brainrot boom — stimulus drop`);
    });
    db.update((st) => {
      const ev = st.economicEvents?.find((e) => e.id === event.id);
      if (ev) ev.resolved = true;
    });

  } else if (event.type === "airdrop") {
    // Mint 50 MMC to every human citizen
    citizenAddresses.forEach((addr) => {
      ledger.mint(addr, 50, `national meme stimulus airdrop`);
    });
    db.update((st) => {
      const ev = st.economicEvents?.find((e) => e.id === event.id);
      if (ev) ev.resolved = true;
    });

  } else if (event.type === "tax_hike") {
    // Set elevated transfer fee flag for 10 minutes
    db.update((st) => {
      st.taxHikeEndsAt = Date.now() + 10 * 60 * 1000;
      const ev = st.economicEvents?.find((e) => e.id === event.id);
      if (ev) ev.resolved = true;
    });

  } else if (event.type === "inflation") {
    // Inflation already embedded in getDecayedReward — just resolve
    db.update((st) => {
      const ev = st.economicEvents?.find((e) => e.id === event.id);
      if (ev) ev.resolved = true;
    });
  }
}

/**
 * Called every campaign loop tick.
 * Returns the newly fired event (if any) so the engine can post AI commentary.
 */
export function checkAndFireEvents(): EconomicEvent | null {
  const dilution = memeDilution();
  const gdb = grossDomesticBrainrot();
  const s = db.get();
  const prevGdb =
    s.gdbHistory && s.gdbHistory.length > 1
      ? s.gdbHistory[s.gdbHistory.length - 2]?.gdb ?? 0
      : 0;

  // Market Crash: dangerously high cringe/spam ratio
  if (dilution > 65) {
    if (Date.now() - lastEventAt("crash") > EVENT_COOLDOWN.crash) {
      return fireEvent(
        "crash",
        "💥 MMC MARKET CRASH",
        `Meme Dilution hit ${dilution.toFixed(1)}%. The economy is in freefall. Top citizens lose aura. Everyone loses MMC.`
      );
    }
  }

  // Brainrot Boom: low dilution AND GDB growing fast
  if (dilution < 20 && gdb > prevGdb + 500) {
    if (Date.now() - lastEventAt("boom") > EVENT_COOLDOWN.boom) {
      return fireEvent(
        "boom",
        "🚀 BRAINROT BOOM",
        `GDB surged by ${(gdb - prevGdb).toLocaleString()} points and inflation is under control. Citizens receive 25 MMC.`
      );
    }
  }

  // Random scripted event (10% chance per campaign tick)
  if (Math.random() < 0.1) {
    const template = SCRIPTED_EVENTS[Math.floor(Math.random() * SCRIPTED_EVENTS.length)];
    if (Date.now() - lastEventAt(template.type) > EVENT_COOLDOWN[template.type]) {
      return fireEvent(template.type, template.title, template.description);
    }
  }

  return null;
}

/** Latest event fired in the last 5 minutes, or null. */
export function getActiveEvent(): EconomicEvent | null {
  const events = db.get().economicEvents ?? [];
  const fiveMinAgo = Date.now() - 5 * 60 * 1000;
  const recent = events.filter((e) => e.at >= fiveMinAgo);
  return recent.length > 0 ? recent[recent.length - 1] : null;
}

/** Last N economic events (newest first). */
export function getRecentEvents(n = 5): EconomicEvent[] {
  const events = db.get().economicEvents ?? [];
  return [...events].reverse().slice(0, n);
}

/** Whether an elevated tax hike is currently active. */
export function isTaxHikeActive(): boolean {
  const endsAt = db.get().taxHikeEndsAt ?? 0;
  return Date.now() < endsAt;
}

/**
 * Federal Reserve AI Rate-Tuning:
 * Adjusts rates dynamically based on circulating supply and inflation/dilution.
 */
export function tuneRatesAI(): void {
  const dilution = memeDilution();
  const supply = ledger.circulatingSupply();

  // Baseline values
  let basePost = 50;
  let baseSpam = 20;
  let baseUpvote = 5;
  let baseDownvote = 3;

  // 1. Dilution tuning
  if (dilution > 40) {
    // Tighten policy
    basePost = Math.max(10, Math.round(basePost * (1 - (dilution - 40) / 100)));
    baseSpam = Math.min(60, Math.round(baseSpam * (1 + (dilution - 40) / 50)));
    baseUpvote = Math.max(2, Math.round(baseUpvote * (1 - (dilution - 40) / 120)));
    baseDownvote = Math.min(15, Math.round(baseDownvote * (1 + (dilution - 40) / 50)));
  } else if (dilution < 20) {
    // Stimulus policy
    basePost = Math.min(80, Math.round(basePost * 1.3));
    baseSpam = Math.max(10, Math.round(baseSpam * 0.7));
    baseUpvote = Math.min(10, Math.round(baseUpvote * 1.3));
  }

  // 2. Supply cap tuning
  if (supply > 150000) {
    const supplyFactor = Math.min(2.0, supply / 150000);
    // reduce printing rewards, increase burning taxes
    basePost = Math.max(5, Math.round(basePost / supplyFactor));
    baseUpvote = Math.max(1, Math.round(baseUpvote / supplyFactor));
    baseSpam = Math.min(80, Math.round(baseSpam * supplyFactor));
    baseDownvote = Math.min(20, Math.round(baseDownvote * supplyFactor));
  }

  // Apply changes to RATES object
  (RATES as any).POST = basePost;
  (RATES as any).SPAM_TAX = baseSpam;
  (RATES as any).UPVOTE_REWARD = baseUpvote;
  (RATES as any).DOWNVOTE_BURN = baseDownvote;

  console.log(`[Federal Reserve AI] Rates tuned. Dilution: ${dilution}%, Supply: ${supply} MMC. Rates -> POST: ${RATES.POST}, SPAM: ${RATES.SPAM_TAX}, UPVOTE: ${RATES.UPVOTE_REWARD}, DOWNVOTE: ${RATES.DOWNVOTE_BURN}`);
}
