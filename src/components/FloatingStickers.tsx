"use client";

import Art from "./Art";

// Peak-Brainrot margin sticker layer. Renders animated PNG stickers (with emoji
// fallback via <Art>) scattered down the page gutters. Lives inside a
// position:relative ".shell" so the negative offsets sit in the margins; on
// smaller screens globals.css fades these to faint background graffiti.
//
// "Max chaos everywhere" — every in-world page mounts one of these with its own
// themed preset so the whole country feels alive, not just the landing page.

export interface Sticker {
  src: string;
  fallback: string; // emoji shown if the PNG is missing
  anim: string;     // anim-* class from globals.css
  side: "left" | "right";
  offset: number;   // px outset past the shell edge (negative = into margin)
  top: number;      // px from the top of the shell
  width: number;
  rot: number;      // base rotation, fed to the keyframes via --rot
  nyan?: boolean;   // wrap in the nyan fly+bob combo
}

// compact builder to keep the presets readable
const S = (
  side: "left" | "right",
  top: number,
  offset: number,
  width: number,
  rot: number,
  src: string,
  fallback: string,
  anim: string,
  nyan = false,
): Sticker => ({ side, top, offset, width, rot, src, fallback, anim, nyan });

// The landing-style firehose — used by the Public Square feed (long page).
export const STICKER_POOL: Sticker[] = [
  S("left",  120,  -90, 170,  -8, "/art/globe-shades.png",      "🌐", "anim-bob"),
  S("right", 100,  -40, 150,  12, "/art/memecoin.png",          "🪙", "anim-spin"),
  S("left",  460,    0, 200,   5, "/art/pixel-nyancat.png",     "🐱", "anim-nyan-fly", true),
  S("right", 600, -190, 180, -10, "/art/politician-doge.png",   "🐶", "anim-wiggle"),
  S("left",  940, -180, 165,  -3, "/art/retro-creeper.png",     "👾", "anim-pulse-swell"),
  S("right",1080, -180, 175,  15, "/art/skate-fast.png",        "🛹", "anim-float"),
  S("left", 1440, -200, 190, -12, "/art/skating-astronaut.png", "🧑‍🚀","anim-orbit-drift"),
  S("right",1600, -180, 165,   8, "/art/sunglasses-cat.png",    "😎", "anim-wiggle"),
  S("left", 2000, -190, 175,  -6, "/art/tactical-raccon.png",   "🦝", "anim-float"),
  S("right",2200, -200, 185,  18, "/art/trollface-sticker.png", "🗿", "anim-chaotic-shake"),
  S("left", 2500, -210, 200,   2, "/art/windoes-warning.png",   "🪟", "anim-bob"),
  S("right",2700, -150, 160,  -7, "/art/frog-gbp.png",          "🐸", "anim-bob"),
];

