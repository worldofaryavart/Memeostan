"use client";

import { useState, useEffect, useCallback } from "react";
import { useNation } from "@/components/useNation";
import { me } from "@/lib/citizens";
import { db } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import {
  grossDomesticBrainrot,
  memeDilution,
  getActiveEvent,
  getRecentEvents,
  isTaxHikeActive,
} from "@/lib/economy";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import Passport from "@/components/Passport";
import type { EconomicEvent } from "@/lib/types";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

interface StoreItem {
  id: string;
  name: string;
  emoji: string;
  type: "badge" | "border";
  price: number;
  description: string;
}

const STORE_ITEMS: StoreItem[] = [
  { id: "badge_certified_rizzler", name: "Certified Rizzler", emoji: "👑", type: "badge", price: 150, description: "Official certification of maximum charismatic output." },
  { id: "badge_sigma_chad", name: "Sigma Chad", emoji: "🗿", type: "badge", price: 200, description: "For the silent, brooding, absolute vibe lords." },
  { id: "badge_brainrot_veteran", name: "Brainrot Veteran", emoji: "👽", type: "badge", price: 100, description: "Survived 24 hours of infinite vertical video feeds." },
  { id: "badge_chief_vibes_officer", name: "Chief Vibes Officer", emoji: "🏛️", type: "badge", price: 500, description: "Ultimate legislative authority badge. Flex on common citizens." },
  { id: "border_neon_rainbow", name: "Neon Pulse Border", emoji: "🌈", type: "border", price: 250, description: "A high-frequency color shifting neon glow around your avatar." },
  { id: "border_gold_foil", name: "Royal Gold Frame", emoji: "✨", type: "border", price: 300, description: "Solid 24k gold leaf frame with luxurious drop shadow." },
  { id: "border_retro_cyber", name: "Retro Scanline Frame", emoji: "👾", type: "border", price: 120, description: "8-bit classic green scanline grid frame for retro aesthetics." },
];

const EVENT_COLORS: Record<string, string> = {
  crash:     "p-red",
  boom:      "p-lime",
  inflation: "p-orange",
  tax_hike:  "p-yellow",
  airdrop:   "p-cyan",
};

const EVENT_EMOJI: Record<string, string> = {
  crash:     "💥",
  boom:      "🚀",
  inflation: "📈",
  tax_hike:  "🏦",
  airdrop:   "🪂",
};

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

