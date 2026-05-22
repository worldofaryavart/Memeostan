"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { me, signOut } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import { shortAddress } from "@/lib/wallet";

const TABS = [
  { label: "📣 Public Square", href: "/square" },
  { label: "🏛️ Government", href: "/government", live: true },
  { label: "🏙️ Cities", href: "/cities" },
  { label: "🛍️ Market", href: "/market" },
  { label: "📜 Ledger", href: "/ledger" },
];

// The product top bar (Brainrot Zine): wordmark + in-world nav, plus the
// signed-in citizen's MMC balance, wallet, and the Renounce (sign-out) button.
export default function TopBar({ refresh }: { refresh: () => void }) {
  const pathname = usePathname();
  const citizen = me();
  const balance = citizen ? ledger.balanceOf(citizen.address) : 0;

  const renounce = () => {
    signOut();
    refresh();
  };

  return (
    <header className="topbar">
      <Link href={citizen ? "/square" : "/"} className="brandmark" style={{ textDecoration: "none" }}>
        <span className="flag">🧠</span>
        <div className="wordmark">
          <div className="top">UNITED</div>
          <div className="bot">MEMEOSTAN</div>
          <div className="tag">one world. one meme.</div>
        </div>
      </Link>

      <nav className="nav">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link key={t.label} href={t.href} className="navtab" data-active={active ? "1" : undefined}>
              {t.label}
              {t.live && <span className="live">LIVE</span>}
            </Link>
          );
        })}
      </nav>

      {citizen && (
        <div className="topbar-right">
          <span className="sticker s-lime">🪙 {balance.toLocaleString()} MMC</span>
          <Link href={`/citizen/${citizen.address}`} className="wallet-chip" style={{ textDecoration: "none" }}>
            {shortAddress(citizen.address)}
          </Link>
          <button className="btn ghost sm" onClick={renounce}>Renounce</button>
        </div>
      )}
    </header>
  );
}

