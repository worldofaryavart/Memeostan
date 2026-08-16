// audit-coldstart.mjs — what a stranger actually experiences, measured.
//
//   npm run audit:coldstart -- https://memeostan.xyz
//
// The hardest problem Memeostan has is that it starts empty, and "it feels
// better now" is not a claim anyone should accept. This walks the path a real
// first visitor walks and counts what happens to them:
//
//   • before claiming — is the square a blank wall?
//   • on claiming     — does the state react, and how fast?
//   • after posting   — how long until something happens TO them?
//
// It reports numbers, not opinions, and it makes no attempt to say whether
// people will like the country. That needs people. What it can say is whether
// there is anything here for the first one.
//
// Creates one citizen and one post. Reset afterwards if you care about the data.

const BASE = process.argv[2] || "http://127.0.0.1:3000";

const b64u = (b) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) =>
  new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

function canonicalJson(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return "[" + v.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(v[k])).join(",") + "}";
}

async function makeKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const pubKey = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };
  const x = unb64u(pubKey.x);
  const y = unb64u(pubKey.y);
  const raw = new Uint8Array(x.length + y.length);
  raw.set(x, 0);
  raw.set(y, x.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const address = "0x" + [...digest.slice(-20)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return { privateKey: pair.privateKey, pubKey, address };
}

async function send(keys, type, payload, withPubKey = false) {
  const nonce = "audit-" + crypto.randomUUID();
  const ts = Date.now();
  const msg = ["memeostan.v1", type, keys.address, nonce, String(ts), canonicalJson(payload)].join("\n");
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(msg)
  );
  const res = await fetch(`${BASE}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type,
      payload,
      address: keys.address,
      nonce,
      ts,
      sig: b64u(new Uint8Array(sig)),
      ...(withPubKey ? { pubKey: keys.pubKey } : {}),
    }),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

const getState = async () => (await fetch(`${BASE}/api/state`)).json();
const beat = () =>
  fetch(`${BASE}/api/ai/beat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).catch(() => {});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

async function main() {
  console.log(`cold-start audit of ${BASE}\n`);
  const findings = [];
  const record = (label, value, good) => {
    findings.push({ label, value, good });
    console.log(`  ${good === null ? "·" : good ? "✓" : "✗"} ${label}: ${value}`);
  };

  // ── 1. the wall a stranger hits ───────────────────────────────────────────
  console.log("[1] before claiming anything");
  let state = await getState();
  const stateAddresses = new Set(
    Object.values(state.citizens).filter((c) => c.isAI).map((c) => c.address)
  );
  const visiblePosts = state.posts.length;
  const explainsItself = state.posts.some((p) => p.text.includes("THE CONSTITUTION OF MEMEOSTAN"));

  record("posts visible to a stranger", visiblePosts, visiblePosts > 0);
  record("the square explains what this place is", explainsItself ? "yes" : "no", explainsItself);
  record(
    "articles a visitor can read before joining",
    (state.proposals ?? []).filter((p) => p.article && !p.repealedBy).length,
    true
  );

  // ── 2. claiming ───────────────────────────────────────────────────────────
  console.log("\n[2] claiming a passport");
  const keys = await makeKeys();
  const t0 = Date.now();
  const reg = await send(keys, "citizen.register", { username: "ColdStart", faction: "Sigma", pfp: "🧪" }, true);
  if (!reg.ok) throw new Error(`register failed: ${reg.status} ${reg.reason}`);
  const claimMs = Date.now() - t0;

  state = await getState();
  const me = state.citizens[keys.address];
  const welcome = state.posts.find(
    (p) => stateAddresses.has(p.author) && p.text.includes(`@${me.username}`) && p.text.includes("CITIZENSHIP")
  );

  record("time to become a citizen", secs(claimMs), claimMs < 4000);
  record("national ID issued", me.citizenNo ? `MMS-${String(me.citizenNo).padStart(4, "0")}` : "none", Boolean(me.citizenNo));
  record("welcome grant paid", `${state.balances[keys.address]} MMC`, state.balances[keys.address] > 0);
  record("the state addressed them by name", welcome ? "yes" : "no", Boolean(welcome));
  record(
    "the law was served on them at the door",
    welcome && welcome.text.includes("ARTICLES ARE IN FORCE") ? "yes" : "no",
    Boolean(welcome && welcome.text.includes("ARTICLES ARE IN FORCE"))
  );

  // ── 3. does anything happen TO them ───────────────────────────────────────
  console.log("\n[3] posting something unlawful, then waiting");
  const postId = "post_audit" + Math.random().toString(36).slice(2, 8);
  const t1 = Date.now();
  await send(keys, "post.create", { id: postId, text: "actually this country seems fine to me" });

  let citation = null;
  for (let i = 0; i < 24 && !citation; i++) {
    await beat();
    await sleep(5000);
    state = await getState();
    citation = state.posts.find((p) => p.id === postId)?.replies?.[0] ?? null;
    if (!citation) process.stdout.write(".");
  }
  const citeMs = Date.now() - t1;
  if (citation) process.stdout.write("\n");

  record(
    "time from posting to the state noticing",
    citation ? secs(citeMs) : "never (2 min)",
    Boolean(citation) && citeMs < 120_000
  );
  record(
    "the notice is shareable",
    citation ? `${BASE}/citation/${postId}` : "n/a",
    Boolean(citation)
  );

  if (citation) {
    const card = await fetch(`${BASE}/api/card/${postId}`);
    record(
      "share card renders",
      `${card.status} ${card.headers.get("content-type")}`,
      card.ok && (card.headers.get("content-type") || "").includes("image")
    );
  }

  // ── 4. is there a reason to come back ─────────────────────────────────────
  console.log("\n[4] is there anything waiting for them tomorrow");
  const metrics = await (await fetch(`${BASE}/api/metrics`)).json();
  const openBills = (state.proposals ?? []).filter((p) => p.status === "active").length;
  const openTrials = (state.trials ?? []).filter((t) => t.status === "voting").length;
  const electionEndsIn = state.activeElection ? state.activeElection.endsAt - Date.now() : 0;

  record("open bills they could vote on", openBills, null);
  record("open trials they could sit on", openTrials, null);
  record(
    "next election closes in",
    electionEndsIn > 0 ? `${(electionEndsIn / 3_600_000).toFixed(1)}h` : "resolving",
    electionEndsIn > 60 * 60 * 1000
  );

  // ── the read ──────────────────────────────────────────────────────────────
  console.log("\n[5] the country's own read");
  console.log(`  funnel:   ${JSON.stringify(metrics.funnel)}`);
  console.log(`  verdict:  ${metrics.readiness.verdict}`);
  console.log(`  summary:  ${metrics.readiness.summary}`);
  console.log(`  next:     ${metrics.readiness.bottleneck}`);

  const failed = findings.filter((f) => f.good === false);
  console.log(
    `\n${failed.length === 0 ? "cold start is intact" : `${failed.length} weak point(s): ${failed.map((f) => f.label).join("; ")}`}`
  );
  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\naudit failed:", err.message);
  process.exit(1);
});
