// wallet.ts — wallet-shaped citizen identity.
//
// A citizen IS a wallet: an address (public, your citizen ID) + a secret key.
// In phase 1 the keypair is generated locally; in phase 2 this becomes a real
// wallet — but the rest of the app already treats identity as "an address", so
// nothing downstream changes.

function randomHex(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export interface Keypair {
  address: string;
  secret: string;
}

// Address is 20 bytes (0x + 40 hex) — same shape as an EVM address, so it ports.
export function createKeypair(): Keypair {
  return {
    address: "0x" + randomHex(20),
    secret: randomHex(32),
  };
}

// Short, human-friendly form for showing an address as a flex: 0x1a2b…9f0e
export function shortAddress(address?: string | null): string {
  if (!address) return "0x0000…0000";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
