import { describe, it, expect, beforeEach } from "vitest";
import { db } from "./db";
import { ledger } from "./ledger";

const A = "0xcitizenA00000000000000000000000000000a";
const B = "0xcitizenB00000000000000000000000000000b";

beforeEach(() => db.reset());

describe("ledger.mint", () => {
  it("credits the wallet and records a tx", () => {
    ledger.mint(A, 100, "test mint");
    expect(ledger.balanceOf(A)).toBe(100);
    const tx = db.get().txs[0];
    expect(tx.type).toBe("mint");
    expect(tx.to).toBe(A);
    expect(tx.amount).toBe(100);
  });

  it("ignores non-positive amounts", () => {
    ledger.mint(A, 0);
    ledger.mint(A, -50);
    expect(ledger.balanceOf(A)).toBe(0);
    expect(db.get().txs).toHaveLength(0);
  });

  it("rounds fractional amounts", () => {
    ledger.mint(A, 10.7);
    expect(ledger.balanceOf(A)).toBe(11);
  });
});

describe("ledger.burn", () => {
  it("destroys tokens but never below zero", () => {
    ledger.mint(A, 30);
    ledger.burn(A, 100, "over-burn");
    expect(ledger.balanceOf(A)).toBe(0);
    // the burn tx records only what was actually taken
    expect(db.get().txs[0].amount).toBe(30);
  });
});

describe("ledger.transfer", () => {
  it("moves tokens between wallets on sufficient balance", () => {
    ledger.mint(A, 100);
    const res = ledger.transfer(A, B, 40, "tip");
    expect(res.ok).toBe(true);
    expect(ledger.balanceOf(A)).toBe(60);
    expect(ledger.balanceOf(B)).toBe(40);
  });

  it("rejects transfers larger than the balance", () => {
    ledger.mint(A, 10);
    const res = ledger.transfer(A, B, 50);
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/not enough/i);
    expect(ledger.balanceOf(A)).toBe(10);
    expect(ledger.balanceOf(B)).toBe(0);
  });

  it("rejects non-positive amounts", () => {
    ledger.mint(A, 10);
    expect(ledger.transfer(A, B, 0).ok).toBe(false);
  });
});

describe("ledger.circulatingSupply", () => {
  it("counts all balances except the treasury", () => {
    ledger.mint(A, 100);
    ledger.mint(B, 50);
    expect(ledger.circulatingSupply()).toBe(150);
    // burning sends back to treasury, which is excluded from supply
    ledger.burn(A, 100);
    expect(ledger.circulatingSupply()).toBe(50);
  });
});
