"use client";

import { useRef, useState } from "react";
import { createPost } from "@/lib/posts";
import { me } from "@/lib/citizens";
import { onUserPost } from "@/ai/engine";

// THE PUBLIC SQUARE — post to the nation. Posting a banger mints +50 MMC.
export default function Composer({ refresh }: { refresh: () => void }) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const viewer = me();

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImage(reader.result as string);
    reader.readAsDataURL(file);
  };

  const post = () => {
    if (!viewer || (!text.trim() && !image)) return;
    const created = createPost({ author: viewer.address, text: text.trim(), image });
    setText("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
    refresh();
    onUserPost(created.id, refresh);
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
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <label className="btn ghost" style={{ display: "inline-flex", alignItems: "center" }}>
          🖼️ Image
          <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: "none" }} />
        </label>
        <button className="btn lime" onClick={post} disabled={!text.trim() && !image}>
          Shitpost it 🚀
        </button>
      </div>
    </div>
  );
}
