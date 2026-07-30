"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useNation } from "@/components/useNation";
import { me, getCitizen } from "@/lib/citizens";
import { allPosts } from "@/lib/posts";
import { ledger } from "@/lib/ledger";
import { act } from "@/lib/actionClient";
import { shortAddress } from "@/lib/wallet";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import Passport from "@/components/Passport";
import PostCard from "@/components/PostCard";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

export default function CitizenProfilePage() {
  const { refresh } = useNation();
  const params = useParams();
  const address = params.address as string;
  const targetCitizen = getCitizen(address);
  const viewer = me();

  // Send MMC state
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [txError, setTxError] = useState<string | null>(null);
  const [txSuccess, setTxSuccess] = useState<string | null>(null);

  if (!targetCitizen) {
    return (
      <>
        <TopBar refresh={refresh} />
        <div className="shell">
          <div className="paper p-red taped tape-pink" style={{ marginTop: 40, textAlign: "center", padding: 60 }}>
            <h1 className="marker">404: Citizen Lost in the Matrix</h1>
            <p className="hand" style={{ fontSize: 18, marginTop: 12 }}>
              We couldn&apos;t find any citizen with address <code>{address}</code> in the ledger.
            </p>
          </div>
        </div>
        <Ticker />
      </>
    );
  }

  const posts = allPosts().filter((p) => p.author === address);
  const allTxs = ledger.allTxs();
  const citizenTxs = allTxs.filter((t) => t.from === address || t.to === address);

  const handleSendMmc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewer) {
      setTxError("You must log in to send MemeCoin.");
      return;
    }
    const parsedAmount = parseInt(amount, 10);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setTxError("Please enter a valid positive amount.");
      return;
    }
    
    const res = act("mmc.transfer", {
      to: address,
      amount: parsedAmount,
      memo: memo.trim() || `direct transfer to @${targetCitizen.username}`,
    });
    if (res.ok) {
      setAmount("");
      setMemo("");
      setTxError(null);
      setTxSuccess(`Sent ${parsedAmount} MMC to @${targetCitizen.username}! 💸`);
      refresh();
      setTimeout(() => setTxSuccess(null), 4000);
    } else {
      setTxError(res.reason || "Failed to send MMC");
    }
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="citizen" />

        <PageHero
          kicker="national identity database"
          title="CITIZEN PROFILE"
          titleAccent="PROFILE"
          tagline={`exploring @${targetCitizen.username}`}
        />

        <div className="cols">
          {/* LEFT: Passport + Tips Form */}
          <div className="col-stack">
            <Passport citizen={targetCitizen} />

            {/* Send MMC Panel (Only if logged in and not self) */}
            {viewer && viewer.address !== address && (
              <div className="paper p-cyan taped tape-blue">
                <span className="card-title">💸 TRANSFER MEMECOIN</span>
                <p className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>
                  Send MemeCoins directly to @{targetCitizen.username}&apos;s wallet address.
                </p>

                <form onSubmit={handleSendMmc} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", gap: 10 }}>
                    <input
                      type="number"
                      value={amount}
                      min={1}
                      placeholder="Amount (MMC)"
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ flex: 1, padding: 8, fontSize: 14 }}
                      required
                    />
                  </div>
                  <div>
                    <input
                      type="text"
                      value={memo}
                      placeholder="Memo (e.g. support candidate, nice meme)"
                      maxLength={60}
                      onChange={(e) => setMemo(e.target.value)}
                      style={{ width: "100%", padding: 8, fontSize: 14 }}
                    />
                  </div>
                  {txError && (
                    <div className="sticker s-pink" style={{ alignSelf: "flex-start", padding: "4px 8px" }}>
                      ⚠️ {txError}
                    </div>
                  )}
                  {txSuccess && (
                    <div className="sticker s-lime" style={{ alignSelf: "flex-start", padding: "4px 8px" }}>
                      {txSuccess}
                    </div>
                  )}
                  <button type="submit" className="btn lime" style={{ alignSelf: "flex-end" }}>
                    Send Coins 💸
                  </button>
                </form>
              </div>
            )}
            
            {/* Staking / Aura explanation */}
            <div className="paper p-pink pin">
              <span className="card-title" style={{ color: "var(--bc)" }}>Aura Breakdown</span>
              <p className="mono" style={{ fontSize: 12, lineHeight: 1.5, color: "var(--bone-soft)" }}>
                Aura acts as governance voting power. It increases when posts are upvoted and when bills pass. Aura decays slightly if bills fail or posts are ratioed.
              </p>
            </div>
          </div>

          {/* RIGHT: Transaction History + Feed */}
          <div className="col-stack">
            {/* Transaction History Ledger */}
            <div className="paper p-lime staple">
              <span className="card-title">📝 WALLET TRANSACTION LEDGER</span>
              {citizenTxs.length === 0 ? (
                <p className="hand">No transaction records found for this address.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 350, overflowY: "auto", paddingRight: 6 }}>
                  {citizenTxs.map((t) => {
                    const isIncome = t.to === address;
                    const isBurn = t.type === "burn";
                    const formattedDate = new Date(t.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                    return (
                      <div key={t.id} style={{ display: "flex", flexDirection: "column", borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 6 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                            [{formattedDate}] <code>{t.id.slice(0, 10)}</code>
                          </span>
                          <span className="poster" style={{ fontSize: 14, color: isBurn ? "var(--bad)" : isIncome ? "var(--good)" : "var(--bad)" }}>
                            {isBurn ? "🔥" : isIncome ? "+" : "−"}{t.amount} MMC
                          </span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 2 }}>
                          <span className="marker" style={{ fontSize: 12 }}>
                            {t.type.toUpperCase()}: {t.memo || "(No memo)"}
                          </span>
                          <span className="mono" style={{ fontSize: 9, color: "var(--ink-soft)" }}>
                            {t.type === "mint" ? "Treasury" : shortAddress(t.from)} → {t.type === "burn" ? "Sink" : shortAddress(t.to)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Posts feed */}
            <div className="col-stack">
              <div className="section-title">🪧 CITIZEN POSTS ({posts.length})</div>
              {posts.length === 0 ? (
                <div className="paper">
                  <p className="hand">This citizen has not posted to the public square yet.</p>
                </div>
              ) : (
                posts.map((p) => <PostCard key={p.id} post={p} refresh={refresh} />)
              )}
            </div>
          </div>
        </div>
      </div>

      <Ticker />
    </>
  );
}
