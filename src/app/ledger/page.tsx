"use client";

import { useState } from "react";
import { useNation } from "@/components/useNation";
import { ledger } from "@/lib/ledger";
import { getCitizen } from "@/lib/citizens";
import { shortAddress } from "@/lib/wallet";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import Link from "next/link";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

export default function LedgerExplorerPage() {
  const { refresh } = useNation();
  const txs = ledger.allTxs();

  // Search & filter states
  const [searchId, setSearchId] = useState("");
  const [searchAddress, setSearchAddress] = useState("");
  const [filterType, setFilterType] = useState<"all" | "mint" | "burn" | "transfer">("all");

  const filteredTxs = txs.filter((tx) => {
    // 1. Transaction ID Filter
    if (searchId.trim() && !tx.id.toLowerCase().includes(searchId.toLowerCase())) {
      return false;
    }
    // 2. Type Filter
    if (filterType !== "all" && tx.type !== filterType) {
      return false;
    }
    // 3. Address Filter
    if (searchAddress.trim()) {
      const addr = searchAddress.trim().toLowerCase();
      if (!tx.from.toLowerCase().includes(addr) && !tx.to.toLowerCase().includes(addr)) {
        return false;
      }
    }
    return true;
  });

  const renderAddressLink = (addr: string) => {
    const isTreasury = addr === ledger.TREASURY;
    if (isTreasury) {
      return <span style={{ color: "var(--ink-soft)" }}>Treasury 🏦</span>;
    }
    const citizen = getCitizen(addr);
    const label = citizen ? `@${citizen.username}` : shortAddress(addr);
    return (
      <Link href={`/citizen/${addr}`} className="mono" style={{ color: "var(--purple)", fontWeight: 700 }}>
        {label}
      </Link>
    );
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="ledger" />

        <PageHero
          kicker="national financial auditing ledger"
          title="THE LEDGER"
          titleAccent="LEDGER"
          tagline="every coin, minted & burned, on the record."
        />

        <div className="cols" style={{ gridTemplateColumns: "1fr" }}>
          <div className="col-stack">
            {/* Filter Panel */}
            <div className="paper p-cyan taped tape-blue">
              <span className="card-title">🔍 AUDIT &amp; SEARCH FILTERS</span>
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  flexWrap: "wrap",
                  marginTop: 10,
                  alignItems: "center",
                }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 4, color: "var(--ink-soft)" }}>
                    TRANSACTION ID
                  </label>
                  <input
                    type="text"
                    value={searchId}
                    placeholder="Search by ID (e.g. tx_a9f...)"
                    onChange={(e) => setSearchId(e.target.value)}
                    style={{ width: "100%", padding: 8, fontSize: 13 }}
                  />
                </div>

                <div style={{ flex: 1, minWidth: 200 }}>
                  <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 4, color: "var(--ink-soft)" }}>
                    INVOLVED WALLET / USERNAME
                  </label>
                  <input
                    type="text"
                    value={searchAddress}
                    placeholder="Search address or faction wallet..."
                    onChange={(e) => setSearchAddress(e.target.value)}
                    style={{ width: "100%", padding: 8, fontSize: 13 }}
                  />
                </div>

                <div style={{ minWidth: 150 }}>
                  <label className="mono" style={{ fontSize: 10, display: "block", marginBottom: 4, color: "var(--ink-soft)" }}>
                    TRANSACTION TYPE
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: 8,
                      fontSize: 13,
                      border: "2.5px solid var(--bc)",
                      borderRadius: 4,
                      background: "var(--bone)",
                      color: "var(--ink)",
                      fontWeight: 700,
                    }}
                  >
                    <option value="all">🔄 ALL TYPES</option>
                    <option value="mint">🟢 MINTS</option>
                    <option value="burn">🔴 BURNS</option>
                    <option value="transfer">🔁 TRANSFERS</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Ledger Transactions list */}
            <div className="paper p-yellow binder-clip">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 10 }}>
                <span className="card-title">📖 TRANSACTION LEDGER JOURNAL</span>
                <span className="sticker s-purple">
                  Showing {filteredTxs.length} of {txs.length} transactions
                </span>
              </div>

              {filteredTxs.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center" }}>
                  <p className="hand" style={{ fontSize: 18 }}>No transactions match your current search parameters. 🕵️</p>
                </div>
              ) : (
                <div style={{ overflowX: "auto", marginTop: 12 }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      textAlign: "left",
                    }}
                  >
                    <thead>
                      <tr
                        className="mono"
                        style={{
                          borderBottom: "2.5px solid var(--bc)",
                          fontSize: 11,
                          color: "var(--ink-soft)",
                        }}
                      >
                        <th style={{ padding: "8px 12px" }}>TX HASH</th>
                        <th style={{ padding: "8px 12px" }}>TYPE</th>
                        <th style={{ padding: "8px 12px" }}>FROM (SENDER)</th>
                        <th style={{ padding: "8px 12px" }}>TO (RECEIVER)</th>
                        <th style={{ padding: "8px 12px" }}>AMOUNT</th>
                        <th style={{ padding: "8px 12px" }}>MEMO / AUDIT REASON</th>
                        <th style={{ padding: "8px 12px" }}>TIMESTAMP</th>
                      </tr>
                    </thead>
                    <tbody className="mono" style={{ fontSize: 12, color: "var(--ink)" }}>
                      {filteredTxs.map((tx) => {
                        const isMint = tx.type === "mint";
                        const isBurn = tx.type === "burn";
                        const typeStickerClass = isMint ? "s-lime" : isBurn ? "s-pink" : "s-purple";
                        const amountColor = isBurn ? "var(--bad)" : isMint ? "var(--good)" : "var(--ink)";
                        const readableTime = new Date(tx.at).toLocaleString([], {
                          month: "short",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        });

                        return (
                          <tr
                            key={tx.id}
                            style={{
                              borderBottom: "1px dashed var(--ink-soft)",
                              background: "rgba(0, 0, 0, 0.01)",
                            }}
                          >
                            <td style={{ padding: "10px 12px" }}>
                              <code>{tx.id.slice(0, 12)}...</code>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span className={`sticker flat ${typeStickerClass}`} style={{ fontSize: 9, padding: "2px 6px" }}>
                                {tx.type.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {renderAddressLink(tx.from)}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              {renderAddressLink(tx.to)}
                            </td>
                            <td style={{ padding: "10px 12px", color: amountColor, fontWeight: 800 }}>
                              {isBurn ? "−" : "+"}{tx.amount.toLocaleString()}
                            </td>
                            <td style={{ padding: "10px 12px", fontStyle: "italic", fontSize: 11 }}>
                              {tx.memo || "(No memo)"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--ink-soft)" }}>
                              {readableTime}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Ticker />
    </>
  );
}
