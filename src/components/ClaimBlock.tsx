"use client";

import { useState } from "react";
import { FACTIONS, importWallet } from "@/lib/citizens";
import { claimCitizenship } from "@/lib/actionClient";

const PFPS = ["🫠", "🗿", "🧽", "🐸", "💀", "👽", "🤡", "😎", "🥶", "🐀"];

// CLAIM YOUR CITIZENSHIP — registers a wallet-shaped citizen + 250 MMC grant.
export default function ClaimBlock({ refresh }: { refresh: () => void }) {
  const [username, setUsername] = useState("");
  const [faction, setFaction] = useState<string>(FACTIONS[0]);
  const [pfp, setPfp] = useState(PFPS[0]);
  const [city, setCity] = useState("Brainrot City");
  const [party, setParty] = useState("Global Brainrot Party");
  const [backupInput, setBackupInput] = useState("");
  const [showImport, setShowImport] = useState(false);
  const [claiming, setClaiming] = useState(false);

  // Claiming mints a real keypair in this browser and files the passport against
  // the address derived from it, so it has to wait for the nation to confirm.
  const submit = async () => {
    if (!username.trim() || claiming) return;
    setClaiming(true);
    try {
      const res = await claimCitizenship({ username: username.trim(), faction, pfp, city, party });
      if (!res.ok) alert(res.reason || "The passport office rejected that. Try again?");
      refresh();
    } finally {
      setClaiming(false);
    }
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
          <select value={faction} onChange={(e) => setFaction(e.target.value)} style={{ marginTop: 4, marginBottom: 10, width: "100%", padding: "4px 8px", fontSize: 13, border: "var(--b)", background: "var(--paper)", color: "var(--ink)", fontWeight: 700, borderRadius: "6px" }}>
            {FACTIONS.map((f) => (<option key={f} value={f}>{f}</option>))}
          </select>

          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <div style={{ flex: 1 }}>
              <label className="hand" style={{ fontSize: 15 }}>city</label>
              <select
                value={city}
                onChange={(e) => setCity(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "4px 8px",
                  fontSize: 13,
                  border: "var(--b)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  fontWeight: 700,
                  borderRadius: "6px"
                }}
              >
                <option value="Brainrot City">🧠 Brainrot City</option>
                <option value="Neo Ohio">🗿 Neo Ohio</option>
                <option value="Rizzland">👑 Rizzland</option>
                <option value="Napistan">😴 Napistan</option>
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label className="hand" style={{ fontSize: 15 }}>party</label>
              <select
                value={party}
                onChange={(e) => setParty(e.target.value)}
                style={{
                  width: "100%",
                  marginTop: 4,
                  padding: "4px 8px",
                  fontSize: 13,
                  border: "var(--b)",
                  background: "var(--paper)",
                  color: "var(--ink)",
                  fontWeight: 700,
                  borderRadius: "6px"
                }}
              >
                <option value="Global Brainrot Party">🟢 Global Brainrot Party</option>
                <option value="United Rizz Federation">💗 United Rizz Federation</option>
                <option value="Skibidi Doo Party">💎 Skibidi Doo Party</option>
              </select>
            </div>
          </div>

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

          <button
            className="btn lime"
            style={{ width: "100%" }}
            disabled={!username.trim() || claiming}
            onClick={submit}
          >
            {claiming ? "minting your key…" : "Issue my passport →"}
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

