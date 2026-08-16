// End-to-end probe of the legislation bridge against a running Memeostan.
//
//   npm run probe:legislation -- https://memeostan.xyz
//
// The claim being tested is the one the whole design rests on: a law citizens
// pass is a law the state actually enforces, and a law they repeal is one it
// stops enforcing. Both directions, against a live server, through the real
// signed-action API.
//
// It takes roughly ten minutes, because it waits out two real referendum
// deadlines rather than mocking them.
//
// IT CREATES REAL CITIZENS, POSTS AND LAWS. Run it against a scratch instance,
// or reset the nation afterwards (npm run nation:reset -- --yes).

const BASE = process.argv[2] || "http://127.0.0.1:3000";
const BANNED = "skibidi";

const b64u = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) =>
  new Uint8Array(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"));

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalJson(value[k])).join(",") + "}";
}

async function makeCitizenKeys() {
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
  const address =
    "0x" + [...digest.slice(-20)].map((b) => b.toString(16).padStart(2, "0")).join("");

  return { privateKey: pair.privateKey, pubKey, address };
}

async function send(keys, type, payload, { withPubKey = false } = {}) {
  const nonce = "probe-" + crypto.randomUUID();
  const ts = Date.now();
  const message = ["memeostan.v1", type, keys.address, nonce, String(ts), canonicalJson(payload)].join(
    "\n"
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    keys.privateKey,
    new TextEncoder().encode(message)
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
const tick = () =>
  fetch(`${BASE}/api/action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "world.tick", payload: {}, address: "", nonce: "probe-tick-" + Date.now(), ts: Date.now() }),
  }).catch(() => {});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const step = (n, s) => console.log(`\n[${n}] ${s}`);

async function claim(name) {
  const keys = await makeCitizenKeys();
  const res = await send(
    keys,
    "citizen.register",
    { username: name, faction: "Sigma", pfp: "🧪" },
    { withPubKey: true }
  );
  if (!res.ok) throw new Error(`register ${name} failed: ${res.status} ${res.reason}`);
  return keys;
}

/** Poll until `check` returns something truthy, driving the world along the way. */
async function until(label, check, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    await tick();
    await beat();
    const state = await getState();
    const hit = check(state);
    if (hit) return { hit, state };
    process.stdout.write(".");
    await sleep(5000);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function main() {
  console.log(`probing ${BASE}`);
  console.log("this waits out two real referendum deadlines — roughly ten minutes\n");

  step(1, "two citizens claim passports (a bill needs a proposer and a quorum)");
  const alice = await claim("LawProbeA");
  const bob = await claim("LawProbeB");
  console.log(`    ${alice.address}`);
  console.log(`    ${bob.address}`);

  step(2, `confirming "${BANNED}" is legal right now`);
  const legalPostId = "post_legal" + Math.random().toString(36).slice(2, 8);
  await send(alice, "post.create", { id: legalPostId, text: `${BANNED} toilet, and nothing happens` });
  await beat();
  await sleep(6000);
  let state = await getState();
  const legalPost = state.posts.find((p) => p.id === legalPostId);
  const citedWhileLegal = (legalPost?.replies ?? []).length > 0;
  console.log(`    posted it. citations: ${citedWhileLegal ? "SOME (unexpected)" : "none"}`);

  const before = state.proposals.filter((p) => p.status === "enacted" && p.article).length;
  console.log(`    constitution currently has ${before} article(s)`);

  step(3, `filing a bill to ban "${BANNED}"`);
  const billId = "prop_probe" + Math.random().toString(36).slice(2, 8);
  const filed = await send(alice, "proposal.create", {
    proposalId: billId,
    postId: "post_bill" + Math.random().toString(36).slice(2, 8),
    title: `Ban the word ${BANNED}`,
    description: "It is over for toilet-posting. The commons deserve better.",
    rule: { type: "ban_word", word: BANNED },
  });
  if (!filed.ok) throw new Error(`filing failed: ${filed.status} ${filed.reason}`);

  step(4, "both citizens vote YES");
  for (const [who, keys] of [["A", alice], ["B", bob]]) {
    const v = await send(keys, "proposal.vote", { proposalId: billId, vote: "yes" });
    console.log(`    citizen ${who}: ${v.ok ? "YES" : `FAILED (${v.reason})`}`);
  }

  step(5, "waiting for the referendum to close and the bill to enter the constitution");
  const enacted = await until(
    "enactment",
    (s) => {
      const p = s.proposals.find((x) => x.id === billId);
      return p?.status === "enacted" && p.article ? p : null;
    },
    60
  );
  const article = enacted.hit.article;
  console.log(`\n    enacted as Article ${article}`);
  const announcement = enacted.state.posts.find(
    (p) => p.text.includes("ENACTED") && p.text.includes(BANNED)
  );
  if (announcement) console.log(`    court published:\n    ${announcement.text.replace(/\n/g, "\n    ")}`);

  step(6, `posting "${BANNED}" again, now that it is illegal`);
  const illegalPostId = "post_illegal" + Math.random().toString(36).slice(2, 8);
  await send(bob, "post.create", { id: illegalPostId, text: `${BANNED} toilet, again` });

  const cited = await until("a citation", (s) => {
    const p = s.posts.find((x) => x.id === illegalPostId);
    return p?.replies?.length ? p.replies[0] : null;
  });
  console.log(`\n    ${cited.hit.text.replace(/\n/g, "\n    ")}`);

  step(7, "checking the law did not reach backwards");
  state = await getState();
  const oldPost = state.posts.find((p) => p.id === legalPostId);
  const oldCited = (oldPost?.replies ?? []).length > 0;
  console.log(`    the post made before the ban: ${oldCited ? "CITED" : "still untouched"}`);

  step(8, `filing a repeal of Article ${article}`);
  const repealId = "prop_repeal" + Math.random().toString(36).slice(2, 8);
  const repeal = await send(bob, "proposal.create", {
    proposalId: repealId,
    postId: "post_repeal" + Math.random().toString(36).slice(2, 8),
    title: `Repeal Article ${article}`,
    description: "On reflection the commons did not deserve better.",
    rule: { type: "repeal", target: billId },
  });
  if (!repeal.ok) throw new Error(`repeal filing failed: ${repeal.status} ${repeal.reason}`);
  for (const keys of [alice, bob]) {
    await send(keys, "proposal.vote", { proposalId: repealId, vote: "yes" });
  }

  step(9, "waiting for the repeal to carry");
  const repealed = await until(
    "repeal",
    (s) => (s.proposals.find((x) => x.id === billId)?.repealedBy ? true : null),
    60
  );
  console.log(`\n    Article ${article} struck out`);

  step(10, `posting "${BANNED}" once more, now that it is legal again`);
  const afterPostId = "post_after" + Math.random().toString(36).slice(2, 8);
  await send(alice, "post.create", { id: afterPostId, text: `${BANNED} toilet, with impunity` });
  for (let i = 0; i < 6; i++) {
    await beat();
    await sleep(5000);
  }
  state = await getState();
  const afterPost = state.posts.find((p) => p.id === afterPostId);
  const citedAfterRepeal = (afterPost?.replies ?? []).length > 0;
  console.log(`    citations: ${citedAfterRepeal ? "SOME (unexpected)" : "none"}`);

  step(11, "checks");
  const liveArticles = state.proposals.filter(
    (p) => p.status === "enacted" && p.article && !p.repealedBy
  );
  const checks = [
    ["the word was legal before the bill", !citedWhileLegal],
    ["a citizen's bill became an article", Boolean(article)],
    ["the court announced what changed", Boolean(announcement)],
    ["the police enforced it without a deploy", Boolean(cited.hit)],
    ["the citation names the new article", cited.hit.text.includes(String(article))],
    ["the law did not reach backwards", !oldCited],
    ["repeal struck the article out", Boolean(repealed.hit)],
    ["the police stopped enforcing it", !citedAfterRepeal],
    ["the repealed article is out of the constitution", !liveArticles.some((p) => p.id === billId)],
    ["the founding articles are still in force", liveArticles.length >= 3],
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