export default function MarketPage() {
  const { refresh } = useNation();
  const citizen = me();

  const [shopError, setShopError] = useState<string | null>(null);
  const [gdb, setGdb] = useState(0);
  const [dilution, setDilution] = useState(0);
  const [supply, setSupply] = useState(0);
  const [activeEvent, setActiveEvent] = useState<EconomicEvent | null>(null);
  const [recentEvents, setRecentEvents] = useState<EconomicEvent[]>([]);
  const [taxHike, setTaxHike] = useState(false);

  const refreshEconomy = useCallback(() => {
    setGdb(grossDomesticBrainrot());
    setDilution(memeDilution());
    setSupply(ledger.circulatingSupply());
    setActiveEvent(getActiveEvent());
    setRecentEvents(getRecentEvents(6));
    setTaxHike(isTaxHikeActive());
  }, []);

  useEffect(() => {
    refreshEconomy();
    const id = setInterval(refreshEconomy, 6000);
    return () => clearInterval(id);
  }, [refreshEconomy]);

  const getOwnedItems = () => {
    if (!citizen) return [];
    const state = db.get();
    return state.purchasedCosmetics?.[citizen.address] || [];
  };

  const handleBuyItem = (item: StoreItem) => {
    if (!citizen) { setShopError("You need a passport first!"); return; }
    const balance = ledger.balanceOf(citizen.address);
    if (balance < item.price) {
      setShopError(`Insufficient balance! This item costs ${item.price} MMC, but you only have ${balance} MMC.`);
      return;
    }
    const owned = getOwnedItems();
    if (owned.includes(item.id)) { setShopError("You already own this item!"); return; }
    ledger.burn(citizen.address, item.price, `purchased cosmetic item: ${item.name}`);
    db.update((s) => {
      if (!s.purchasedCosmetics) s.purchasedCosmetics = {};
      if (!s.purchasedCosmetics[citizen.address]) s.purchasedCosmetics[citizen.address] = [];
      s.purchasedCosmetics[citizen.address].push(item.id);
    });
    setShopError(null);
    refresh();
    refreshEconomy();
  };

  const handleEquipItem = (itemId: string, type: "badge" | "border", isEquipped: boolean) => {
    if (!citizen) return;
    db.update((s) => {
      const cit = s.citizens[citizen.address];
      if (!cit) return;
      if (type === "badge") cit.equippedBadge = isEquipped ? undefined : itemId;
      else cit.equippedBorder = isEquipped ? undefined : itemId;
    });
    refresh();
  };

  const owned = getOwnedItems();
  const balance = citizen ? ledger.balanceOf(citizen.address) : 0;

  // GDB color thresholds
  const gdbColor = gdb >= 5000 ? "var(--lime)" : gdb >= 2000 ? "var(--yellow)" : "var(--red)";
  const dilutionColor = dilution <= 20 ? "var(--lime)" : dilution <= 50 ? "var(--yellow)" : "var(--red)";
  const dilutionLabel = dilution <= 20 ? "STABLE" : dilution <= 50 ? "ELEVATED" : "CRITICAL";

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="market" />

        <PageHero
          kicker="the bazaar of high status"
          title="THE MARKET"
          titleAccent="MARKET"
          tagline="burn MMC on status. flex on common citizens."
        />

        {/* ── ECONOMIC DASHBOARD ────────────────────────────────────────── */}
        <div className="paper p-purple binder-clip" style={{ marginBottom: 32 }}>
          <span className="card-title">📊 NATIONAL ECONOMIC DASHBOARD</span>
          {taxHike && (
            <div className="sticker s-yellow" style={{ display: "block", marginBottom: 12, fontSize: 13 }}>
              🏦 EMERGENCY TAX HIKE ACTIVE — Transfer fee is now 3 MMC
            </div>
          )}

          {/* Active Event Banner */}
          {activeEvent && (
            <div
              className={`paper ${EVENT_COLORS[activeEvent.type] ?? "p-white"} pin`}
              style={{ marginBottom: 20, padding: "14px 18px" }}
            >
              <div className="marker" style={{ fontSize: 15, marginBottom: 4 }}>
                {EVENT_EMOJI[activeEvent.type]} {activeEvent.title}
                <span className="sticker flat s-purple" style={{ fontSize: 10, marginLeft: 8 }}>LIVE</span>
              </div>
              <div className="hand" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
                {activeEvent.description}
              </div>
            </div>
          )}

          {/* Gauges Row */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>

            {/* GDB Gauge */}
            <div className="paper p-white staple" style={{ textAlign: "center", padding: "16px 12px" }}>
              <div className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>GROSS DOMESTIC BRAINROT</div>
              <div className="marker" style={{ fontSize: 28, color: gdbColor, lineHeight: 1.1 }}>
                {gdb.toLocaleString()}
              </div>
              <div className="hand" style={{ fontSize: 11, color: gdbColor, marginTop: 4 }}>
                {gdb >= 5000 ? "🚀 BOOMING" : gdb >= 2000 ? "📊 STABLE" : "📉 RECESSION"}
              </div>
            </div>

            {/* Dilution Gauge */}
            <div className="paper p-white pin-center" style={{ padding: "16px 12px" }}>
              <div className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 8 }}>MEME DILUTION (INFLATION)</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div
                  style={{
                    flex: 1,
                    height: 10,
                    background: "var(--paper-border)",
                    borderRadius: 4,
                    border: "2px solid var(--ink)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(dilution, 100)}%`,
                      height: "100%",
                      background: dilutionColor,
                      transition: "width 0.8s ease",
                    }}
                  />
                </div>
                <span className="marker" style={{ fontSize: 14, color: dilutionColor, minWidth: 44 }}>
                  {dilution.toFixed(1)}%
                </span>
              </div>
              <div className="sticker flat" style={{ background: dilutionColor, color: "var(--ink)", fontSize: 10, display: "inline-block" }}>
                {dilutionLabel}
              </div>
            </div>

            {/* Circulating Supply */}
            <div className="paper p-white staple-r" style={{ textAlign: "center", padding: "16px 12px" }}>
              <div className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", marginBottom: 4 }}>CIRCULATING SUPPLY</div>
              <div className="marker" style={{ fontSize: 26, color: "var(--cyan)", lineHeight: 1.1 }}>
                🪙 {supply.toLocaleString()}
              </div>
              <div className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>MMC in circulation</div>
            </div>
          </div>

          {/* Recent Events Log */}
          {recentEvents.length > 0 && (
            <div>
              <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8, fontWeight: 700 }}>
                📋 RECENT EVENTS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recentEvents.map((ev) => (
                  <div
                    key={ev.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      borderBottom: "1px dashed var(--ink-soft)",
                      paddingBottom: 6,
                    }}
                  >
                    <span style={{ fontSize: 18, lineHeight: 1 }}>{EVENT_EMOJI[ev.type] ?? "⚡"}</span>
                    <div style={{ flex: 1 }}>
                      <span className="marker" style={{ fontSize: 12 }}>{ev.title}</span>
                    </div>
                    <span className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>
                      {timeAgo(ev.at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {recentEvents.length === 0 && (
            <div className="hand" style={{ fontSize: 13, color: "var(--ink-soft)" }}>
              No economic events yet. The economy is calm… for now. 🪙
            </div>
          )}
        </div>

        {/* ── STORE + WARDROBE ───────────────────────────────────────────── */}
        <div className="cols">
          {/* LEFT: Store Catalog */}
          <div className="col-stack">
            <div className="paper p-lime binder-clip">
              <span className="card-title">🛍️ STORE CATALOG</span>
              {shopError && (
                <div className="sticker s-pink" style={{ marginBottom: 14, display: "block" }}>
                  ⚠️ {shopError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 10 }}>
                {STORE_ITEMS.map((item, idx) => {
                  const isOwned = owned.includes(item.id);
                  const canAfford = balance >= item.price;
                  const itemColors = ["p-white", "p-cyan", "p-yellow", "p-pink", "p-orange", "p-purple"];
                  const itemFasteners = ["staple-r", "pin", "paper-clip", "staple", "taped tape-pink", "pin-center"];
                  const itemColor = itemColors[idx % itemColors.length];
                  const itemFastener = itemFasteners[idx % itemFasteners.length];

                  return (
                    <div
                      key={item.id}
                      className={`paper ${itemColor} ${itemFastener}`}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: 12,
                        flexWrap: "wrap",
                        padding: "16px 20px",
                      }}
                    >
                      <div style={{ display: "flex", gap: 12, alignItems: "center", flex: 1, minWidth: 200 }}>
                        <span style={{ fontSize: 36 }}>{item.emoji}</span>
                        <div>
                          <h3 className="marker" style={{ fontSize: 16, margin: 0, color: "var(--purple-deep)" }}>
                            {item.name} <span className="sticker flat s-purple" style={{ fontSize: 10 }}>{item.type.toUpperCase()}</span>
                          </h3>
                          <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 0 0" }}>
                            {item.description}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {isOwned ? (
                          <span className="sticker s-lime">OWNED</span>
                        ) : (
                          <>
                            <span className="sticker s-purple">🪙 {item.price} MMC</span>
                            <button
                              className="btn sm lime"
                              disabled={!citizen || !canAfford}
                              onClick={() => handleBuyItem(item)}
                            >
                              Buy
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* RIGHT: Wardrobe & Preview */}
          <aside className="col-stack">
            {citizen ? (
              <>
                {/* Live Preview */}
                <div className="section-title">🛂 Passport Preview</div>
                <Passport citizen={citizen} />

                {/* Wardrobe */}
                <div className="paper p-purple taped tape-pink">
                  <span className="card-title">🎒 MY WARDROBE</span>
                  <div className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>
                    Equip badges and borders you have unlocked.
                  </div>

                  {owned.length === 0 ? (
                    <p className="hand">You do not own any cosmetics yet. Grab some in the store!</p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      {STORE_ITEMS.filter((item) => owned.includes(item.id)).map((item) => {
                        const isEquipped = item.type === "badge"
                          ? citizen.equippedBadge === item.id
                          : citizen.equippedBorder === item.id;

                        return (
                          <div
                            key={item.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              borderBottom: "1px dashed var(--ink-soft)",
                              paddingBottom: 8,
                            }}
                          >
                            <span className="marker" style={{ fontSize: 14 }}>
                              {item.emoji} {item.name}
                            </span>
                            <button
                              className={`btn sm ${isEquipped ? "red" : "lime ghost"}`}
                              style={{ padding: "4px 10px", fontSize: 11 }}
                              onClick={() => handleEquipItem(item.id, item.type, isEquipped)}
                            >
                              {isEquipped ? "Unequip" : "Equip"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="paper p-red taped tape-pink">
                <span className="card-title">🛂 ACCESS DENIED</span>
                <p className="hand">Create a passport in the Public Square page to purchase and equip cosmetics.</p>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Ticker />
    </>
  );
}
