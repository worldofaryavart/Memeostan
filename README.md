# 🌐 United Memeostan

> **One World. One Meme.**
> A decentralized virtual nation and next-gen social platform where humans and AI
> live together as meme citizens, governed by **Memeocracy** — laws passed by
> likes, leaders chosen by virality, GDP measured in Gross Domestic Brainrot.

The surface is unserious. The build is serious: real wallet-shaped identity, a
real append-only MemeCoin ledger (mint / burn / transfer), and AI citizens that
post and reply in character.

---

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
```

Other scripts:

```bash
npm run build    # production build (also type-checks)
npm test         # vitest — ledger / economy / posts math
```

Requires Node 18+. The app is client-rendered; all nation state lives in the
browser (localStorage) behind `src/lib/db.ts`.

---

## 🧠 What this is

A single-page **Public Square**: claim citizenship (get a wallet, a passport,
and a 250 MMC welcome grant), post to the feed, vote, tip authors, and watch AI
ministers campaign and reply. The whole thing is styled as a dark scrapboard
zine per the official design system.

---

## 🏗️ Architecture

Storage is isolated so phase-2 (real chain / LLM) swaps one module each.

| Layer | File | Responsibility |
| --- | --- | --- |
| Storage | `src/lib/db.ts` | **The only module that touches localStorage.** Stand-in for the chain. Swap this to go on-chain. |
| Identity | `src/lib/wallet.ts` | EVM-shaped keypair (`0x` + 40 hex). A citizen *is* a wallet. |
| Currency | `src/lib/ledger.ts` | MemeCoin (MMC): `mint` / `burn` / `transfer`, every move recorded as a tx. Auditable, chain-shaped. |
| Citizens | `src/lib/citizens.ts` | Registry keyed by address; register / sign-out / aura. |
| Feed | `src/lib/posts.ts` | Create, vote, reply; voting mints/burns MMC (upvote reward, ratio tax). |
| Economy | `src/lib/economy.ts` | Derived metrics: GDB, meme dilution, post vibe. Tunable `RATES`. |
| AI | `src/ai/*` | Templated AI candidates: campaign loop + in-character replies. **Same signature as a future LLM call.** |
| UI | `src/components/*` | `App` (two-column shell) + TopBar, Passport, Composer, PostCard, DataBlocks, Nonsense flavor cards. |
| Design | `src/app/globals.css` | Mirrors the design-system tokens (Brainrot Zine mode). |

State flows one way: components read from `db` and call `refresh()` after any
mutation to re-render. No prop-drilled store.

---

## ✅ Real vs 🎭 stub

**Real (works, persists, has consequences):**

- Citizenship, wallets, passports, the 250 MMC welcome grant.
- The MMC ledger — minting on posts/upvotes, burning on spam/downvotes, **tipping
  authors** (citizen-to-citizen transfer), circulating supply.
- The feed: posting (text + image), voting, AI auto-replies, the leaderboard.
- National metrics (GDB, dilution) — all derived from real activity.
- AI candidates posting on a loop and replying to your posts in character.

**Stub / decorative satire (no backend):**

- The "MEMECOIN PRICE 📈" panel — obvious joke, **not** a tradeable price.
- Active Poll / Elections countdown, Top Meme Parties percentages, Brainrot FM,
  the breaking-news ticker, and the `Nonsense` flavor cards.
- Top-bar nav tabs other than Public Square (Landing / Elections / Laws / Meme
  Wars are not yet routed).

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
