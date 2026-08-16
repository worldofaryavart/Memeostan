"use client";

import type { Citizen } from "@/lib/types";
import { ledger } from "@/lib/ledger";
import { shortAddress } from "@/lib/wallet";
import { exportWallet } from "@/lib/citizens";

const BADGE_EMOJIS: Record<string, string> = {
  badge_certified_rizzler: "👑",
  badge_sigma_chad: "🗿",
  badge_brainrot_veteran: "👽",
  badge_chief_vibes_officer: "🏛️",
};

const FACTION_EMOJIS: Record<string, string> = {
  "Sigma": "🗿",
  "NPC": "🫠",
  "Rizzler": "👑",
  "Brainrot Veteran": "👽",
  "Meme Lord": "🐸",
};

const CITY_EMOJIS: Record<string, string> = {
  "Brainrot City": "🧠",
  "Neo Ohio": "🗿",
  "Rizzland": "👑",
  "Napistan": "😴",
};

const PARTY_EMOJIS: Record<string, string> = {
  "Global Brainrot Party": "🟢",
  "United Rizz Federation": "💗",
  "Skibidi Doo Party": "💎",
};

const getFactionEmoji = (f: string) => FACTION_EMOJIS[f] || "🚩";
const getCityEmoji = (c: string) => CITY_EMOJIS[c] || "🏙️";
const getPartyEmoji = (p: string) => PARTY_EMOJIS[p] || "🗳️";

