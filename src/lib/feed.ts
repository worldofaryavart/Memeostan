// feed.ts — how the timeline is arranged before it's rendered.

import { isStateAccount } from "./systemAccounts";
import type { Post } from "./types";

export type FeedEntry =
  | { kind: "post"; post: Post }
  | { kind: "notices"; posts: Post[] };

/** A run shorter than this stays as ordinary cards — one decree is drama. */
export const MIN_RUN_TO_FOLD = 2;

/**
 * Fold consecutive posts from the state into a single entry.
 *
 * The courts, the election commission and the police account for roughly a
 * quarter of the timeline and they arrive in clumps — measured runs of up to four
 * in a row. Each notice is worth keeping; four of them stacked is a noticeboard,
 * not a public square. Only *consecutive* notices fold, so this changes the shape
 * of the feed without hiding anything or reordering it.
 */
export function groupFeed(posts: Post[]): FeedEntry[] {
  const entries: FeedEntry[] = [];
  let run: Post[] = [];

  const flush = () => {
    if (run.length === 0) return;
    if (run.length >= MIN_RUN_TO_FOLD) {
      entries.push({ kind: "notices", posts: run });
    } else {
      run.forEach((post) => entries.push({ kind: "post", post }));
    }
    run = [];
  };

  for (const post of posts) {
    if (isStateAccount(post.author)) {
      run.push(post);
    } else {
      flush();
      entries.push({ kind: "post", post });
    }
  }
  flush();

  return entries;
}
