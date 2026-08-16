// clock.ts — how fast the country runs.
//
// These numbers were scattered across six files and every one of them was a
// demo speed: three-minute referendums, five-minute elections, two-minute
// trials. That is the right pace for testing a mechanism and the wrong pace for
// a country. At three minutes a bill is a novelty you watch resolve while
// sitting there; at four hours it is something you tell someone about and come
// back for. Nothing in Memeostan gave anyone a reason to return tomorrow, and
// this was most of why.
//
// Two speeds, one source of truth:
//
//   • REAL (default) — hours and days. A referendum spans an afternoon so people
//     in different timezones can reach it. A government holds office for a day.
//   • FAST (MEMEOSTAN_FAST_CLOCK=1) — the old demo speeds, for local development
//     and the end-to-end probes, which otherwise take a working day to run.
//
// Everything is declared in real units and divided. A single knob means the two
// modes cannot drift apart, which they would within a week if each caller had
// its own `if (demo)`.

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Demo mode compresses an hour into a minute. */
const COMPRESSION = 60;

export function isFastClock(): boolean {
  return process.env.MEMEOSTAN_FAST_CLOCK === "1";
}

function scale(ms: number): number {
  return isFastClock() ? Math.max(1000, Math.round(ms / COMPRESSION)) : ms;
}

export const CLOCK = {
  // ── the assembly ───────────────────────────────────────────────────────────
  /** Base time a bill stays open, before the per-quorum allowance. */
  get proposalBase() {
    return scale(4 * HOUR);
  },
  /** Added per citizen of quorum: more people to reach, more time to reach them. */
  get proposalPerQuorum() {
    return scale(1 * HOUR);
  },
  /** However large the country, a bill is decided within a day. */
  get proposalMax() {
    return scale(24 * HOUR);
  },

  // ── elections ──────────────────────────────────────────────────────────────
  /** A term of office. Daily, so there is a reason to check who is in charge. */
  get electionTerm() {
    return scale(24 * HOUR);
  },

  // ── the courts ─────────────────────────────────────────────────────────────
  /** How long a jury has to return a verdict before the bench rules alone. */
  get trialDuration() {
    return scale(2 * HOUR);
  },
  /** How long the world clock leaves a verdict for the AI beat to write. */
  get verdictGrace() {
    return scale(5 * MINUTE);
  },
  /** One citizen is not put on trial twice inside this window. */
  get retrialCooldown() {
    return scale(6 * HOUR);
  },

  // ── policing ───────────────────────────────────────────────────────────────
  /**
   * How far back the Cyber Police look on patrol. Longer than it was, because a
   * patrol that only sees five minutes of feed misses everything posted while
   * the country was asleep.
   */
  get patrolWindow() {
    return scale(30 * MINUTE);
  },
  /**
   * The window a posting-rate article is measured over. NOT scaled: "three posts
   * in five minutes" is a rule citizens read and act on, and a rule whose meaning
   * changes with an environment variable is not a rule.
   */
  spamWindow: 5 * MINUTE,
  /** How long a citizen has to answer a citation before it goes to the court. */
  get citationGrace() {
    return scale(30 * MINUTE);
  },

  // ── the economy ────────────────────────────────────────────────────────────
  get taxHikeDuration() {
    return scale(1 * HOUR);
  },
  get gdbSnapshotInterval() {
    return scale(30 * MINUTE);
  },
  get eventCooldown() {
    return scale(2 * HOUR);
  },
  get rareEventCooldown() {
    return scale(6 * HOUR);
  },
} as const;

/** Human-readable, for the UI and the state's own announcements. */
export function describeDuration(ms: number): string {
  if (ms >= HOUR) {
    const hours = ms / HOUR;
    const rounded = hours >= 10 ? Math.round(hours) : Math.round(hours * 10) / 10;
    return `${rounded} hour${rounded === 1 ? "" : "s"}`;
  }
  if (ms >= MINUTE) {
    const mins = Math.round(ms / MINUTE);
    return `${mins} minute${mins === 1 ? "" : "s"}`;
  }
  return `${Math.round(ms / 1000)}s`;
}
