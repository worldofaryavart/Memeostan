# 🌐 United Memeostan

> **One World. One Meme.**
> A decentralized virtual nation and next-gen social platform governed by
> **Memeocracy** — laws passed by likes, leaders chosen by virality, GDP measured
> in Gross Domestic Brainrot.

**Citizens are people. The government is AI.** Every citizen is a real human who
posts, votes and stands for office. The machinery of the state — the Cyber Police
that cites you, the Supreme Court that fines you, the Election Commission that
counts the ballots, the Treasury, the broadcaster — is run by AI, so no citizen
has to sit on a docket at 3 AM. The civil service has no franchise: it never
votes, never sits on a jury and never stands for office. It enforces what
citizens passed.

The surface is unserious. The build is serious: real wallet-shaped identity, a
real append-only MemeCoin ledger (mint / burn / transfer), and a state that acts
on you on its own schedule.

---

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build           # production build (also type-checks)
npm test                # vitest — crypto / actions / feed / AI / ledger / economy / posts
npm run nation:reset    # dissolve the nation and re-seed (dry run without --yes)
```

Requires Node 18+ and MongoDB:

```bash
MONGODB_URI=mongodb://localhost:27017/memeostan   # the nation lives here
MOONSHOT_API_KEY=...                              # optional — the state gets terse without it
MEMEOSTAN_DAILY_TOKEN_CAP=60000                   # optional — national ceiling on LLM spend
```

The nation is **server-authoritative**: state lives in MongoDB, and the browser
holds an optimistic cache plus your private key.

---

## 🧠 What this is

A **Public Square** plus government, courts, cities and a market: claim
citizenship (get a real keypair, a passport, and a 250 MMC welcome grant), post
to the feed, vote, tip authors, file laws, sue people, and watch AI ministers
campaign and reply. The whole thing is styled as a dark scrapboard zine per the
official design system.

---

## 🏗️ Architecture

**The server owns the country. The browser owns your key.**

A citizen is a real ECDSA P-256 keypair generated in the browser. The address is
derived from the public key, so it can't be claimed by anyone else, and the
private half never leaves the device. The nation stores only public keys.

The client can't write state — it can only ask:

```
browser                          server                        mongodb
   │                                │                             │
   │  1. apply locally (optimistic) │                             │
   │  2. sign the intent            │                             │
   ├──── POST /api/action ─────────►│                             │
   │                                │  verify sig + nonce + clock │
   │                                │  apply the SAME lib code    │
   │                                ├─ replaceOne where rev == N ─►│
   │◄──── canonical state ──────────┤        (rev → N+1)          │
   │  3. adopt it, discard the guess│                             │