// Themed presets per in-world page (shorter pages → fewer, higher stickers).
export const STICKER_PRESETS: Record<string, Sticker[]> = {
  square: STICKER_POOL,

  government: [
    S("left",  120,  -90, 170,  -8, "/art/politician-doge.png",  "🐶", "anim-bob"),
    S("right", 110,  -40, 150,  12, "/art/frog-gbp.png",         "🐸", "anim-wiggle"),
    S("left",  520, -180, 165,  -5, "/art/manifesto-scroll.png", "📜", "anim-float"),
    S("right", 640, -180, 170,  10, "/art/vote-meme-stamp.png",  "🗳️", "anim-pulse-swell"),
    S("left", 1040, -190, 180, -10, "/art/party-gbp-logo.png",   "🟢", "anim-orbit-drift"),
    S("right",1180, -180, 165,   8, "/art/trollface-sticker.png","🗿", "anim-chaotic-shake"),
    S("left", 1560, -200, 175,  -4, "/art/seal-national.png",    "🦅", "anim-bob"),
  ],

  market: [
    S("right", 100,  -40, 160,  12, "/art/memecoin.png",      "🪙", "anim-spin"),
    S("left",  140,  -90, 170,  -8, "/art/nft.png",           "🖼️", "anim-bob"),
    S("right", 560, -180, 165,   9, "/art/banana-glow.png",   "🍌", "anim-pulse-swell"),
    S("left",  620, -180, 170,  -6, "/art/air-can.png",       "🥫", "anim-float"),
    S("right",1060, -180, 165,  11, "/art/weather-storm.png", "🌩️", "anim-wiggle"),
    S("left", 1120, -190, 180, -10, "/art/globe-shades.png",  "🌐", "anim-orbit-drift"),
  ],

  cities: [
    S("left",  120,  -90, 180,  -8, "/art/memeostan-map.png", "🗺️", "anim-bob"),
    S("right", 110,  -40, 160,  12, "/art/crest-ohio.png",    "🐮", "anim-wiggle"),
    S("left",  540, -180, 165,  -5, "/art/sigma.png",         "🗿", "anim-pulse-swell"),
    S("right", 620, -180, 170,  10, "/art/rizz.png",          "😏", "anim-float"),
    S("left", 1040, -190, 175, -10, "/art/nap.png",           "😴", "anim-orbit-drift"),
    S("right",1160, -180, 170,   8, "/art/meme-war.png",      "⚔️", "anim-chaotic-shake"),
  ],

  court: [
    S("left",  120,  -90, 170,  -8, "/art/raccon-court-meme.png", "🦝", "anim-bob"),
    S("right", 110,  -40, 150,  12, "/art/cat.png",              "🐱", "anim-wiggle"),
    S("left",  540, -180, 165,  -5, "/art/tombstone.png",        "🪦", "anim-float"),
    S("right", 640, -180, 170,  10, "/art/warning-brain.png",    "🧠", "anim-pulse-swell"),
    S("left", 1040, -190, 180, -10, "/art/trollface-sticker.png","🗿", "anim-chaotic-shake"),
    S("right",1160, -180, 165,   8, "/art/stamp-ratified.png",   "✅", "anim-bob"),
  ],

  ledger: [
    S("right", 100,  -40, 160,  12, "/art/memecoin.png",     "🪙", "anim-spin"),
    S("left",  140,  -90, 170,  -8, "/art/globe-shades.png", "🌐", "anim-bob"),
    S("right", 560, -180, 160,   9, "/art/nft.png",          "🖼️", "anim-pulse-swell"),
    S("left",  640, -180, 170,  -6, "/art/air.png",          "💨", "anim-float"),
    S("right",1060, -180, 165,  11, "/art/banana-glow.png",  "🍌", "anim-wiggle"),
  ],

  citizen: [
    S("left",  120,  -90, 170,  -8, "/art/sunglasses-cat.png",  "😎", "anim-bob"),
    S("right", 110,  -40, 150,  12, "/art/globe-shades.png",    "🌐", "anim-wiggle"),
    S("left",  540, -180, 165,  -5, "/art/politician-doge.png", "🐶", "anim-float"),
    S("right", 640, -180, 170,  10, "/art/retro-creeper.png",   "👾", "anim-pulse-swell"),
    S("left", 1040, -190, 175, -10, "/art/memecoin.png",        "🪙", "anim-orbit-drift"),
  ],
};

export default function FloatingStickers({
  preset = "square",
  stickers,
}: {
  preset?: string;
  stickers?: Sticker[];
}) {
  const set = stickers ?? STICKER_PRESETS[preset] ?? STICKER_POOL;
  return (
    <>
      {set.map((s, i) => {
        const pos = s.side === "left" ? { left: `${s.offset}px` } : { right: `${s.offset}px` };
        const inner = (
          <Art src={s.src} alt="" fallback={<span style={{ fontSize: s.width * 0.6 }}>{s.fallback}</span>} />
        );
        return (
          <div
            key={`${s.src}-${i}`}
            aria-hidden
            className={`floating-sticker ${s.anim}`}
            style={{ ...pos, top: `${s.top}px`, width: `${s.width}px`, "--rot": `${s.rot}deg` } as unknown as React.CSSProperties}
          >
            {s.nyan ? <div className="anim-nyan-bob">{inner}</div> : inner}
          </div>
        );
      })}
    </>
  );
}
