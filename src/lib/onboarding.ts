// onboarding.ts — what happens to you in the first thirty seconds.
//
// The hardest problem this country has is that it starts empty. Claiming a
// passport used to drop a person into a feed with nothing in it and no reason to
// stay: juries need citizens, quorum needs citizens, a law is only funny when it
// applies to somebody else. A visitor arriving alone got a blank wall.
//
// So the state acts on you the moment you exist. It issues a number, it pays the
// grant, and it serves the constitution on you — which is genuinely the
// information a new citizen needs, and also the joke, because the joke is that
// it is all completely sincere.
//
// Deliberately not LLM-written. This is the first impression, it has to be
// instant and identical every time, and it carries facts (your number, the
// articles in force) that must not be improvised.

import { db } from "./db";
import { activeLaws, describeRule } from "./constitution";
import { createSystemPost } from "./systemPosts";
import { REGISTRAR } from "./systemAccounts";
import { currentQuorum, electorate } from "./quorum";
import { RATES } from "./economy";
import type { Citizen } from "./types";

function ordinal(n: number): string {
  const suffix = n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * The Registrar's notice to a citizen who has just been issued a passport.
 *
 * Returns the post id so the caller can hand it back to the client, which uses
 * it to scroll the new citizen to their own file rather than to the top of a
 * feed they have never seen.
 */
export function welcomeCitizen(citizen: Citizen, postId?: string): string {
  const laws = activeLaws();
  const number = citizen.citizenNo ?? 1;
  const population = electorate();

  const articles = laws
    .map((law) => `  ${law.article}. ${law.title} — ${describeRule(law.rule!)}`)
    .join("\n");

  // The first citizen of a country is a different event from the four hundredth,
  // and pretending otherwise wastes the one moment where the fact is remarkable.
  const standing =
    number === 1
      ? `You are the first citizen of Memeostan. There is no one else. The Bureau notes this without comment.`
      : `You are the ${ordinal(number)} citizen registered. The present population is ${population}.`;

  const body =
    `🪪 CERTIFICATE OF CITIZENSHIP\n\n` +
    `Issued to @${citizen.username}. National ID MMS-${String(number).padStart(4, "0")}.\n` +
    `${standing}\n\n` +
    `A welcome grant of ${RATES.WELCOME_GRANT} MMC has been credited to your account. ` +
    `Your Aura is set at ${citizen.aura}. Your passport is held in your browser and by nobody else; ` +
    `the Bureau cannot reissue it and will not be taking questions on the subject.\n\n` +
    `THE FOLLOWING ARTICLES ARE IN FORCE AND ARE HEREBY SERVED UPON YOU:\n${articles}\n\n` +
    `Ignorance of an article is not a defence. The Cyber Police patrol continuously. ` +
    `A citation left unanswered is referred to the Supreme Court, which may fine you.\n\n` +
    `You may amend any of the above. Table a bill in the High Chambers; ` +
    `${currentQuorum()} citizen${currentQuorum() === 1 ? "" : "s"} must vote for the result to stand. ` +
    `The Bureau has no opinion on which laws are wise and will enforce whichever you pass.\n\n` +
    `This window is now closed.`;

  return createSystemPost(REGISTRAR, body, postId);
}

/**
 * A notice served on the whole square when the constitution is founded, so a
 * brand new country is not a blank wall to someone who has not joined yet.
 * Idempotent: it is posted once, on the first boot that has a constitution.
 */
export function proclaimConstitution(): void {
  const state = db.get();
  if (state.posts.some((p) => p.text.startsWith("📜 THE CONSTITUTION OF MEMEOSTAN"))) return;

  const laws = activeLaws();
  if (laws.length === 0) return;

  const articles = laws
    .map((law) => `${law.article}. ${law.title}\n   ${describeRule(law.rule!)}`)
    .join("\n\n");

  createSystemPost(
    REGISTRAR,
    `📜 THE CONSTITUTION OF MEMEOSTAN\n\n` +
      `The following articles are in force. They are enforced by the Cyber Police ` +
      `and tried before the Supreme Court.\n\n${articles}\n\n` +
      `Every one of them was passed by citizens and every one of them can be repealed ` +
      `by citizens. The government writes none of it. The government only enforces it.`
  );
}
