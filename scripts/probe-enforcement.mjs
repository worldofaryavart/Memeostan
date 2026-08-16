// End-to-end probe of the enforcement loop against a running Memeostan.
//
//   npm run probe:enforcement -- https://memeostan.xyz
//
// Claims a citizenship, posts something that breaks Article 1, and watches
// whether the state notices: citation -> prosecution -> verdict -> ledger.
// Nothing here is imported from the app; it re-implements the signing protocol,
// so a pass means the wire format is genuinely what the server expects.
//
// It takes a few minutes — it is waiting on real trial deadlines, not mocks.
//
// IT CREATES A REAL CITIZEN AND REAL POSTS. Run it against a scratch instance,
// or reset the nation afterwards (npm run nation:reset -- --yes). It earned its
// place in the repo by catching a bug unit tests could not see: the world clock
// was resolving every trial before the AI beat could write the court's reasoning,
// so verdicts silently came out in the fallback register with nothing in the log.

const BASE = process.argv[2] || "http://127.0.0.1:3000";

const b64u = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

async function makeCitizenKeys() {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const pubKey = { kty: "EC", crv: "P-256", x: jwk.x, y: jwk.y };

  const x = unb64u(pubKey.x);
  const y = unb64u(pubKey.y);
  const raw = new Uint8Array(x.length + y.length);
  raw.set(x, 0);
  raw.set(y, x.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", raw));
  const address =
    "0x" + [...digest.slice(-20)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { privateKey: pair.privateKey, pubKey, address };
}

async function send(keys, type, payload, { withPubKey = false } = {}) {
  const nonce = "probe-" + crypto.randomUUID();
  const ts = Date.now();
  const message = [
    "memeostan.v1",
    type,
    keys.address,
    nonce,
    String(ts),
    canonicalJson(payload),
  ].join("\n");

  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(message)
  );

  const body = {
    type,
    payload,
    address: keys.address,
    nonce,
    ts,
    sig: b64u(new Uint8Array(sig)),
    ...(withPubKey ? { pubKey: keys.pubKey } : {}),
  };

  const res = await fetch(`${BASE}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, ...(await res.json().catch(() => ({}))) };
}

const getState = async () => (await fetch(`${BASE}/api/state`)).json();
const beat = () =>
  fetch(`${BASE}/api/ai/beat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  }).then((r) => r.json());

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (n, s) => console.log(`\n[${n}] ${s}`);

async function main() {
  console.log(`probing ${BASE}`);

  step(1, "claiming a citizenship");
  const keys = await makeCitizenKeys();
  const reg = await send(
    keys,
    "citizen.register",
    { username: "ProbeCitizen", faction: "Sigma", pfp: "🧪" },
    { withPubKey: true }
  );
  if (!reg.ok) throw new Error(`register failed: ${reg.status} ${reg.reason}`);
  console.log(`    ${keys.address}`);

  let state = await getState();
  const people = Object.values(state.citizens).filter((c) => !c.isAI);
  console.log(`    population is now ${people.length}: ${people.map((c) => c.username).join(", ")}`);
  console.log(`    balance ${state.balances[keys.address]} MMC (welcome grant)`);

  step(2, "posting something that plainly breaks Article 1");
  const postId = "post_probe" + Math.random().toString(36).slice(2, 8);
  const text = "actually the GDB figures are statistically within tolerance";
  const posted = await send(keys, "post.create", { id: postId, text });
  if (!posted.ok) throw new Error(`post failed: ${posted.status} ${posted.reason}`);
  console.log(`    "${text}"`);

  step(3, "waiting for the Cyber Police to patrol");
  let citation = null;
  for (let i = 0; i < 12 && !citation; i++) {
    await beat();
    await sleep(5000);
    state = await getState();
    const post = state.posts.find((p) => p.id === postId);
    citation = post?.replies?.[0] ?? null;
    if (!citation) process.stdout.write(".");
  }
  if (!citation) throw new Error("no citation after 60s — the police never showed up");
  const police = state.citizens[citation.author];
  console.log(`\n    cited by ${police.pfp} ${police.username} (${police.faction}):`);
  console.log(`    ${citation.text.replace(/\n/g, "\n    ")}`);

  step(4, "waiting for the citation to become a prosecution");
  let trial = null;
  for (let i = 0; i < 20 && !trial; i++) {
    await beat();
    await sleep(5000);
    state = await getState();
    trial = (state.trials ?? []).find((t) => t.defendant === keys.address) ?? null;
    if (!trial) process.stdout.write(".");
  }
  if (!trial) throw new Error("never charged — the prosecution path is broken");
  console.log(`\n    ${trial.charge} (status: ${trial.status})`);

  step(5, "letting the trial run out with an empty jury box");
  const before = state.balances[keys.address];
  let resolved = null;
  for (let i = 0; i < 40 && !resolved; i++) {
    await beat();
    await sleep(5000);
    state = await getState();
    const t = (state.trials ?? []).find((x) => x.id === trial.id);
    if (t?.status === "resolved") resolved = t;
    else process.stdout.write(".");
  }
  if (!resolved) throw new Error("the trial never resolved");

  const after = state.balances[keys.address];
  console.log(`\n    verdict: ${resolved.verdict}${resolved.benchVerdict ? " (from the bench)" : " (by jury)"}`);
  console.log(`    penalty: ${resolved.penalty}`);

  // Read the fine off the ledger, not off a balance delta. An economic event can
  // airdrop every citizen inside the same window — the first version of this
  // check reported a failure for exactly that reason while the fine was correct.
  const fine = state.txs.find(
    (t) => t.type === "burn" && t.from === keys.address && t.memo.includes("guilty verdict")
  );
  console.log(`    ledger:  ${before} -> ${after} MMC (fine: ${fine ? `-${fine.amount}` : "none"})`);
  console.log(`    aura:    ${state.citizens[keys.address].aura}`);

  const verdictPost = state.posts.find(
    (p) => p.text.includes("VERDICT") && p.text.includes("ProbeCitizen")
  );
  if (verdictPost) {
    console.log(`    the court published:`);
    console.log(`    ${verdictPost.text.replace(/\n/g, "\n    ")}`);
  }

  step(6, "checks");
  const checks = [
    ["citation came from the Cyber Police", citation.author.includes("cyberpolice")],
    ["the charge traces to the citation", trial.description.includes(postId)],
    ["an empty jury box did NOT acquit", resolved.verdict === "GUILTY"],
    ["it was recorded as a bench ruling", resolved.benchVerdict === true],
    ["the bench fine is half (25 MMC)", fine?.amount === 25],
    ["the bench aura penalty is half (50)", state.citizens[keys.address].aura === 950],
    ["the verdict reached the feed", Boolean(verdictPost)],
    [
      "every AI record is an organ of the state",
      Object.values(state.citizens)
        .filter((c) => c.isAI)
        .every((c) => /treasury|cyberpolice|electioncommission|constitutionalcourt|supremecourt|statebroadcaster/.test(c.address)),
    ],
    ["the ballot is still empty", (state.activeElection?.candidates ?? []).length === 0],
  ];
  let failed = 0;
  for (const [label, pass] of checks) {
    console.log(`    ${pass ? "PASS" : "FAIL"}  ${label}`);
    if (!pass) failed++;
  }
  console.log(`\n${failed === 0 ? "all checks passed" : `${failed} CHECK(S) FAILED`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nprobe failed:", err.message);
  process.exit(1);
});
