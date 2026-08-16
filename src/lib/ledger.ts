// ledger.ts — the MemeCoin (MMC) economy. NOT a +1/-1 score.
//
// Real token mechanics on a tiny append-only ledger:
//   mint(to)      -> nation prints brainrot into a wallet (earning)
//   burn(from)    -> tokens destroyed (spam tax / sinks => "meme dilution")
//   transfer(a,b) -> citizen-to-citizen payment (tips, campaign funding)
// Every movement writes a tx, so the ledger is auditable and chain-shaped.
// City rules can apply extra transfer fees on outgoing transfers.

import { db } from "./db";
import { isStateAccount } from "./systemAccounts";
import type { NationState, TxType } from "./types";

const TREASURY = "0xtreasury000000000000000000000000treasur"; // nation's mint/burn sink

function balanceOf(state: NationState, address: string): number {
  return state.balances[address] || 0;
}

function hash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16);
}

function record(
  state: NationState,
  type: TxType,
  from: string,
  to: string,
  amount: number,
  memo: string
): void {
  const prevTx = state.txs[0];
  const prevHash = prevTx ? prevTx.id : "genesis";
  const rawId = `${prevHash}-${type}-${from}-${to}-${amount}-${Date.now()}-${Math.random()}`;
  const txId = "tx_" + hash(rawId);

  state.txs.unshift({
    id: txId,
    type,
    from,
    to,
    amount: Math.round(amount),
    memo: memo || "",
    at: Date.now(),
  });
  if (state.txs.length > 500) state.txs.length = 500;
}

export const ledger = {
  TREASURY,

  balanceOf(address: string): number {
    return balanceOf(db.get(), address);
  },

  // Total MMC in circulation — what citizens actually hold.
  //
  // Every state account is excluded, not just the treasury. The courts and the
  // commission are endowed so they can pay fines and grants, and counting those
  // floats as circulating put supply over 150k on an empty country: the rate
  // tuner read it as an overheating economy and throttled post rewards to the
  // floor before a single citizen existed. Money sitting in a ministry is not
  // chasing memes.
  circulatingSupply(): number {
    const state = db.get();
    return Object.entries(state.balances).reduce(
      (sum, [addr, bal]) => (isStateAccount(addr) ? sum : sum + bal),
      0
    );
  },

  mint(to: string, amount: number, memo = ""): void {
    if (amount <= 0) return;
    db.update((s) => {
      s.balances[to] = balanceOf(s, to) + Math.round(amount);
      record(s, "mint", TREASURY, to, amount, memo);
    });
  },

  burn(from: string, amount: number, memo = ""): void {
    if (amount <= 0) return;
    db.update((s) => {
      const have = balanceOf(s, from);
      const take = Math.min(have, Math.round(amount));
      s.balances[from] = have - take;
      record(s, "burn", from, TREASURY, take, memo);
    });
  },

  transfer(
    from: string,
    to: string,
    amount: number,
    memo = ""
  ): { ok: boolean; reason?: string } {
    amount = Math.round(amount);
    if (amount <= 0) return { ok: false, reason: "amount must be positive" };
    if (balanceOf(db.get(), from) < amount)
      return { ok: false, reason: "not enough MMC" };

    const isTreasuryInteraction = from === TREASURY || to === TREASURY;

    // Look up city-specific extra transfer fee directly from db to avoid circular deps
    let extraCityFee = 0;
    if (!isTreasuryInteraction) {
      const senderCitizen = db.get().citizens[from];
      if (senderCitizen?.city === "Rizzland") extraCityFee = 1;
    }

    const baseTaxAmount = (!isTreasuryInteraction && amount > 1) ? 1 : 0;
    const totalFee = baseTaxAmount + extraCityFee;
    const transferAmount = amount - totalFee;

    if (transferAmount <= 0) return { ok: false, reason: "amount too small after fees" };

    db.update((s) => {
      s.balances[from] = balanceOf(s, from) - amount;
      s.balances[to] = balanceOf(s, to) + transferAmount;
      record(s, "transfer", from, to, transferAmount, memo);

      if (baseTaxAmount > 0) {
        s.balances[TREASURY] = balanceOf(s, TREASURY) + baseTaxAmount;
        record(s, "transfer", from, TREASURY, baseTaxAmount, "transaction tax — bureaucrat levy 🏢");
      }
      if (extraCityFee > 0) {
        s.balances[TREASURY] = balanceOf(s, TREASURY) + extraCityFee;
        record(s, "transfer", from, TREASURY, extraCityFee, "rizz tax — Rizzland city surcharge 👑");
      }
    });
    return { ok: true };
  },


  recentTxs(n = 8) {
    return db.get().txs.slice(0, n);
  },

  allTxs() {
    return db.get().txs;
  },
};

