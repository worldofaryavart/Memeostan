// citations.ts — reading back what the state did to a particular post.
//
// The share card and the citation page both need the same thing: "what happened
// to this post, and which article was it under". Working that out from raw state
// in two places would guarantee the page and the image eventually disagreed.

import { CYBER_POLICE, SUPREME_COURT } from "./systemAccounts";
import type { NationState, Post, Trial } from "./types";

export type NoticeKind = "citation" | "guilty" | "innocent";

export interface Notice {
  kind: NoticeKind;
  post: Post;
  /** The citizen it happened to. */
  username: string;
  /** What the office said, in its own words. */
  text: string;
  /** e.g. "Article 1 — Logic is banned in public spaces", when known. */
  article: string | null;
  charge: string | null;
  penalty: string | null;
  benchVerdict: boolean;
  at: number;
}

/** The article a case file names, pulled back out of the description. */
function articleFromTrial(trial: Trial, state: NationState): string | null {
  const match = /Article (\d+)/.exec(trial.description);
  if (!match) return null;
  const number = Number(match[1]);
  const law = (state.proposals ?? []).find((p) => p.article === number);
  return law ? `Article ${number} — ${law.title}` : `Article ${number}`;
}

/**
 * What the state has done to this post, if anything.
 *
 * A verdict outranks a citation: once the court has ruled, that is the thing
 * worth showing, and the warning that preceded it is history.
 */
export function noticeFor(state: NationState, postId: string): Notice | null {
  const post = state.posts.find((p) => p.id === postId);
  if (!post) return null;

  const username = state.citizens[post.author]?.username ?? "a citizen";

  const trial = (state.trials ?? [])
    .filter((t) => t.status === "resolved" && t.description.includes(postId))
    .sort((a, b) => b.at - a.at)[0];

  if (trial && trial.verdict && trial.verdict !== "DISMISSED") {
    const guilty = trial.verdict === "GUILTY";
    // The court's reasoning lives in the verdict post it published.
    const verdictPost = state.posts.find(
      (p) => p.author === SUPREME_COURT && p.text.includes(`@${username}`) && p.text.includes("VERDICT")
    );
    const quoted = verdictPost ? /"([^]*)"\s*$/.exec(verdictPost.text)?.[1] : null;

    return {
      kind: guilty ? "guilty" : "innocent",
      post,
      username,
      text: quoted?.trim() || `The Court finds the charge of ${trial.charge} ${guilty ? "proven" : "unproven"}.`,
      article: articleFromTrial(trial, state),
      charge: trial.charge,
      penalty: trial.penalty || null,
      benchVerdict: Boolean(trial.benchVerdict),
      at: trial.at,
    };
  }

  const citation = post.replies.find((r) => r.author === CYBER_POLICE);
  if (!citation) return null;

  const articleMatch = /Article (\d+)/.exec(citation.text);
  const law = articleMatch
    ? (state.proposals ?? []).find((p) => p.article === Number(articleMatch[1]))
    : null;

  return {
    kind: "citation",
    post,
    username,
    text: citation.text,
    article: law ? `Article ${law.article} — ${law.title}` : articleMatch ? `Article ${articleMatch[1]}` : null,
    charge: null,
    penalty: null,
    benchVerdict: false,
    at: citation.at,
  };
}

/** Is there anything worth sharing about this post? Cheap client-side check. */
export function hasNotice(post: Post): boolean {
  return post.replies.some((r) => r.author === CYBER_POLICE || r.author === SUPREME_COURT);
}
