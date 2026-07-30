"use client";

import { useRef, useState } from "react";
import { me } from "@/lib/citizens";
import { act, newActionId } from "@/lib/actionClient";
import { onUserPost } from "@/ai/engine";

const MAX = 280;

// THE PUBLIC SQUARE — post to the nation. Posting a banger mints +50 MMC.
export default function Composer({ refresh }: { refresh: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewer = me();

  const remaining = MAX - text.length;
  const canPost = !!viewer && (!!text.trim() || !!image);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const post = () => {
    if (!canPost || !viewer) return;

    // The id is minted here so the optimistic post and the one the server commits
    // are the same row.
    const id = newActionId("post");
    const res = act("post.create", { id, text: text.trim(), image });
    if (!res.ok) {
      setFlash(`🚫 ${res.reason}`);
      setTimeout(() => setFlash(null), 4000);
      return;
    }

    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
    setFlash("🚀 posted to the square! bangers mint +50 MMC");
    setTimeout(() => setFlash(null), 3000);
    refresh();
    onUserPost(id, refresh);
  };

  return (
    <div className="paper taped">
      <span className="card-title">🪧 THE PUBLIC SQUARE</span>
      <textarea
        rows={2}
        value={text}
        maxLength={280}
        placeholder="post to the public square… (+50 MMC for a banger)"
        onChange={(e) => setText(e.target.value)}
        style={{ resize: "vertical" }}
      />
      {image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={image}
          alt="preview"
          style={{ marginTop: 8, maxHeight: 180, borderRadius: 4, border: "var(--b)" }}
        />
      )}
      {flash && (
        <div className="sticker s-lime" style={{ display: "block", marginTop: 10, fontSize: 13 }}>
          {flash}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <label className="btn ghost" style={{ display: "inline-flex", alignItems: "center" }}>
          🖼️ Image
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="mono"
            style={{ fontSize: 11, color: remaining <= 20 ? "var(--bad)" : "var(--ink-soft)" }}
          >
            {remaining}
          </span>
          <button className="btn lime" onClick={post} disabled={!canPost}>
            {viewer ? "Shitpost it 🚀" : "Claim a passport first 🛂"}
          </button>
        </div>
      </div>
    </div>
  );
}
