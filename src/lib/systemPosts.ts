import { db } from "./db";

// System accounts (election commission, courts) announcing themselves in the feed.
// `id` is caller-supplied so the client's optimistic copy matches what the server
// commits; omit it and one is generated.
export function createSystemPost(author: string, text: string, id?: string): string {
  const postId = id || "post_" + Math.random().toString(36).slice(2, 10);
  const post = {
    id: postId,
    author,
    text,
    image: null,
    up: 0,
    down: 0,
    voters: {},
    replies: [],
    at: Date.now(),
  };
  db.update((s) => {
    if (s.posts.some((p) => p.id === postId)) return;
    s.posts.unshift(post);
  });
  return postId;
}
