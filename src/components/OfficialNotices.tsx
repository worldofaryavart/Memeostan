"use client";

import { useState } from "react";
import { getCitizen } from "@/lib/citizens";
import type { Post } from "@/lib/types";

// A run of back-to-back notices from the state, folded into one card.
//
// The courts, the election commission and the police file a lot of paperwork —
// 28% of the timeline, arriving in runs of up to four in a row. Each one is worth
// having; reading four of them stacked on top of each other is not what the
// public square is for. So a run collapses to a single card you can open.
//
// A lone notice is left alone: one court decree in the feed is drama, not noise.

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

/** First line of a notice, which is the part that carries the headline. */
function headline(post: Post): string {
  const first = (post.text || "").split("\n").find((l) => l.trim()) || "";
  return first.length > 90 ? first.slice(0, 88) + "…" : first;
}

export default function OfficialNotices({ posts }: { posts: Post[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="paper post post-state notice-stack">
      <button
        className="notice-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="sticker s-yellow flat">🏛️ OFFICIAL</span>
        <span className="poster" style={{ fontSize: 15 }}>
          {posts.length} notices from the state
        </span>
        <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", marginLeft: "auto" }}>
          {open ? "hide ▲" : "read ▼"}
        </span>
      </button>

      {!open && (
        <ul className="notice-list">
          {posts.slice(0, 3).map((p) => (
            <li key={p.id}>
              <span className="mono">{timeAgo(p.at)}</span> {headline(p)}
            </li>
          ))}
          {posts.length > 3 && <li className="hand">…and {posts.length - 3} more</li>}
        </ul>
      )}

      {open && (
        <div className="notice-full">
          {posts.map((p) => {
            const author = getCitizen(p.author);
            return (
              <article key={p.id}>
                <div className="mono notice-meta">
                  {author?.pfp} {author?.username ?? "the state"} · {timeAgo(p.at)} ago
                </div>
                <p>{p.text}</p>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
