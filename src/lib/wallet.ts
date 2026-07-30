// wallet.ts — display helpers for wallet-shaped identity.
//
// The keypair itself now lives in src/lib/crypto.ts (real ECDSA, private half
// kept in the browser) and the address is derived from the public key rather than
// picked at random. This file is just how an address is shown to a human.

// Short, human-friendly form for showing an address as a flex: 0x1a2b…9f0e
export function shortAddress(address?: string | null): string {
  if (!address) return "0x0000…0000";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
