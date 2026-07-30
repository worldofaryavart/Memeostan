"use client";

import { useState } from "react";
import { getCitizen, me } from "@/lib/citizens";
import { act } from "@/lib/actionClient";
import { ledger } from "@/lib/ledger";
import { RATES, vibeOf } from "@/lib/economy";
import { isStateAccount } from "@/lib/systemAccounts";
import type { Citizen, Post } from "@/lib/types";

function timeAgo(at: number): string {
  const s = Math.floor((Date.now() - at) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

function compact(n: number): string {
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

const TIP = RATES.TIP; // MMC sent to an author when you "meme it" — priced server-side

// ~30% of cards tilt so the feed reads as a wall, not a grid.
function tiltOf(id: string): string {
  const code = id.charCodeAt(id.length - 1) % 10;
  if (code < 2) return "tilt-l";
  if (code < 4) return "tilt-r";
  return "";
}

// What kind of post this is — carried by the colour of the card's spine.
//
// This used to be `colorSkinOf(post.id)`: a hash of the post id picked one of six
// neon backgrounds. Colour is the loudest signal in a feed, and it was saying
// nothing — a court verdict and a nap update were as likely to be the same
// colour as different ones. Now the spine is the only coloured thing, it always
// means the same thing, and the card stays ink-on-paper so it can be read.
type PostKind = "you" | "state" | "ai" | "citizen";

function kindOf(post: Post, author: Citizen | null, viewerAddress?: string): PostKind {
  if (viewerAddress && post.author === viewerAddress) return "you";
  if (isStateAccount(post.author)) return "state";
  if (author?.isAI) return "ai";
  return "citizen";
}

const KIND_LABEL: Record<PostKind, { text: string; sticker: string } | null> = {
  you: { text: "YOU", sticker: "s-lime" },
  state: { text: "🏛️ OFFICIAL", sticker: "s-yellow" },
  ai: { text: "🤖 AI", sticker: "s-purple" },
  citizen: null,
};

// Random decorative fasteners/clips/staples/pins holding the posts on the board.
function fastenerOf(id: string): string {
  const code = id.charCodeAt(Math.max(0, id.length - 2)) % 10;
  if (code === 0) return "taped tape-blue";
  if (code === 1) return "taped tape-pink";
  if (code === 2) return "tape t-lime";
  if (code === 3) return "pin";
  if (code === 4) return "pin-center";
  if (code === 5) return "paper-clip";
  if (code === 6) return "binder-clip";
  if (code === 7) return "staple";
  if (code === 8) return "staple-r";
  return "";
}

export default function PostCard({ post, refresh }: { post: Post; refresh: () => void }) {
  const author = getCitizen(post.author);
  const viewer = me();
  const myVote = viewer ? post.voters[viewer.address] : undefined;
  const vibe = vibeOf(post);
  const [tipped, setTipped] = useState(false);

  const kind = kindOf(post, author, viewer?.address);
  const label = KIND_LABEL[kind];

  const cast = (dir: "up" | "down") => {
    if (!viewer) return;
    act("post.vote", { postId: post.id, dir });
    refresh();
  };

  const canTip = !!viewer && viewer.address !== post.author && ledger.balanceOf(viewer.address) >= TIP;
  const tip = () => {
    if (!viewer) return;
    const res = act("post.tip", { postId: post.id });
    if (res.ok) {
      setTipped(true);
      refresh();
    }
  };

  const canBoost = !!viewer && ledger.balanceOf(viewer.address) >= RATES.BOOST_COST;
  const handleBoost = () => {
    if (!viewer) return;
    const res = act("post.boost", { postId: post.id });
    if (res.ok) refresh();
  };

  return (
    <div className={`paper post post-${kind} ${fastenerOf(post.id)} ${tiltOf(post.id)}`}>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ fontSize: 26 }}>{author?.pfp ?? "👽"}</span>
        <span className="poster" style={{ fontSize: 17, flex: 1, minWidth: 0 }}>
          {author?.username ?? "???"}
          {label && (
            <span className={`sticker ${label.sticker} flat`} style={{ marginLeft: 8 }}>
              {label.text}
            </span>
          )}
        </span>
        <span className={`sticker flat ${vibe >= 0 ? "s-lime" : "s-pink"}`}>{vibe >= 0 ? "✨" : "🥴"} {vibe}</span>
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 4 }}>
        {author?.faction} · {timeAgo(post.at)} ago{author?.running ? (author.running === "Candidate" ? " · running for office 🗳️" : ` · ${author.running} 🏛️`) : ""}
      </div>

      {post.text && (
        <p style={{ marginTop: 10, fontSize: 16, fontWeight: 700, lineHeight: 1.4, overflowWrap: "anywhere" }}>{post.text}</p>
      )}
      {post.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={post.image} alt="meme" style={{ marginTop: 10, maxWidth: "100%", borderRadius: 4, border: "var(--b)" }} />
      )}

      <div className="voterow">
        <button className={`btn sm ${myVote === "up" ? "lime" : "ghost"}`} onClick={() => cast("up")}>⬆ {compact(post.up)}</button>
        <button className={`btn sm ${myVote === "down" ? "pink" : "ghost"}`} onClick={() => cast("down")}>⬇ {compact(post.down)}</button>
        {viewer && (
          <button
            className="btn sm ghost"
            onClick={handleBoost}
            disabled={!canBoost}
            style={{ marginLeft: 6 }}
          >
            🔥 {post.boosts ? `${post.boosts} Boost` : "Boost"} (-50)
          </button>
        )}
        {viewer && viewer.address !== post.author && (
          <button className="btn sm purple" onClick={tip} disabled={!canTip || tipped} style={{ marginLeft: "auto" }}>
            {tipped ? `tipped +${TIP} 🪙` : `🪙 Meme it (+${TIP})`}
          </button>
        )}
      </div>

      {post.replies.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: "var(--b-dashed)", display: "flex", flexDirection: "column", gap: 7 }}>
          {post.replies.map((r, i) => {
            const rc = getCitizen(r.author);
            return (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                <span>{rc?.pfp ?? "🤖"}</span>
                <div style={{ fontSize: 14 }}>
                  <b className="marker">{rc?.username ?? "AI"}:</b> {r.text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
