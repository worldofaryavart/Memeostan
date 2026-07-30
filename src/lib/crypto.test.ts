import { describe, it, expect } from "vitest";
import {
  actionMessage,
  canonicalJson,
  createCitizenKeys,
  deriveAddress,
  isValidPublicKey,
  legacyProof,
  makeNonce,
  signAction,
  verifyAction,
  verifyLegacyProof,
  type SignableAction,
} from "./crypto";

function action(over: Partial<SignableAction> = {}): SignableAction {
  return {
    type: "post.vote",
    payload: { postId: "post_abc123", dir: "up" },
    address: "0xabc",
    nonce: "0123456789abcdef",
    ts: 1_700_000_000_000,
    ...over,
  };
}

describe("canonicalJson", () => {
  it("is stable regardless of key order", () => {
    expect(canonicalJson({ b: 1, a: 2 })).toBe(canonicalJson({ a: 2, b: 1 }));
  });

  it("distinguishes different values", () => {
    expect(canonicalJson({ a: 1 })).not.toBe(canonicalJson({ a: 2 }));
  });

  it("drops undefined members so client and server agree", () => {
    expect(canonicalJson({ a: 1, b: undefined })).toBe(canonicalJson({ a: 1 }));
  });

  it("handles nesting and arrays", () => {
    expect(canonicalJson({ x: [{ b: 1, a: 2 }] })).toBe('{"x":[{"a":2,"b":1}]}');
  });
});

describe("actionMessage", () => {
  it("is domain-separated so a signature can't be reused elsewhere", () => {
    expect(actionMessage(action()).startsWith("memeostan.v1\n")).toBe(true);
  });

  it("changes when any field changes", () => {
    const base = actionMessage(action());
    expect(actionMessage(action({ type: "post.boost" }))).not.toBe(base);
    expect(actionMessage(action({ address: "0xdef" }))).not.toBe(base);
    expect(actionMessage(action({ nonce: "ffffffffffffffff" }))).not.toBe(base);
    expect(actionMessage(action({ ts: 1_700_000_000_001 }))).not.toBe(base);
    expect(actionMessage(action({ payload: { postId: "post_abc123", dir: "down" } }))).not.toBe(base);
  });
});

describe("citizen keys", () => {
  it("derives the address from the public key", async () => {
    const keys = await createCitizenKeys();
    expect(keys.address).toMatch(/^0x[0-9a-f]{40}$/);
    expect(await deriveAddress(keys.publicKey)).toBe(keys.address);
  });

  it("gives every citizen a different address", async () => {
    const [a, b] = await Promise.all([createCitizenKeys(), createCitizenKeys()]);
    expect(a.address).not.toBe(b.address);
  });

  it("rejects malformed public keys", () => {
    expect(isValidPublicKey({ kty: "EC", crv: "P-256", x: "a", y: "b" })).toBe(true);
    expect(isValidPublicKey({ kty: "RSA", crv: "P-256", x: "a", y: "b" })).toBe(false);
    expect(isValidPublicKey({ kty: "EC", crv: "P-384", x: "a", y: "b" })).toBe(false);
    expect(isValidPublicKey({ kty: "EC", crv: "P-256", x: "a" })).toBe(false);
    expect(isValidPublicKey(null)).toBe(false);
  });
});

describe("signatures", () => {
  it("verifies a signature from the matching key", async () => {
    const keys = await createCitizenKeys();
    const act = action({ address: keys.address });
    const sig = await signAction(keys.privateKey, act);
    expect(await verifyAction(keys.publicKey, act, sig)).toBe(true);
  });

  it("rejects a tampered payload — you can't re-aim a signed action", async () => {
    const keys = await createCitizenKeys();
    const act = action({ address: keys.address });
    const sig = await signAction(keys.privateKey, act);

    const tampered = { ...act, payload: { postId: "post_abc123", dir: "down" } };
    expect(await verifyAction(keys.publicKey, tampered, sig)).toBe(false);
  });

  it("rejects a tampered actor — you can't act as someone else", async () => {
    const keys = await createCitizenKeys();
    const act = action({ address: keys.address });
    const sig = await signAction(keys.privateKey, act);

    expect(await verifyAction(keys.publicKey, { ...act, address: "0xvictim" }, sig)).toBe(false);
  });

  it("rejects another citizen's key", async () => {
    const [mine, theirs] = await Promise.all([createCitizenKeys(), createCitizenKeys()]);
    const act = action({ address: mine.address });
    const sig = await signAction(mine.privateKey, act);
    expect(await verifyAction(theirs.publicKey, act, sig)).toBe(false);
  });

  it("rejects garbage signatures instead of throwing", async () => {
    const keys = await createCitizenKeys();
    expect(await verifyAction(keys.publicKey, action(), "not-a-signature")).toBe(false);
  });
});

describe("legacy key upgrade proof", () => {
  it("accepts a proof from the right secret", async () => {
    const act = action({ type: "citizen.upgradeKey", payload: {} });
    const proof = await legacyProof("s3cret-hex", act);
    expect(await verifyLegacyProof("s3cret-hex", act, proof)).toBe(true);
  });

  it("rejects the wrong secret", async () => {
    const act = action({ type: "citizen.upgradeKey", payload: {} });
    const proof = await legacyProof("s3cret-hex", act);
    expect(await verifyLegacyProof("other-secret", act, proof)).toBe(false);
  });

  it("rejects a proof bound to a different action", async () => {
    const proof = await legacyProof("s3cret-hex", action({ type: "citizen.upgradeKey" }));
    expect(await verifyLegacyProof("s3cret-hex", action({ type: "mmc.transfer" }), proof)).toBe(false);
  });
});

describe("makeNonce", () => {
  it("does not repeat", () => {
    const nonces = new Set(Array.from({ length: 200 }, () => makeNonce()));
    expect(nonces.size).toBe(200);
  });
});
