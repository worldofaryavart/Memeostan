// judiciary.ts — the AI Court and Mock Trial engine.
// All trials are community-voted and resolved here.

import { db } from "./db";
import { ledger } from "./ledger";
import { adjustAura, getCitizen, ensureAICitizen } from "./citizens";
import { createPost, addReply } from "./posts";
import type { Trial, Citizen } from "./types";

export const SUPREME_COURT_ADDRESS = "0xai_supremecourt0000000000000000court0";

export function ensureSupremeCourtAI(): void {
  const court: Citizen = {
    address: SUPREME_COURT_ADDRESS,
    username: "Supreme Court Judge",
    handle: "@supreme_court",
    faction: "NPC",
    pfp: "⚖️",
    isAI: true,
    joinedAt: Date.now(),
    aura: 1500,
    party: "Judicial Department",
  };
  ensureAICitizen(court);
}

// File a new mock trial
export function fileCharge(
  plaintiff: string,
  defendant: string,
  charge: string,
  description: string,
  durationMs: number = 120000 // 2 minutes default for snappy testing
): { ok: boolean; reason?: string; trialId?: string } {
  // Ensure court AI exists
  ensureSupremeCourtAI();

  const def = getCitizen(defendant);
  if (!def) {
    return { ok: false, reason: "Defendant citizen not found." };
  }

  // If it's a citizen-filed lawsuit, charge 30 MMC fee
  const isStateProsecuted = plaintiff === "THE STATE" || plaintiff === SUPREME_COURT_ADDRESS;
  if (!isStateProsecuted) {
    const pl = getCitizen(plaintiff);
    if (!pl) {
      return { ok: false, reason: "Plaintiff citizen not found." };
    }
    const balance = ledger.balanceOf(plaintiff);
    if (balance < 30) {
      return {
        ok: false,
        reason: `Filing a lawsuit costs 30 MMC. Your balance is only ${balance} MMC.`,
      };
    }
    // Burn the court fee
    ledger.burn(plaintiff, 30, `lawsuit filing fee — court cost ⚖️`);
  }

  const trialId = "trial_" + Math.random().toString(36).slice(2, 10);
  
  // Format the post announcement
  const defName = def.username;
  const plName = isStateProsecuted ? "THE STATE" : `@${getCitizen(plaintiff)?.username || "Plaintiff"}`;
  
  const announcementText = `⚖️ COURT DECREE: Mock Trial Initiated!\n\n` +
    `The State vs @${defName} (Prosecuted by ${plName})\n` +
    `Charge: ${charge}\n\n` +
    `"${description}"\n\n` +
    `🏛️ VOTE NOW! Should the defendant be declared GUILTY or INNOCENT? React in the Supreme Court page.`;

  // Create post (announces in feed)
  const post = createPost({
    author: SUPREME_COURT_ADDRESS,
    text: announcementText,
  });

  const trial: Trial = {
    id: trialId,
    defendant,
    plaintiff,
    charge,
    description,
    status: "voting",
    yesVotes: [],
    noVotes: [],
    verdict: null,
    penalty: "",
    postId: post.id,
    at: Date.now(),
    endsAt: Date.now() + durationMs,
  };

  db.update((s) => {
    if (!s.trials) s.trials = [];
    s.trials.unshift(trial);
  });

  return { ok: true, trialId };
}

// Cast a community vote on a trial
export function voteOnTrial(trialId: string, voter: string, voteType: "guilty" | "innocent"): { ok: boolean; reason?: string } {
  let ok = false;
  let reason = "";

  db.update((s) => {
    const trial = s.trials?.find((t) => t.id === trialId);
    if (!trial) {
      reason = "Trial not found.";
      return;
    }
    if (trial.status !== "voting") {
      reason = "This trial has already been resolved.";
      return;
    }

    if (voteType === "guilty") {
      if (!trial.yesVotes.includes(voter)) {
        trial.yesVotes.push(voter);
      }
      trial.noVotes = trial.noVotes.filter((addr) => addr !== voter);
    } else {
      if (!trial.noVotes.includes(voter)) {
        trial.noVotes.push(voter);
      }
      trial.yesVotes = trial.yesVotes.filter((addr) => addr !== voter);
    }
    ok = true;
  });

  return { ok, reason };
}

