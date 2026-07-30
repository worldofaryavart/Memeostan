// market.ts — the cosmetics store.
//
// The catalog lives here rather than in the page component because the price has
// to be server-authoritative: an action says *which* item you want, never what it
// costs. Previously the browser burned the amount it felt like burning.

import { db } from "./db";
import { ledger } from "./ledger";

export interface StoreItem {
  id: string;
  name: string;
  emoji: string;
  type: "badge" | "border";
  price: number;
  description: string;
}

export const STORE_ITEMS: StoreItem[] = [
  { id: "badge_certified_rizzler", name: "Certified Rizzler", emoji: "👑", type: "badge", price: 150, description: "Official certification of maximum charismatic output." },
  { id: "badge_sigma_chad", name: "Sigma Chad", emoji: "🗿", type: "badge", price: 200, description: "For the silent, brooding, absolute vibe lords." },
  { id: "badge_brainrot_veteran", name: "Brainrot Veteran", emoji: "👽", type: "badge", price: 100, description: "Survived 24 hours of infinite vertical video feeds." },
  { id: "badge_chief_vibes_officer", name: "Chief Vibes Officer", emoji: "🏛️", type: "badge", price: 500, description: "Ultimate legislative authority badge. Flex on common citizens." },
  { id: "border_neon_rainbow", name: "Neon Pulse Border", emoji: "🌈", type: "border", price: 250, description: "A high-frequency color shifting neon glow around your avatar." },
  { id: "border_gold_foil", name: "Royal Gold Frame", emoji: "✨", type: "border", price: 300, description: "Solid 24k gold leaf frame with luxurious drop shadow." },
  { id: "border_retro_cyber", name: "Retro Scanline Frame", emoji: "👾", type: "border", price: 120, description: "8-bit classic green scanline grid frame for retro aesthetics." },
];

export function getStoreItem(id: string): StoreItem | null {
  return STORE_ITEMS.find((i) => i.id === id) || null;
}

export function ownedCosmetics(address: string): string[] {
  return db.get().purchasedCosmetics?.[address] || [];
}

export function buyCosmetic(address: string, itemId: string): { ok: boolean; reason?: string } {
  const item = getStoreItem(itemId);
  if (!item) return { ok: false, reason: "No such item in the store." };

  if (ownedCosmetics(address).includes(itemId)) {
    return { ok: false, reason: "You already own this item!" };
  }

  const balance = ledger.balanceOf(address);
  if (balance < item.price) {
    return {
      ok: false,
      reason: `Insufficient balance! This item costs ${item.price} MMC, but you only have ${balance} MMC.`,
    };
  }

  ledger.burn(address, item.price, `purchased cosmetic item: ${item.name}`);
  db.update((s) => {
    if (!s.purchasedCosmetics) s.purchasedCosmetics = {};
    if (!s.purchasedCosmetics[address]) s.purchasedCosmetics[address] = [];
    if (!s.purchasedCosmetics[address].includes(itemId)) {
      s.purchasedCosmetics[address].push(itemId);
    }
  });

  return { ok: true };
}

export function equipCosmetic(
  address: string,
  itemId: string,
  equip: boolean
): { ok: boolean; reason?: string } {
  const item = getStoreItem(itemId);
  if (!item) return { ok: false, reason: "No such item in the store." };
  if (equip && !ownedCosmetics(address).includes(itemId)) {
    return { ok: false, reason: "You don't own that item." };
  }

  db.update((s) => {
    const citizen = s.citizens[address];
    if (!citizen) return;
    if (item.type === "badge") citizen.equippedBadge = equip ? itemId : undefined;
    else citizen.equippedBorder = equip ? itemId : undefined;
  });

  return { ok: true };
}
