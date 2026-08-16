// metrics.ts — is anybody actually enjoying this.
//
// Everything here is derived from state the country already keeps. There are no
// cookies, no third-party analytics and no per-person event stream: the ledger,
// the feed and the docket already record every meaningful thing a citizen has
// done, and anything they do not record is not meaningful.
//
// The funnel is deliberately shaped around the ONE claim Memeostan makes. It is
// not "did they sign up" — signups are easy and mean nothing. It is:
//
//   1. claimed     — became a citizen at all
//   2. posted      — did the basic thing the app is for
//   3. noticed     — the state acted on them. This is the moment the idea lands;
//                    a citizen who has never been cited has not seen the product.
//   4. governed    — voted, sat on a jury, or tabled a bill. Realised they can
//                    change the rules rather than only obey them.
//   5. returned    — came back on a different day. The only honest retention
//                    signal, and the one that decides whether this is a country
//                    or a demo somebody clicked once.
//
// A number that goes up because we measured it more generously is worse than no
// number. Where a metric is a proxy, it says so.

import { db } from "./db";
import { CYBER_POLICE, SUPREME_COURT, isStateAccount } from "./systemAccounts";
import type { NationState } from "./types";

const DAY = 24 * 60 * 60 * 1000;

export interface Funnel {
  claimed: number;
  posted: number;
  noticed: number;
  governed: number;
  returned: number;
}

export interface Metrics {
  at: number;
  foundedAt: number | null;
  ageDays: number;

  funnel: Funnel;
  /** Each stage as a share of the one before it, which is where drop-off shows. */
  conversion: Record<keyof Funnel, number>;

  feed: {
    posts: number;
    byCitizens: number;
    byState: number;
    /** The share of the square written by people. A country that is mostly
     *  government notices is a waiting room. */
    citizenShare: number;
  };

  law: {
    articlesInForce: number;
    passedByCitizens: number;
    repealed: number;
    billsTabled: number;
    lapsedForQuorum: number;
  };

  enforcement: {
    citations: number;
    trials: number;
    benchVerdicts: number;
    juryVerdicts: number;
    /** Trials decided by citizens rather than by default. The civic pulse. */
    juryShare: number;
  };

  /** Citations and verdicts are the only things worth showing an outsider. */
  shareableMoments: number;

  economy: {
    circulating: number;
    burned: number;
    minted: number;
  };

