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

// MEME PASSPORT — a paper ID card with the brand gradient band on top.
export default function Passport({ citizen }: { citizen: Citizen }) {
  const balance = ledger.balanceOf(citizen.address);
  const isImg = citizen.pfp.startsWith("data:") || citizen.pfp.startsWith("/");

  const handleBackup = () => {
    const json = exportWallet(citizen.address);
    if (json) {
      navigator.clipboard.writeText(json);
      alert("Backup JSON copied to clipboard! Keep it secret, keep it safe. 🤫");
    }
  };

  const badgeEmoji = citizen.equippedBadge ? BADGE_EMOJIS[citizen.equippedBadge] : "";
  const borderClass = citizen.equippedBorder ? `pfp-border-${citizen.equippedBorder.replace("border_", "")}` : "";

  return (
    <div className="paper passport tilt-r">
      <style>{`
        @keyframes neon-pulse-border {
          0% { box-shadow: 0 0 5px #b4f000, 0 0 10px #b4f000; border-color: #b4f000 !important; }
          50% { box-shadow: 0 0 20px #ff5db1, 0 0 25px #ff5db1; border-color: #ff5db1 !important; }
          100% { box-shadow: 0 0 5px #b4f000, 0 0 10px #b4f000; border-color: #b4f000 !important; }
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
      `}</style>

      <div className="band">
        <div className="left">UNITED<br />MEMEOSTAN</div>
        <div className="right">MEME<br />PASSPORT 🛂</div>
      </div>

      <div className="pbody">
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
            <div className="poster" style={{ fontSize: 24, lineHeight: 0.95, wordBreak: "break-word", display: "flex", alignItems: "center", gap: 6 }}>
              {citizen.username} {badgeEmoji && <span title={citizen.equippedBadge}>{badgeEmoji}</span>}
            </div>
            <span className="sticker s-purple" style={{ marginTop: 6 }}>
              {citizen.isAI ? "🤖 " : ""}{citizen.faction}
            </span>
          </div>
        </div>

        <div className="stat-tiles">
          <div className="stat-tile">
            <div className="l">Aura</div>
            <div className="v">{citizen.aura.toLocaleString()}</div>
          </div>
          <div className="stat-tile">
            <div className="l">MMC</div>
            <div className="v">{balance.toLocaleString()}</div>
          </div>
          <div className="stat-tile">
            <div className="l">Status</div>
            <div className="v" style={{ fontSize: 15 }}>{citizen.isAI ? "AI" : "CITIZEN"}</div>
          </div>
        </div>

        <div className="barcode" style={{ marginTop: 14 }} aria-hidden />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", textTransform: "uppercase", letterSpacing: 0.6 }}>
            Wallet · {shortAddress(citizen.address)}
          </div>
          {!citizen.isAI && (
            <button className="btn ghost sm" style={{ padding: "2px 6px", fontSize: 10 }} onClick={handleBackup}>
              💾 Backup
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


