"use client";

import { useState } from "react";
import { FACTIONS, registerCitizen, importWallet } from "@/lib/citizens";

const PFPS = ["🫠", "🗿", "🧽", "🐸", "💀", "👽", "🤡", "😎", "🥶", "🐀"];

// CLAIM YOUR CITIZENSHIP — registers a wallet-shaped citizen + 250 MMC grant.
export default function ClaimBlock({ refresh }: { refresh: () => void }) {
  const [username, setUsername] = useState("");
  const [faction, setFaction] = useState<string>(FACTIONS[0]);
  const [pfp, setPfp] = useState(PFPS[0]);
  const [backupInput, setBackupInput] = useState("");
  const [showImport, setShowImport] = useState(false);

  const submit = () => {
    if (!username.trim()) return;
    registerCitizen({ username: username.trim(), faction, pfp });
    refresh();
  };

  const handleImport = () => {
    if (!backupInput.trim()) return;
    const res = importWallet(backupInput);
    if (res) {
      alert(`Welcome back, ${res.username}! Passport restored.`);
      refresh();
    } else {
      alert("Invalid backup JSON. Please check and try again.");
    }
  };

  return (
    <div className="paper taped tape-pink">
      <span className="card-title">🪪 CLAIM YOUR CITIZENSHIP</span>
      <p className="hand" style={{ fontSize: 17, marginBottom: 12, color: "var(--ink-soft)" }}>
        you&apos;re a citizen in 10 seconds. wallet + passport + <b>250 MMC</b> welcome grant.
      </p>

      {!showImport ? (
        <>
          <label className="hand" style={{ fontSize: 16 }}>your handle</label>
          <input
            value={username}
            maxLength={24}
            placeholder="SigmaScroller420"
            onChange={(e) => setUsername(e.target.value)}
            style={{ marginTop: 4, marginBottom: 10 }}
          />

          <label className="hand" style={{ fontSize: 16 }}>faction (pick your brainrot)</label>
          <select value={faction} onChange={(e) => setFaction(e.target.value)} style={{ marginTop: 4, marginBottom: 10 }}>
            {FACTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>

          <label className="hand" style={{ fontSize: 16 }}>pfp</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 14 }}>
            {PFPS.map((p) => (
              <button
                key={p}
                onClick={() => setPfp(p)}
                style={{
                  fontSize: 20, width: 40, height: 40, borderRadius: 8,
                  background: p === pfp ? "var(--lime)" : "var(--paper-2)",
                  border: "var(--b)",
                  boxShadow: p === pfp ? "var(--hard-sm)" : "none",
                  transform: p === pfp ? "rotate(-6deg)" : "none",
                }}
              >
                {p}
              </button>
            ))}
          </div>

          <button className="btn lime" style={{ width: "100%" }} disabled={!username.trim()} onClick={submit}>
            Issue my passport →
          </button>
          
          <hr className="rule" />
          <button className="btn ghost sm" style={{ width: "100%", marginTop: 4 }} onClick={() => setShowImport(true)}>
            🔑 Import Backup Wallet
          </button>
        </>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="hand" style={{ fontSize: 15 }}>paste your backup string:</label>
          <textarea
            value={backupInput}
            onChange={(e) => setBackupInput(e.target.value)}
            placeholder='{"address": "0x...", "secret": "...", "username": "..."}'
            style={{ fontSize: 12, fontFamily: "var(--mono)", height: 100 }}
          />
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <button className="btn lime sm" style={{ flex: 1 }} onClick={handleImport}>Restore</button>
            <button className="btn ghost sm" onClick={() => setShowImport(false)}>Cancel</button>
          </div>
        </div>
      )}

      <p className="hand" style={{ fontSize: 14, marginTop: 8, color: "var(--ink-soft)" }}>
        reality is optional. wi-fi is a human right.
      </p>
    </div>
  );
}