// MEME PASSPORT — a paper ID card with the brand gradient band on top.
export default function Passport({ citizen }: { citizen: Citizen }) {
  const isPreview = citizen.address === "0xapplied...for...citizenship";
  const balance = isPreview ? 250 : ledger.balanceOf(citizen.address);
  const isImg = citizen.pfp.startsWith("data:") || citizen.pfp.startsWith("/");

  const handleBackup = () => {
    const json = exportWallet();
    if (json) {
      navigator.clipboard.writeText(json);
      alert("Backup JSON copied to clipboard! Keep it secret, keep it safe. 🤫");
    } else {
      alert("This browser doesn't hold a citizenship key to back up.");
    }
  };

  const badgeEmoji = citizen.equippedBadge ? BADGE_EMOJIS[citizen.equippedBadge] : "";
  const borderClass = citizen.equippedBorder ? `pfp-border-${citizen.equippedBorder.replace("border_", "")}` : "";

  // Calculate dynamic brainrot rank based on aura levels
  let statusRank = "DEFAULT NPC 🫠";
  let statusColor = "var(--ink-soft)";
  if (citizen.aura >= 1500) {
    statusRank = "GIGACHAD 🗿";
    statusColor = "var(--lime)";
  } else if (citizen.aura >= 1200) {
    statusRank = "RIZZLER 👑";
    statusColor = "var(--pink)";
  } else if (citizen.aura >= 1000) {
    statusRank = "SIGMA 🤫";
    statusColor = "var(--purple)";
  } else if (citizen.aura >= 800) {
    statusRank = "NPC 🫠";
    statusColor = "var(--blue)";
  } else {
    statusRank = "RATIO VICTIM 💀";
    statusColor = "var(--bad)";
  }

  // Badges class naming
  const factionClass = citizen.faction ? `badge-faction-${citizen.faction.toLowerCase().replace(/\s+/g, "_")}` : "badge-faction-default";
  const cityClass = citizen.city ? `badge-city-${citizen.city.toLowerCase().replace(/\s+/g, "_")}` : "badge-city-default";
  const partyClass = citizen.party ? `badge-party-${citizen.party.toLowerCase().replace(/\s+/g, "_")}` : "badge-party-default";

  // Dynamic stamp based on faction
  let factionStamp = "RATIO APPROVED 🐱";
  let stampColor = "var(--bad)";
  if (citizen.faction === "Sigma") {
    factionStamp = "MEWING STREAK: ACTIVE 🤫";
    stampColor = "#8cbf00";
  } else if (citizen.faction === "NPC") {
    factionStamp = "NPC LICENSE: GRANTED 🤖";
    stampColor = "var(--purple-deep)";
  } else if (citizen.faction === "Rizzler") {
    factionStamp = "RIZZ REGISTERED 👑";
    stampColor = "var(--pink)";
  } else if (citizen.faction === "Brainrot Veteran") {
    factionStamp = "BRAIN CELL COUNT: 0 👽";
    stampColor = "var(--cyan)";
  } else if (citizen.faction === "Meme Lord") {
    factionStamp = "MEME CERTIFIED 🐸";
    stampColor = "var(--yellow)";
  }

  return (
    <div className={`paper passport tilt-r faction-${citizen.faction?.replace(/\s+/g, "_") || "default"}`} style={{ position: "relative" }}>
      <style>{`
        @keyframes neon-pulse-border {
          0% { box-shadow: 0 0 5px #b4f000, 0 0 10px #b4f000; border-color: #b4f000 !important; }
          50% { box-shadow: 0 0 20px #ff5db1, 0 0 25px #ff5db1; border-color: #ff5db1 !important; }
          100% { box-shadow: 0 0 5px #b4f000, 0 0 10px #b4f000; border-color: #b4f000 !important; }
        }
        @keyframes holo-glow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .pfp-border-neon_rainbow {
          animation: neon-pulse-border 2s infinite linear;
          border: 3px solid #b4f000 !important;
        }
        .pfp-border-gold_foil {
          border: 3px double #ffd60a !important;
          box-shadow: 0 0 12px #ffd60a !important;
        }
        .pfp-border-retro_cyber {
          border: 3px dashed #2ee6ff !important;
          background: rgba(46, 230, 255, 0.1) !important;
        }
        .passport .band.holo-band {
          background: linear-gradient(110deg, #ff007f, #00f0ff, #39ff14, #ffee00, #ff007f) !important;
          background-size: 400% 400% !important;
          animation: holo-glow 6s infinite linear !important;
          border-bottom: var(--b) !important;
          color: #0f0b1a !important;
        }

        /* Faction Passport Themes */
        .passport.faction-Sigma {
          background: #f2ffd0 !important;
          border: 3px solid #000 !important;
          box-shadow: 6px 6px 0 #000, 0 0 15px rgba(180, 240, 0, 0.45) !important;
        }
        .passport.faction-NPC {
          background: #f3ebff !important;
          border: 3px solid #000 !important;
          box-shadow: 6px 6px 0 #000, 0 0 15px rgba(176, 92, 255, 0.45) !important;
        }
        .passport.faction-Rizzler {
          background: #ffe6f0 !important;
          border: 3px solid #000 !important;
          box-shadow: 6px 6px 0 #000, 0 0 15px rgba(255, 93, 177, 0.45) !important;
        }
        .passport.faction-Brainrot_Veteran {
          background: #e6faff !important;
          border: 3px solid #000 !important;
          box-shadow: 6px 6px 0 #000, 0 0 15px rgba(46, 230, 255, 0.45) !important;
        }
        .passport.faction-Meme_Lord {
          background: #fffee0 !important;
          border: 3px solid #000 !important;
          box-shadow: 6px 6px 0 #000, 0 0 15px rgba(255, 214, 10, 0.45) !important;
        }

        /* Passport Badges */
        .badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 2px 6px;
          font-size: 9px;
          font-family: var(--mono);
          font-weight: bold;
          border-radius: 4px;
          border: 1.5px solid var(--bc);
          box-shadow: 1px 1px 0 rgba(0,0,0,0.8);
          white-space: nowrap;
        }
        
        .badge-faction-sigma { background: var(--lime); color: #070a04; }
        .badge-faction-npc { background: var(--purple); color: #fff; }
        .badge-faction-rizzler { background: var(--pink); color: #fff; }
        .badge-faction-brainrot_veteran { background: var(--cyan); color: #070a04; }
        .badge-faction-meme_lord { background: var(--yellow); color: #070a04; }
        
        .badge-city-brainrot_city { background: #ece0ff; color: var(--purple-deep); border-style: dashed; }
        .badge-city-neo_ohio { background: #e2fcd4; color: #1e3d06; border-style: dashed; }
        .badge-city-rizzland { background: #ffe0f0; color: #b0005d; border-style: dashed; }
        .badge-city-napistan { background: #e0f7fc; color: #005a70; border-style: dashed; }
        
        .badge-party-global_brainrot_party { background: #0f0b1a; color: var(--lime); border-color: var(--lime); }
        .badge-party-united_rizz_federation { background: #0f0b1a; color: var(--pink); border-color: var(--pink); }
        .badge-party-skibidi_doo_party { background: #0f0b1a; color: var(--cyan); border-color: var(--cyan); }
        
        .badge-faction-default { background: var(--paper-2); color: var(--ink); }
        .badge-city-default { background: var(--paper-2); color: var(--ink); border-style: dashed; }
        .badge-party-default { background: var(--paper-2); color: var(--ink); }
      `}</style>

      <div className="band holo-band" style={{ padding: "10px 16px" }}>
        <div className="left" style={{ fontFamily: "var(--poster)", fontSize: 13, lineHeight: 0.9, color: "inherit" }}>
          REP. OF<br />OHIO 🌽
        </div>
        <div className="right" style={{ fontFamily: "var(--poster)", fontSize: 12, textAlign: "right", color: "inherit" }}>
          SKIBIDI<br />GYATT-PORT 🛂
        </div>
      </div>

      <div className="pbody" style={{ position: "relative" }}>
        {/* Rubber Stamp Overlay */}
        <div style={{
          position: "absolute",
          bottom: 24,
          right: 8,
          border: `2.5px double ${stampColor}`,
          borderRadius: "4px",
          color: stampColor,
          fontSize: 9,
          fontWeight: "bold",
          fontFamily: "var(--marker)",
          padding: "1px 5px",
          transform: "rotate(-14deg) scale(1.05)",
          opacity: 0.82,
          pointerEvents: "none",
          background: "var(--paper)",
          boxShadow: `0 0 5px ${stampColor}33`,
          zIndex: 10
        }}>
          {factionStamp}
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <div className={`pfp ${borderClass}`}>
            {isImg ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={citizen.pfp} alt={citizen.username} />
            ) : (
              citizen.pfp
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="poster" style={{ fontSize: 24, lineHeight: 0.95, wordBreak: "break-word", display: "flex", alignItems: "center", gap: 6, color: "var(--ink)" }}>
              {citizen.username} {badgeEmoji && <span title={citizen.equippedBadge}>{badgeEmoji}</span>}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
              <span className="sticker s-purple flat" style={{ padding: "2px 6px", fontSize: 9 }}>
                {citizen.isAI ? "🏛️ STATE OFFICE" : "🧑 CITIZEN"}
              </span>
              <span className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", fontWeight: "bold" }}>
                streak: active 🤫
              </span>
            </div>
          </div>
        </div>

        {/* Faction, City & Party Badges */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
          <span className={`badge ${factionClass}`}>
            {getFactionEmoji(citizen.faction)} {citizen.faction || "No Faction"}
          </span>
          {citizen.city && (
            <span className={`badge ${cityClass}`}>
              {getCityEmoji(citizen.city)} {citizen.city}
            </span>
          )}
          {citizen.party && (
            <span className={`badge ${partyClass}`}>
              {getPartyEmoji(citizen.party)} {citizen.party}
            </span>
          )}
        </div>

        <div className="stat-tiles" style={{ marginTop: 12 }}>
          <div className="stat-tile" style={{ padding: "6px 8px" }}>
            <div className="l" style={{ fontSize: 8 }}>AURA LEVEL</div>
            <div className="v" style={{ fontSize: 16 }}>{citizen.aura.toLocaleString()}</div>
          </div>
          <div className="stat-tile" style={{ padding: "6px 8px" }}>
            <div className="l" style={{ fontSize: 8 }}>MMC BALANCE</div>
            <div className="v" style={{ fontSize: 16, color: "var(--purple-deep)" }}>{balance.toLocaleString()}</div>
          </div>
          <div className="stat-tile" style={{ padding: "6px 8px" }}>
            <div className="l" style={{ fontSize: 8 }}>VIBE RANK</div>
            <div className="v" style={{ fontSize: 13, color: statusColor, fontFamily: "var(--poster)" }}>{statusRank}</div>
          </div>
        </div>

        {/* Welcome Grant Banner */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
          background: "rgba(180, 240, 0, 0.12)",
          border: "2px dashed var(--lime)",
          borderRadius: "6px",
          padding: "4px 8px",
          boxShadow: "inset 0 0 4px rgba(180, 240, 0, 0.1)"
        }}>
          <span className="mono" style={{ fontSize: 8, color: "var(--ink)", fontWeight: "bold" }}>
            🎁 WELCOME GRANT:
          </span>
          <span className="poster" style={{ fontSize: 11, color: "var(--ink)", textTransform: "uppercase" }}>
            250 MMC (CLAIMED ✅)
          </span>
        </div>

        <div style={{ marginTop: 12, position: "relative" }}>
          <div className="mono" style={{ fontSize: 7, color: "var(--ink-soft)", textAlign: "center", marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.5 }}>
            ⚠️ warnings: grass touching strictly prohibited
          </div>
          <div className="barcode" style={{ height: 32 }} aria-hidden />
          <div className="mono" style={{ fontSize: 8, color: "var(--ink)", textAlign: "center", marginTop: 2, letterSpacing: 1.2, fontWeight: "bold" }}>
            SKIBIDI-69-RIZZ-420-OHIO
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
          <div className="mono" style={{ fontSize: 9, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Wallet · {shortAddress(citizen.address)}
          </div>
          {!citizen.isAI && (
            <button className="btn ghost sm" style={{ padding: "2px 6px", fontSize: 9, border: "2px solid var(--bc)", boxShadow: "2px 2px 0 rgba(0,0,0,0.8)" }} onClick={handleBackup}>
              💾 Backup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