  /** Milliseconds from claiming a passport to first post. Median, not mean. */
  medianTimeToFirstPostMs: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

const share = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000;

const utcDay = (at: number) => Math.floor(at / DAY);

export function computeMetrics(state: NationState = db.get()): Metrics {
  const citizens = Object.values(state.citizens).filter((c) => !isStateAccount(c.address));
  const addresses = new Set(citizens.map((c) => c.address));

  const citizenPosts = state.posts.filter((p) => addresses.has(p.author));
  const statePosts = state.posts.filter((p) => isStateAccount(p.author));

  // ── who reached which stage ────────────────────────────────────────────────
  const posted = new Set(citizenPosts.map((p) => p.author));

  const noticed = new Set<string>();
  for (const post of state.posts) {
    if (!addresses.has(post.author)) continue;
    if ((post.replies ?? []).some((r) => r.author === CYBER_POLICE || r.author === SUPREME_COURT)) {
      noticed.add(post.author);
    }
  }
  for (const trial of state.trials ?? []) {
    if (addresses.has(trial.defendant)) noticed.add(trial.defendant);
  }

  const governed = new Set<string>();
  // Defensive on the vote arrays: this endpoint runs against live production
  // state, and a metrics page that 500s on one malformed row is worse than
  // useless — it fails exactly when you most want to look at it.
  const voters = (record: { yesVotes?: string[]; noVotes?: string[] }) =>
    [...(record.yesVotes ?? []), ...(record.noVotes ?? [])];

  for (const proposal of state.proposals ?? []) {
    if (addresses.has(proposal.creator)) governed.add(proposal.creator);
    voters(proposal).forEach((a) => addresses.has(a) && governed.add(a));
  }
  for (const trial of state.trials ?? []) {
    voters(trial).forEach((a) => addresses.has(a) && governed.add(a));
  }
  Object.keys(state.activeElection?.votes ?? {}).forEach((a) => addresses.has(a) && governed.add(a));

  // ── who came back ─────────────────────────────────────────────────────────
  //
  // Distinct UTC days on which a citizen did something recorded. A proxy: a
  // citizen who reads the feed for an hour and posts nothing is invisible here,
  // and counting them would need tracking the country does not do. It under-
  // reports rather than over-reports, which is the right direction to be wrong in.
  const activeDays = new Map<string, Set<number>>();
  const note = (address: string, at: number) => {
    if (!addresses.has(address)) return;
    if (!activeDays.has(address)) activeDays.set(address, new Set());
    activeDays.get(address)!.add(utcDay(at));
  };
  citizenPosts.forEach((p) => note(p.author, p.at));
  state.posts.forEach((p) => (p.replies ?? []).forEach((r) => note(r.author, r.at)));
  state.txs.forEach((t) => {
    if (t.type === "transfer") note(t.from, t.at);
  });
  citizens.forEach((c) => note(c.address, c.joinedAt));

  const returned = [...activeDays.values()].filter((days) => days.size >= 2).length;

  // ── time to first post ────────────────────────────────────────────────────
  const firstPostAt = new Map<string, number>();
  for (const post of citizenPosts) {
    const seen = firstPostAt.get(post.author);
    if (seen === undefined || post.at < seen) firstPostAt.set(post.author, post.at);
  }
  const timeToFirstPost = citizens
    .filter((c) => firstPostAt.has(c.address))
    .map((c) => firstPostAt.get(c.address)! - c.joinedAt)
    .filter((ms) => ms >= 0);

  // ── the law ───────────────────────────────────────────────────────────────
  const proposals = state.proposals ?? [];
  const articles = proposals.filter((p) => p.status === "enacted" && p.article && !p.repealedBy);
  const citizenArticles = articles.filter((p) => addresses.has(p.creator));

  // ── the docket ────────────────────────────────────────────────────────────
  const trials = state.trials ?? [];
  const resolved = trials.filter((t) => t.status === "resolved");
  const bench = resolved.filter((t) => t.benchVerdict).length;
  const jury = resolved.length - bench;

  const citations = state.posts.reduce(
    (n, p) =>
      n +
      (p.replies ?? []).filter(
        (r) => r.author === CYBER_POLICE && !r.text.startsWith("🕊️")
      ).length,
    0
  );

  // ── the ledger ────────────────────────────────────────────────────────────
  const minted = state.txs.filter((t) => t.type === "mint").reduce((n, t) => n + t.amount, 0);
  const burned = state.txs.filter((t) => t.type === "burn").reduce((n, t) => n + t.amount, 0);
  const circulating = Object.entries(state.balances).reduce(
    (n, [addr, bal]) => (isStateAccount(addr) ? n : n + bal),
    0
  );

  const funnel: Funnel = {
    claimed: citizens.length,
    posted: posted.size,
    noticed: noticed.size,
    governed: governed.size,
    returned,
  };

  return {
    at: Date.now(),
    foundedAt: state.founded,
    ageDays: state.founded ? Math.round(((Date.now() - state.founded) / DAY) * 10) / 10 : 0,

    funnel,
    conversion: {
      claimed: 1,
      posted: share(funnel.posted, funnel.claimed),
      noticed: share(funnel.noticed, funnel.posted),
      governed: share(funnel.governed, funnel.claimed),
      returned: share(funnel.returned, funnel.claimed),
    },

    feed: {
      posts: state.posts.length,
      byCitizens: citizenPosts.length,
      byState: statePosts.length,
      citizenShare: share(citizenPosts.length, state.posts.length),
    },

    law: {
      articlesInForce: articles.length,
      passedByCitizens: citizenArticles.length,
      repealed: proposals.filter((p) => p.repealedBy).length,
      billsTabled: proposals.filter((p) => addresses.has(p.creator)).length,
      lapsedForQuorum: proposals.filter((p) => p.status === "lapsed").length,
    },

    enforcement: {
      citations,
      trials: trials.length,
      benchVerdicts: bench,
      juryVerdicts: jury,
      juryShare: share(jury, resolved.length),
    },

    shareableMoments: citations + resolved.length,

    economy: { circulating, burned, minted },

    medianTimeToFirstPostMs: median(timeToFirstPost),
  };
}

// ── reading the numbers ──────────────────────────────────────────────────────

export type Verdict = "no-data" | "cold" | "warming" | "working";

export interface Readiness {
  verdict: Verdict;
  /** What is actually true right now, in one line. */
  summary: string;
  /** The single thing most worth fixing next, given the numbers. */
  bottleneck: string;
}

/**
 * An honest reading, including the honest refusal.
 *
 * Below a handful of citizens no ratio means anything — one person posting is
 * 100% activation and tells you nothing. Reporting a percentage there would be
 * inventing confidence, so this says "no data" instead, which is the true answer.
 */
export function readiness(m: Metrics): Readiness {
  const f = m.funnel;

  if (f.claimed < 5) {
    return {
      verdict: "no-data",
      summary: `${f.claimed} citizen${f.claimed === 1 ? "" : "s"}. Too few for any rate to mean anything.`,
      bottleneck:
        "Nobody has arrived yet. Nothing measurable can be learned until roughly 20 people have claimed a passport.",
    };
  }

  if (m.conversion.posted < 0.5) {
    return {
      verdict: "cold",
      summary: `${Math.round(m.conversion.posted * 100)}% of citizens have posted at all.`,
      bottleneck: "People claim a passport and then do nothing. The first screen is not asking for anything.",
    };
  }

  if (m.conversion.noticed < 0.5) {
    return {
      verdict: "cold",
      summary: `Only ${Math.round(m.conversion.noticed * 100)}% of posters have ever been acted on by the state.`,
      bottleneck:
        "Citizens are posting but never meeting the government, which is the entire idea. Either the articles are too narrow to catch ordinary posting, or the patrol is too slow.",
    };
  }

  if (m.conversion.returned < 0.2) {
    return {
      verdict: "warming",
      summary: `${Math.round(m.conversion.returned * 100)}% of citizens came back on another day.`,
      bottleneck:
        "People get the joke once and leave. There is no reason to return: nothing accrues, and nothing is waiting for them tomorrow.",
    };
  }

  if (m.law.passedByCitizens === 0) {
    return {
      verdict: "warming",
      summary: `Citizens return, but have never passed a law of their own.`,
      bottleneck:
        "The legislature is the differentiator and nobody is using it. Either it is too hard to find, too slow to matter, or quorum is out of reach.",
    };
  }

  return {
    verdict: "working",
    summary:
      `${Math.round(m.conversion.returned * 100)}% return, ${m.law.passedByCitizens} citizen-made ` +
      `article${m.law.passedByCitizens === 1 ? "" : "s"} in force, ${Math.round(m.enforcement.juryShare * 100)}% of trials decided by a jury.`,
    bottleneck:
      "The loop is closing on its own. The constraint is now how many people hear about it, not what happens when they arrive.",
  };
}
