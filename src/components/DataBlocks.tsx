import { db } from "@/lib/db";
import { citizensById, me } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import { grossDomesticBrainrot, memeDilution } from "@/lib/economy";
import { leaderboard, allPosts } from "@/lib/posts";
import { vibeOf } from "@/lib/economy";
import { shortAddress } from "@/lib/wallet";
import { getCitizen } from "@/lib/citizens";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { useEffect, useState } from "react";

export function Dashboard() {
  const gdb = grossDomesticBrainrot();
  const dilution = memeDilution();
  const supply = ledger.circulatingSupply();
  const state = db.get();
  const history = state.gdbHistory || [];
  const totalCitizens = Object.keys(state.citizens).length;

  // Generate SVG path for a tiny zine-style GDB trend line
  const renderSparkline = () => {
    if (history.length < 2) return null;
    const values = history.map(h => h.gdb);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const width = 100;
    const height = 24;
    const points = history.map((h, i) => {
      const x = (i / (history.length - 1)) * width;
      const y = height - ((h.gdb - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    }).join(" ");

    return (
      <div style={{ marginTop: 12, borderTop: "1px dashed var(--ink-soft)", paddingTop: 8 }}>
        <div className="mono" style={{ fontSize: 9, color: "var(--ink-soft)", marginBottom: 4 }}>GDB TREND</div>
        <svg width="100%" height="24" style={{ overflow: "visible" }}>
          <polyline
            fill="none"
            stroke="var(--purple)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    );
  };

  return (
    <div className="paper p-white binder-clip">
      <span className="card-title">📊 NATIONAL DASHBOARD</span>
      <div className="hand" style={{ fontSize: 16, color: "var(--ink-soft)" }}>gross domestic brainrot</div>
      <div className="bignum">{gdb.toLocaleString()}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        <span className={`sticker ${dilution > 40 ? "s-pink" : "s-lime"}`}>💧 dilution {dilution}%</span>
        <span className="sticker s-purple">🪙 supply {supply.toLocaleString()}</span>
        <span className="sticker s-yellow">🧍 citizens {totalCitizens}</span>
      </div>
      {renderSparkline()}
    </div>
  );
}

export function ActivePoll() {
  const [timeStr, setTimeStr] = useState("soon™");
  const citizen = me();
  const activeProps = governance.allProposals().filter((p) => p.status === "active");
  const topProp = activeProps[0]; // show top active proposal
  const election = elections.getElection();

  useEffect(() => {
    const timer = setInterval(() => {
      const ms = election.endsAt - Date.now();
      if (ms > 0) {
        const mins = Math.floor(ms / 60000);
        const secs = Math.floor((ms % 60000) / 1000);
        setTimeStr(`${mins}m ${secs}s`);
      } else {
        setTimeStr("Resolving...");
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [election.endsAt]);

  const handleVote = (voteType: "yes" | "no") => {
    if (!citizen) return;
    if (!topProp) return;
    governance.vote(topProp.id, citizen.address, voteType);
    // Re-render via the nation-update event instead of a jarring full reload.
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nation-update"));
    }
  };

  const totalVotes = topProp ? topProp.yesVotes.length + topProp.noVotes.length : 0;
  const yesPercent = totalVotes > 0 ? Math.round((topProp.yesVotes.length / totalVotes) * 100) : 50;
  const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;

  return (
    <div className="paper p-yellow pin">
      <span className="card-title">🗳️ ACTIVE POLL</span>
      {topProp ? (
        <>
          <p className="marker" style={{ fontSize: 16, marginBottom: 8 }}>{topProp.title}</p>
          <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
            {topProp.description.slice(0, 100)}{topProp.description.length > 100 ? "..." : ""}
          </p>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14 }}>
              <span>✅ yes ({topProp.yesVotes.length})</span>
              <span>{yesPercent}%</span>
            </div>
            <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${yesPercent}%` }} /></div>
            
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 14, marginTop: 8 }}>
              <span>❌ no ({topProp.noVotes.length})</span>
              <span>{noPercent}%</span>
            </div>
            <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${noPercent}%`, background: "var(--bad)" }} /></div>
          </div>

          {citizen && (
            <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
              <button
                className={`btn lime sm ${topProp.yesVotes.includes(citizen.address) ? "" : "ghost"}`}
                style={{ flex: 1 }}
                onClick={() => handleVote("yes")}
              >
                Vote YES
              </button>
              <button
                className={`btn red sm ${topProp.noVotes.includes(citizen.address) ? "" : "ghost"}`}
                style={{ flex: 1 }}
                onClick={() => handleVote("no")}
              >
                Vote NO
              </button>
            </div>
          )}
        </>
      ) : (
        <p className="hand" style={{ fontSize: 15, color: "var(--ink-soft)", marginBottom: 14 }}>
          No active proposals. File one in the Government tab! 🏛️
        </p>
      )}

      <hr className="rule" />
      <div className="hand" style={{ fontSize: 15, color: "var(--ink-soft)" }}>🔴 next meme election in</div>
      <div className="poster" style={{ fontSize: 24, color: "var(--bad)" }}>
        {timeStr}
      </div>
    </div>
  );
}

const PARTIES = [
  { n: "GBP", d: "global brainrot party", s: 69 },
  { n: "Rizz Party", d: "make rizz great again", s: 24 },
  { n: "Nap Party", d: "naps > everything", s: 18 },
];
export function Parties() {
  return (
    <div className="paper p-lime paper-clip">
      <span className="card-title">🏆 TOP MEME PARTIES</span>
      {PARTIES.map((p) => (
        <div key={p.n} style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
            <span>{p.n} <span className="hand" style={{ fontSize: 13, color: "var(--ink-soft)" }}>· {p.d}</span></span>
            <b>{p.s}%</b>
          </div>
          <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${p.s}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export function Leaderboard() {
  const board = leaderboard(citizensById(), 5);
  return (
    <div className="paper p-cyan taped tape-blue">
      <span className="card-title">🏆 TOP SHITPOSTERS</span>
      {board.length === 0 && <p className="hand">no vibes yet. post something, citizen.</p>}
      {board.map((r, i) => (
        <div key={r.citizen.address} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          <b className="poster" style={{ width: 20 }}>{i + 1}</b>
          <span>{r.citizen.pfp}</span>
          <span className="marker" style={{ flex: 1, fontSize: 14, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.citizen.username}{r.citizen.isAI && " 🤖"}</span>
          <span className={`sticker flat ${r.vibe >= 0 ? "s-lime" : "s-pink"}`}>{r.vibe}</span>
        </div>
      ))}
    </div>
  );
}

export function Ledger() {
  const txs = ledger.recentTxs(6);
  return (
    <div className="paper dark">
      <span className="card-title" style={{ color: "var(--lime)" }}>🪙 MEMECOIN LEDGER</span>
      {txs.length === 0 && <p className="hand" style={{ color: "var(--bone-soft)" }}>no moves yet.</p>}
      {txs.map((t) => (
        <div key={t.id} className="txrow">
          <span>{t.type === "mint" ? "🟢 MINT " : t.type === "burn" ? "🔴 BURN " : "🔁 SEND "}{shortAddress(t.type === "mint" ? t.to : t.from)}</span>
          <span style={{ color: t.type === "burn" ? "var(--bad)" : "var(--lime)" }}>{t.type === "burn" ? "−" : "+"}{t.amount}</span>
        </div>
      ))}
    </div>
  );
}

export function TopMeme() {
  const enacted = governance.allProposals().filter((p) => p.status === "enacted");
  const latestLaw = enacted[0]; // get latest passed proposal

  const posts = allPosts();
  const topPost = [...posts].sort((a, b) => vibeOf(b) - vibeOf(a))[0];
  const postAuthor = topPost ? getCitizen(topPost.author) : null;

  if (latestLaw) {
    const creator = getCitizen(latestLaw.creator);
    return (
      <div className="paper p-pink taped tape-pink">
        <span className="card-title">⚖️ CONSTITUTIONAL LAW</span>
        <p className="marker" style={{ fontSize: 17, color: "var(--purple)" }}>{latestLaw.title}</p>
        <p className="hand" style={{ fontSize: 15, marginTop: 6 }}>{latestLaw.description}</p>
        <hr className="rule" />
        <div className="hand" style={{ fontSize: 14, color: "var(--ink-soft)" }}>
          — proposed by {creator?.username ?? "???"}, enacted by referendum
        </div>
      </div>
    );
  }

  return (
    <div className="paper p-pink taped tape-pink">
      <span className="card-title">👑 TODAY&apos;S TOP MEME (IS LAW)</span>
      {topPost ? (
        <>
          {topPost.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={topPost.image} alt="top meme" style={{ maxWidth: "100%", borderRadius: 4, border: "var(--b)" }} />
          )}
          <p className="marker" style={{ fontSize: 16, marginTop: 8, overflowWrap: "anywhere" }}>{topPost.text || "(an image so powerful it needs no words)"}</p>
          <div className="hand" style={{ fontSize: 15, color: "var(--ink-soft)" }}>— by {postAuthor?.username ?? "???"}, now legally binding ⚖️</div>
        </>
      ) : (
        <p className="hand">no laws yet. post the first one.</p>
      )}
    </div>
  );
}

