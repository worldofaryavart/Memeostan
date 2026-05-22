"use client";

import { useState } from "react";
import { useNation } from "@/components/useNation";
import { me } from "@/lib/citizens";
import { db } from "@/lib/db";
import { ledger } from "@/lib/ledger";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import Passport from "@/components/Passport";

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

export default function MarketPage() {
  const { refresh } = useNation();
  const citizen = me();

  const [shopError, setShopError] = useState<string | null>(null);

  const getOwnedItems = () => {
    if (!citizen) return [];
    const state = db.get();
    return state.purchasedCosmetics?.[citizen.address] || [];
  };

  const handleBuyItem = (item: StoreItem) => {
    if (!citizen) {
      setShopError("You need a passport first!");
      return;
    }
    const balance = ledger.balanceOf(citizen.address);
    if (balance < item.price) {
      setShopError(`Insufficient balance! This item costs ${item.price} MMC, but you only have ${balance} MMC.`);
      return;
    }

    const owned = getOwnedItems();
    if (owned.includes(item.id)) {
      setShopError("You already own this item!");
      return;
    }

    // Process payment
    ledger.burn(citizen.address, item.price, `purchased cosmetic item: ${item.name}`);

    // Add to owned list
    db.update((s) => {
      if (!s.purchasedCosmetics) s.purchasedCosmetics = {};
      if (!s.purchasedCosmetics[citizen.address]) s.purchasedCosmetics[citizen.address] = [];
      s.purchasedCosmetics[citizen.address].push(item.id);
    });

    setShopError(null);
    refresh();
  };

  const handleEquipItem = (itemId: string, type: "badge" | "border", isEquipped: boolean) => {
    if (!citizen) return;

    db.update((s) => {
      const cit = s.citizens[citizen.address];
      if (!cit) return;

      if (type === "badge") {
        cit.equippedBadge = isEquipped ? undefined : itemId;
      } else {
        cit.equippedBorder = isEquipped ? undefined : itemId;
      }
    });

    refresh();
  };

  const owned = getOwnedItems();
  const balance = citizen ? ledger.balanceOf(citizen.address) : 0;

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell">
        <section className="hero">
          <span className="kicker">the bazaar of high status</span>
          <h1>National Cosmetics Store</h1>
          <div className="sub">Burn your hard-earned MemeCoins on status badges and vanity borders.</div>
        </section>

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