```

Every write is conditional on the revision it was read at, so two people acting
at once can't overwrite each other — a conflict re-reads and re-applies instead.
Actions carry client-generated row ids so a replay lands on the same row rather
than duplicating it.

| Layer | File | Responsibility |
| --- | --- | --- |
| **Authority** | `src/lib/actions.ts` | **The security boundary.** Every legal action, its payload validation, and its cost. Runs on the server for real, on the client as an optimistic preview. |
| Signing | `src/lib/crypto.ts` | ECDSA P-256 keys, address derivation, canonical message, sign/verify. Isomorphic. |
| Persistence | `src/lib/serverState.ts` | Server-only. Load / commit under a revision guard, retry on conflict, nonce replay window. |
| Intent endpoint | `src/app/api/action/route.ts` | Verify → apply → commit → return canonical state. The only write path. |
| Client bridge | `src/lib/actionClient.ts` | Optimistic apply, signing, a serialized send queue, state reconciliation. |
| Your identity | `src/lib/session.ts` | Your address + private key, in this browser only. Never sent. |
| State | `src/lib/db.ts` | The one mutation choke-point. Authoritative state server-side, optimistic cache client-side. |
| Currency | `src/lib/ledger.ts` | MemeCoin (MMC): `mint` / `burn` / `transfer`, every move a hash-chained tx. |
| Citizens | `src/lib/citizens.ts` | Registry keyed by address; register / aura / key upgrade. |
| Feed | `src/lib/posts.ts` | Create, vote, reply; voting mints/burns MMC (upvote reward, ratio tax). |
| Governance | `src/lib/governance.ts`, `elections.ts`, `judiciary.ts` | Bills, elections, trials. Citizens only — see `systemAccounts.ts` for the line. |
| The law | `src/lib/constitution.ts` | Enacted bills become machine-checkable articles. `violationOf(post)` is the only thing the police consult. |
| World | `src/lib/economy.ts`, `territory.ts`, `cities.ts`, `market.ts` | GDB, dilution, economic events, border wars, the cosmetics store. |
| The state | `src/lib/systemAccounts.ts` | The civil service roster — addresses, offices, endowments, and how each office speaks. `isStateAccount()` is the authoritative "is this the government" test. |
| AI | `src/ai/world.ts` + `src/app/api/ai/beat/route.ts` | The state's duties (patrol, prosecute, judge, tune, announce) inside a server transaction. `src/ai/moonshot.ts` holds the LLM calls and daily token budgets. |
| Design | `src/app/globals.css` | Mirrors the design-system tokens (Brainrot Zine mode). |

Read flow is unchanged: components read from `db` and call `refresh()` to
re-render. No prop-drilled store.

### Adding an action

1. Add an entry to `ACTIONS` in `src/lib/actions.ts` — validate the payload, take
   the cost from `RATES` or a server-side catalog, never from the caller.
2. Call it from the UI with `act("your.action", { … })`.

That's it. Signing, replay protection, concurrency and reconciliation are handled
by the envelope. The two rules: handlers must be **synchronous**, and they must be
safe to run twice (a conflict replays them).

### Going on-chain later

`actions.ts` is already the transaction boundary and `ledger.ts` is already
hash-chained, so the chain swap is `serverState.ts` (where state is committed) and
`crypto.ts` (P-256 → secp256k1). The protocol above doesn't change.

---

## ✅ Real vs 🎭 stub

**Real (multiplayer, persists server-side, has consequences):**

- Citizenship: a real keypair, a passport, the 250 MMC welcome grant. Every action
  you take is signed, and nobody — including whoever runs the server — can act as
  you or spend your MMC.
- The MMC ledger — minting on posts/upvotes, burning on spam/downvotes, tipping,
  arbitrary citizen-to-citizen transfers, circulating supply.
- The feed: posting (text + image), voting, boosting, the leaderboard.
- Governance: proposals that cost MMC to file, YES/NO referendums resolved on a
  timer, elections that appoint a cabinet of citizens (an empty ballot is a valid
  result — no government forms and the civil service carries on).
- **Legislation that binds the state.** A bill carries a rule the police can
  check — ban a word, require a picture, cap posts per five minutes, set a
  minimum length, make a ratio an offence, or repeal an existing article. Pass
  one and the Cyber Police enforce it on the next patrol, with no deploy.
- Policing: the Cyber Police patrol recent posts against the constitution and
  leave a citation; an unanswered citation is what the state prosecutes on.
- Courts: filing lawsuits, jury verdicts by citizens, fines and compensation. An
  empty jury box is a bench ruling at half penalty, not an automatic acquittal.
- Cities: territory that changes hands when a citizen pays for a skirmish.
- Market: cosmetics bought at the catalog price and equipped on your passport.
- National metrics (GDB, dilution, economic events) — derived from real activity.
- The state policing, prosecuting, judging and broadcasting on a server-side beat.

**Stub / decorative satire (no backend):**

- The "MEMECOIN PRICE 📈" panel — obvious joke, **not** a tradeable price.
- Top Meme Parties percentages, Brainrot FM, the breaking-news ticker, and the
  `Nonsense` flavor cards (the nap widget is real — it grants aura).

**How the law works:**

- **A law is a rule, not a mood.** Free text would mean asking a model whether a
  post "feels illegal" — unfalsifiable, unpredictable, impossible to argue with
  in court. A citizen must be able to read the constitution and know, before
  they post, whether they are breaking it. A bill with no rule still passes; it
  is a resolution and binds nobody.
- **The three founding articles are seeded as ordinary enacted bills**, not as
  code. Which means they are repealable. The citizens can legalise logic.
- **Enforcement is never retroactive.** A post published before an article was
  enacted cannot be cited under it — otherwise passing a law would criminalise
  the entire back catalogue at once.
- **Repeal reaches a prosecution already in flight.** The post is re-tested
  against the constitution when the charge is filed, so striking out an article
  withdraws the citation instead of going to trial.
- **Article numbers are never reused.** A repealed article is struck out, not
  vacated; a citation for "Article 1" has to mean one thing forever.
- Rule parameters are bounded server-side. `post_limit: 0` would criminalise
  posting, a two-letter banned word would match every post ever written — one
  referendum should not be able to end the country.

**How the state is bounded:**

- **The civil service has no franchise.** No state account votes in an election,
  votes on a proposal, sits on a jury or stands for office. This is enforced at
  every entry point, not just by convention.
- **Every charge traces to a citation.** The police cite a post against a stated
  article; only an unanswered citation becomes a prosecution. Nothing is invented.
- **The budget gates the wording, never the act.** If the daily token cap
  (`MEMEOSTAN_DAILY_TOKEN_CAP`) is spent, the police still cite and the court
  still rules — in a plain fallback register. A state that stops enforcing the
  law because its API bill ran out is not a state.
- **State balances are outside circulating supply.** The ministries are endowed so
  they can pay fines and grants; counting those floats as circulating put supply
  over 150k on an empty country and throttled post rewards to the floor.

**Known limits:**

- Feeds refresh by polling on a ~5s world tick, not a live subscription.
- The world clock only advances while at least one tab is open and visible.
- A state change ships the **whole nation** to every open tab. Ticks that change
  nothing now cost ~64 bytes, and the collections are capped, which puts an idle
  tab around 19MB/hour — down from 158MB/hour, but the real fix is sending diffs.
- Losing your browser storage without exporting your passport loses the
  citizenship. That's the cost of holding the key yourself.

> 💸 MemeCoin is a **closed-loop in-app token**. There is no price, no trading,
> no real-world value — by design.

---

## 🎨 Design

Built to the **United Memeostan Design System** (Brainrot Zine mode): dark
scrapboard `#0c0a16`, warm torn-paper cards, Anton / Permanent Marker / Caveat /
Outfit type, one `2.5px #15131f` ink border weight, hard-offset shadows (never
blur), sticker chips, intentional tilt, emoji-first iconography. Tokens live in
`src/app/globals.css`. Real painted mascot art drops into `public/art/` later
(see its README) — until then the canonical emoji set stands in.

---

## 📂 Docs

- `doc/intro.md` — political system, citizen rights, ministries.
- `doc/vision.md` — tone, brand stance, what we're *not*.
- `doc/peak-brainrot-concepts.md` — titles, regions, holidays.
- `doc/working-phases/` — phase plans + the overnight build log.

---

## 🏆 Slogan

> **"Too lazy to revolt. Too online to fail."**
