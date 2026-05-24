import { db } from "./db";

export function createSystemPost(author: string, text: string): string {
  const postId = "post_" + Math.random().toString(36).slice(2, 10);
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
    s.posts.unshift(post);
  });
  return postId;
}
