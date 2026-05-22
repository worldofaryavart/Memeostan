"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import { me, allCitizens } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import { allPosts } from "@/lib/posts";
import { vibeOf } from "@/lib/economy";
import { shortAddress } from "@/lib/wallet";

// MY CITIZEN — your post stats + your own MemeCoin tx history (from the ledger).
export default function MyCitizen() {
  const citizen = me();
  
  const [showSend, setShowSend] = useState(false);
  const [toAddress, setToAddress] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [memo, setMemo] = useState("");
  const [error, setError] = useState("");

  if (!citizen) return null;

  const mine = allPosts().filter((p) => p.author === citizen.address);
  const totalVibe = mine.reduce((n, p) => n + vibeOf(p), 0);
  const myTxs = db
    .get()
    .txs.filter((t) => t.from === citizen.address || t.to === citizen.address)
    .slice(0, 6);

  const citizens = allCitizens().filter((c) => c.address !== citizen.address);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const amount = parseInt(amountStr);
    if (isNaN(amount) || amount <= 0) {
      setError("Enter a valid positive amount.");
      return;
    }
    if (!toAddress) {
      setError("Please select a recipient.");
      return;
    }
    const res = ledger.transfer(citizen.address, toAddress, amount, memo || "tip/transfer");
    if (res.ok) {
      setToAddress("");
      setAmountStr("");
      setMemo("");
      setShowSend(false);
      window.location.reload();
    } else {
      setError(res.reason || "Transfer failed.");
    }
  };

  return (
    <div className="paper p-orange taped tape-pink">
      <span className="card-title">🧍 MY CITIZEN</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <span className="sticker s-lime">📝 {mine.length} posts</span>
        <span className={`sticker ${totalVibe >= 0 ? "s-blue" : "s-pink"}`}>✨ {totalVibe} vibe</span>
        <span className="sticker s-yellow">🪙 {ledger.balanceOf(citizen.address).toLocaleString()}</span>
        <span className="sticker">⭐ {citizen.aura.toLocaleString()} aura</span>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button className="btn sm ghost" onClick={() => setShowSend(!showSend)} style={{ width: "100%" }}>
          💸 Send MemeCoin (MMC)
        </button>
      </div>

      {showSend && (
        <form onSubmit={handleSend} className="paper" style={{ padding: 10, background: "var(--paper-2)", marginBottom: 14, borderStyle: "dashed" }}>
          <span className="card-title" style={{ fontSize: 13, color: "var(--purple)" }}>💸 SEND MEMECOIN</span>
          {error && <p style={{ color: "var(--bad)", fontSize: 13, margin: "0 0 8px 0" }}>⚠️ {error}</p>}
          
          <label className="hand" style={{ fontSize: 13, display: "block" }}>recipient</label>
          <select
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            style={{ width: "100%", padding: "4px 8px", marginTop: 2, marginBottom: 8, fontSize: 13, border: "var(--b)", background: "var(--paper)" }}
          >
            <option value="">-- select recipient --</option>
            {citizens.map((c) => (
              <option key={c.address} value={c.address}>
                {c.pfp} {c.username} ({shortAddress(c.address)})
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label className="hand" style={{ fontSize: 13 }}>amount</label>
              <input
                type="number"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                placeholder="50"
                style={{ width: "100%", padding: "4px 8px", marginTop: 2, marginBottom: 8, fontSize: 13, border: "var(--b)" }}
              />
            </div>
            <div style={{ flex: 2 }}>
              <label className="hand" style={{ fontSize: 13 }}>memo</label>
              <input
                type="text"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="for the good vibes"
                style={{ width: "100%", padding: "4px 8px", marginTop: 2, marginBottom: 8, fontSize: 13, border: "var(--b)" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button type="submit" className="btn lime sm" style={{ flex: 1 }}>Send</button>
            <button type="button" className="btn ghost sm" onClick={() => setShowSend(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div className="hand" style={{ fontSize: 16, marginBottom: 6, color: "var(--ink-soft)" }}>my money moves</div>
      {myTxs.length === 0 && <p className="hand" style={{ fontSize: 15 }}>no moves yet. earn some MMC 🤑</p>}
      {myTxs.map((t) => {
        const incoming = t.to === citizen.address;
        return (
          <div key={t.id} className="txrow">
            <span>{t.type === "mint" ? "🟢 earned" : t.type === "burn" ? "🔴 burned" : incoming ? "📥 got" : "📤 sent"} · {t.memo.slice(0, 20) || shortAddress(incoming ? t.from : t.to)}</span>
            <span style={{ color: incoming ? "var(--good)" : "var(--bad)", fontWeight: 700 }}>{incoming ? "+" : "−"}{t.amount}</span>
          </div>
        );
      })}
    </div>
  );
}