// Generate the specific in-character judge comment for the feed
function getJudgeVerdictComment(charge: string, isGuilty: boolean): string {
  const norm = charge.toUpperCase();
  if (norm.includes("CRINGE")) {
    return isGuilty
      ? `⚖️ COURT VERDICT: The Court is in absolute agreement. This meme was a weapon of mass vibe destruction. Sentenced to hard labor in the cringe mines. -100 Aura!`
      : `⚖️ COURT VERDICT: The Court finds that while the meme was mid, it did not cross the threshold of criminal cringe. You are cleared of all charges. Compensation awarded!`;
  }
  if (norm.includes("LOGIC")) {
    return isGuilty
      ? `⚖️ COURT VERDICT: Case proven. We operate on raw vibes, not empirical proof. Using logic in the feeds is an act of aggression against the Memeocracy. Fined!`
      : `⚖️ COURT VERDICT: The Court notes that while you used long words, they contained no actual logic or coherent meaning. Acquitted!`;
  }
  if (norm.includes("SPAM")) {
    return isGuilty
      ? `⚖️ COURT VERDICT: The feed is not your personal diary. Stop posting slop every 10 seconds. Go outside and think about what you have done. Fined!`
      : `⚖️ COURT VERDICT: Your posting frequency was high, but the content quality was deemed essential for national entertainment. Dismissed!`;
  }
  if (norm.includes("NPC")) {
    return isGuilty
      ? `⚖️ COURT VERDICT: The Turing test results are negative. You display zero original thought or custom styling. NPC designation confirmed. -100 Aura!`
      : `⚖️ COURT VERDICT: You have demonstrated sufficient erratic behavior and typing typos to prove you are indeed a human brainrot poster. Freed!`;
  }
  // Generic fallback
  return isGuilty
    ? `⚖️ COURT VERDICT: The jury has spoken. The defendant is guilty of these allegations. May the algorithm have mercy on your aura.`
    : `⚖️ COURT VERDICT: The allegations are unfounded. The defendant is acquitted of all charges. Go in peace and post bangers.`;
}

// Resolve expired trials
export function resolveTrials(): number {
  const state = db.get();
  if (!state.trials) return 0;

  const expiredTrials = state.trials.filter(
    (t) => t.status === "voting" && Date.now() >= t.endsAt
  );

  if (expiredTrials.length === 0) return 0;

  let count = 0;

  expiredTrials.forEach((trial) => {
    const def = getCitizen(trial.defendant);
    if (!def) {
      // Defendant deleted or missing, dismiss
      db.update((s) => {
        const t = s.trials?.find((x) => x.id === trial.id);
        if (t) {
          t.status = "resolved";
          t.verdict = "DISMISSED";
          t.penalty = "Defendant not found. Case dismissed.";
        }
      });
      count++;
      return;
    }

    const yesCount = trial.yesVotes.length;
    const noCount = trial.noVotes.length;
    const isGuilty = yesCount > noCount;

    let penaltyDesc = "";

    if (isGuilty) {
      // 1. Penalty: burn 50 MMC
      const balance = ledger.balanceOf(trial.defendant);
      const toBurn = Math.min(balance, 50);
      if (toBurn > 0) {
        ledger.burn(trial.defendant, toBurn, `court order — guilty verdict penalty for ${trial.charge} ⚖️`);
      }
      // 2. Penalty: deduct 100 aura
      adjustAura(trial.defendant, -100);

      penaltyDesc = `Burned ${toBurn} MMC & Lost 100 Aura.`;

      // Post verdict announcement to feed
      const verdictPostText = `⚖️ MOCK TRIAL VERDICT: @${def.username} is GUILTY!\n\n` +
        `Verdict: GUILTY of "${trial.charge}" by a community vote of ${yesCount} to ${noCount}.\n` +
        `Penalty: Fined 50 MMC & lost 100 Aura.\n\n` +
        `"${getJudgeVerdictComment(trial.charge, true)}"`;

      const post = createPost({
        author: SUPREME_COURT_ADDRESS,
        text: verdictPostText,
      });

      // Also reply to original announcement post if it exists
      if (trial.postId) {
        addReply(trial.postId, SUPREME_COURT_ADDRESS, `⚖️ GUILTY VERDICT: This court orders a penalty of -100 Aura and a fine of 50 MMC. Case closed.`);
      }
    } else {
      // 1. Reward: mint 25 MMC
      ledger.mint(trial.defendant, 25, `court order — innocent verdict compensation for ${trial.charge} ⚖️`);
      // 2. Reward: add 50 aura
      adjustAura(trial.defendant, 50);

      penaltyDesc = `Acquitted. Awarded 25 MMC & +50 Aura compensation.`;

      // Post verdict announcement
      const verdictPostText = `⚖️ MOCK TRIAL VERDICT: @${def.username} is INNOCENT!\n\n` +
        `Verdict: ACQUITTED of "${trial.charge}" by a community vote of ${noCount} to ${yesCount}.\n` +
        `Compensation: Awarded 25 MMC & +50 Aura.\n\n` +
        `"${getJudgeVerdictComment(trial.charge, false)}"`;

      const post = createPost({
        author: SUPREME_COURT_ADDRESS,
        text: verdictPostText,
      });

      // Reply to original announcement post
      if (trial.postId) {
        addReply(trial.postId, SUPREME_COURT_ADDRESS, `⚖️ INNOCENT VERDICT: The defendant is acquitted of all charges. The State has issued 25 MMC compensation.`);
      }
    }

    db.update((s) => {
      const t = s.trials?.find((x) => x.id === trial.id);
      if (t) {
        t.status = "resolved";
        t.verdict = isGuilty ? "GUILTY" : "INNOCENT";
        t.penalty = penaltyDesc;
      }
    });

    count++;
  });

  return count;
}

export function getAllTrials(): Trial[] {
  return db.get().trials || [];
}

export function getActiveTrials(): Trial[] {
  return (db.get().trials || []).filter((t) => t.status === "voting");
}

export function getResolvedTrials(): Trial[] {
  return (db.get().trials || []).filter((t) => t.status === "resolved");
}
