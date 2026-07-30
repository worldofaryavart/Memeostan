// crypto.ts — isomorphic action signing. Runs identically in the browser and in
// Node (WebCrypto is available in both), so the client signs and the server
// verifies with the exact same code.
//
// A citizen IS a keypair (ECDSA P-256). The private key NEVER leaves the browser.
// The nation stores only the public key, and the address is derived from it — so
// an address is self-authenticating: you cannot claim one you don't hold the key
// for, and nobody (including us) can act on your behalf.
//
// Shape note: address = last 20 bytes of SHA-256(pubkey) rendered as 0x + 40 hex.
// Same shape as an EVM address (which is keccak of a secp256k1 key), so moving to
// a real chain later is a swap of this file, not of the protocol.

export interface PublicKeyJwk {
  kty: "EC";
  crv: "P-256";
  x: string;
  y: string;
}

export interface PrivateKeyJwk extends PublicKeyJwk {
  d: string;
}

const KEY_ALGO = { name: "ECDSA", namedCurve: "P-256" } as const;
const SIGN_ALGO = { name: "ECDSA", hash: "SHA-256" } as const;

function subtle(): SubtleCrypto {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new Error("WebCrypto is unavailable in this environment");
  }
  return c.subtle;
}

// ── encoding helpers ─────────────────────────────────────────────────────────

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function bytesToB64u(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const b64 = typeof btoa === "function"
    ? btoa(binary)
    : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64uToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === "function") {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(padded, "base64"));
}

function utf8(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/**
 * Deterministic JSON: object keys sorted, so the client and server always hash
 * byte-identical payloads. Signature verification depends on this.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k])).join(",") + "}";
}

// ── keys + addresses ─────────────────────────────────────────────────────────

export interface CitizenKeys {
  address: string;
  publicKey: PublicKeyJwk;
  privateKey: PrivateKeyJwk;
}

export async function createCitizenKeys(): Promise<CitizenKeys> {
  const pair = await subtle().generateKey(KEY_ALGO, true, ["sign", "verify"]);
  const pub = (await subtle().exportKey("jwk", pair.publicKey)) as JsonWebKey;
  const priv = (await subtle().exportKey("jwk", pair.privateKey)) as JsonWebKey;

  const publicKey: PublicKeyJwk = { kty: "EC", crv: "P-256", x: pub.x!, y: pub.y! };
  const privateKey: PrivateKeyJwk = { ...publicKey, d: priv.d! };

  return { address: await deriveAddress(publicKey), publicKey, privateKey };
}

/** An address is a hash of the public key — it cannot be chosen, only earned. */
export async function deriveAddress(publicKey: PublicKeyJwk): Promise<string> {
  const x = b64uToBytes(publicKey.x);
  const y = b64uToBytes(publicKey.y);
  const raw = new Uint8Array(x.length + y.length);
  raw.set(x, 0);
  raw.set(y, x.length);
  const digest = new Uint8Array(await subtle().digest("SHA-256", raw));
  return "0x" + bytesToHex(digest.slice(-20));
}

export function isValidPublicKey(key: unknown): key is PublicKeyJwk {
  const k = key as PublicKeyJwk | null;
  return Boolean(
    k && k.kty === "EC" && k.crv === "P-256" && typeof k.x === "string" && typeof k.y === "string"
  );
}

// ── the signed message ───────────────────────────────────────────────────────

export interface SignableAction {
  type: string;
  payload: unknown;
  address: string;
  nonce: string;
  ts: number;
}

/**
 * The exact bytes that get signed. Domain-separated by the "memeostan.v1" prefix
 * so a signature can never be replayed against a different protocol version.
 */
export function actionMessage(action: SignableAction): string {
  return [
    "memeostan.v1",
    action.type,
    action.address,
    action.nonce,
    String(action.ts),
    canonicalJson(action.payload),
  ].join("\n");
}

export function makeNonce(): string {
  const bytes = new Uint8Array(16);
  (globalThis.crypto as Crypto).getRandomValues(bytes);
  return bytesToHex(bytes);
}

export async function signAction(
  privateKey: PrivateKeyJwk,
  action: SignableAction
): Promise<string> {
  const key = await subtle().importKey("jwk", privateKey as JsonWebKey, KEY_ALGO, false, ["sign"]);
  const sig = await subtle().sign(SIGN_ALGO, key, utf8(actionMessage(action)) as BufferSource);
  return bytesToB64u(new Uint8Array(sig));
}

export async function verifyAction(
  publicKey: PublicKeyJwk,
  action: SignableAction,
  signature: string
): Promise<boolean> {
  try {
    const key = await subtle().importKey("jwk", publicKey as JsonWebKey, KEY_ALGO, false, ["verify"]);
    return await subtle().verify(
      SIGN_ALGO,
      key,
      b64uToBytes(signature) as BufferSource,
      utf8(actionMessage(action)) as BufferSource
    );
  } catch {
    return false;
  }
}

// ── legacy key upgrade ───────────────────────────────────────────────────────
//
// Citizens created before signed actions existed hold a random hex `secret` that
// was (wrongly) stored in shared state. They get exactly one authenticated move:
// prove they know the secret, register a real public key, and the secret is
// destroyed server-side. After that they're indistinguishable from a new citizen.

async function hmacKey(secret: string): Promise<CryptoKey> {
  return subtle().importKey(
    "raw",
    utf8(secret) as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

export async function legacyProof(secret: string, action: SignableAction): Promise<string> {
  const key = await hmacKey(secret);
  const mac = await subtle().sign("HMAC", key, utf8(actionMessage(action)) as BufferSource);
  return bytesToHex(new Uint8Array(mac));
}

export async function verifyLegacyProof(
  secret: string,
  action: SignableAction,
  proof: string
): Promise<boolean> {
  const expected = await legacyProof(secret, action);
  if (expected.length !== proof.length) return false;
  // constant-time-ish compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ proof.charCodeAt(i);
  }
  return diff === 0;
}
