"use client";

const HEADLINES = [
  "MEME WAR VICTORY AGAINST OHIO 🔥",
  "GOVERNMENT ANNOUNCES FREE WI-FI FOR CATS",
  "NEW LAW: 'CRINGE IS FREEDOM' PASSES 420-0",
  "CAT MEMES DECLARED NATIONAL TREASURE 🐱",
  "MINISTER OF NAP AFFAIRS UNREACHABLE (NAPPING)",
  "GDB CROSSES 420.69T FOR THE 420TH TIME",
];

export default function Ticker() {
  const line = HEADLINES.join("  ✶  ");
  return (
    <div className="ticker">
      <span className="label">📢 BREAKING MEME NEWS</span>
      <div className="run">{line} {"  ✶  "} {line}</div>
    </div>
  );
}
