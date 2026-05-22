"use client";

import { useState, useEffect } from "react";
import { useNation } from "@/components/useNation";
import { me, allCitizens, getCitizen } from "@/lib/citizens";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";

export default function GovernmentPage() {
  const { refresh } = useNation();
  const citizen = me();
  const activeProposals = governance.allProposals().filter((p) => p.status === "active");
  const enactedProposals = governance.allProposals().filter((p) => p.status === "enacted");
  const failedProposals = governance.allProposals().filter((p) => p.status === "failed");
  
  const election = elections.getElection();
  const ministers = allCitizens().filter((c) => c.isAI && c.running);

  // Proposal form state
  const [propTitle, setPropTitle] = useState("");
  const [propDesc, setPropDesc] = useState("");
  const [propError, setPropError] = useState<string | null>(null);

  // Election countdown timer
  const [timeStr, setTimeStr] = useState("soon™");

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

  const handleCreateProposal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizen) {
      setPropError("You must register a passport first!");
      return;
    }
    if (!propTitle.trim() || !propDesc.trim()) {
      setPropError("Please fill out all fields.");
      return;
    }
    
    const res = governance.createProposal(citizen.address, propTitle.trim(), propDesc.trim());
    if (res.ok) {
      setPropTitle("");
      setPropDesc("");
      setPropError(null);
      refresh();
    } else {
      setPropError(res.reason || "Failed to file proposal");
    }
  };

  const handleVoteProposal = (proposalId: string, type: "yes" | "no") => {
    if (!citizen) return;
    governance.vote(proposalId, citizen.address, type);
    refresh();
  };

  const handleVoteElection = (candidateAddr: string) => {
    if (!citizen) return;
    const res = elections.vote(citizen.address, candidateAddr);
    if (res.ok) {
      refresh();
    } else {
      alert(res.reason);
    }
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell">
        <section className="hero">
          <span className="kicker">the high chambers of memeostan</span>
          <h1>government &amp; direct democracy</h1>
          <div className="sub">file bills. elect AI ministers. pass supreme laws.</div>
        </section>

        <div className="cols">
          {/* LEFT: Proposals, Voting, Laws */}
          <div className="col-stack">
            {/* 1. Proposal Creator Form */}
            <div className="paper p-white binder-clip">
              <span className="card-title">📜 PROPOSE A CONSTITUTIONAL LAW</span>
              <p className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>
                Filing a proposal burns <strong style={{ color: "var(--bad)" }}>100 MMC</strong> to filter low-effort spam. If the referendum passes, you earn <strong style={{ color: "var(--good)" }}>+200 MMC</strong> and <strong style={{ color: "var(--purple)" }}>+50 Aura</strong>!
              </p>
              
              <form onSubmit={handleCreateProposal} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <input
                    type="text"
                    value={propTitle}
                    placeholder="Proposal Title (e.g. Mandatory 3 PM Nap Protocol)"
                    maxLength={60}
                    onChange={(e) => setPropTitle(e.target.value)}
                    style={{ width: "100%", padding: 10, fontSize: 14 }}
                  />
                </div>
                <div>
                  <textarea
                    rows={3}
                    value={propDesc}
                    placeholder="State your bill clearly. Faction affiliations will react automatically."
                    maxLength={300}
                    onChange={(e) => setPropDesc(e.target.value)}
                    style={{ width: "100%", padding: 10, fontSize: 14, resize: "vertical" }}
                  />
                </div>
                {propError && (
                  <div className="sticker s-pink" style={{ alignSelf: "flex-start", padding: "4px 8px" }}>
                    ⚠️ {propError}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn lime"
                  disabled={!citizen || !propTitle.trim() || !propDesc.trim()}
                  style={{ alignSelf: "flex-end" }}
                >
                  File Bill (-100 MMC) 🗳️
                </button>
              </form>
            </div>

            {/* 2. Active Bills (Referendums) */}
            <div className="paper p-yellow paper-clip">
              <span className="card-title">🗳️ ACTIVE REFERENDUMS</span>
              {activeProposals.length === 0 ? (
                <p className="hand" style={{ padding: "10px 0" }}>No active referendums. Propose a law above to begin governance!</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 10 }}>
                  {activeProposals.map((prop) => {
                    const totalVotes = prop.yesVotes.length + prop.noVotes.length;
                    const yesPercent = totalVotes > 0 ? Math.round((prop.yesVotes.length / totalVotes) * 100) : 50;
                    const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;
                    const propCreator = getCitizen(prop.creator);
                    const votedYes = citizen && prop.yesVotes.includes(citizen.address);
                    const votedNo = citizen && prop.noVotes.includes(citizen.address);

                    return (
                      <div key={prop.id} style={{ borderBottom: "2.5px dashed var(--ink-soft)", paddingBottom: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                          <h3 className="marker" style={{ fontSize: 18, color: "var(--purple)", margin: 0 }}>{prop.title}</h3>
                          <span className="sticker flat s-purple">ACTIVE</span>
                        </div>
                        <p className="hand" style={{ fontSize: 15, margin: "8px 0", color: "var(--ink)" }}>{prop.description}</p>
                        
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-soft)" }}>
                          <span>Proposed by: @{propCreator?.username || shortAddress(prop.creator)}</span>
                          <span>Expires in: {Math.max(0, Math.round((prop.endsAt - Date.now()) / 1000))}s</span>
                        </div>

                        <div style={{ marginTop: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                            <span>✅ YES ({prop.yesVotes.length})</span>
                            <span>{yesPercent}%</span>
                          </div>
                          <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${yesPercent}%` }} /></div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, marginTop: 8 }}>
                            <span>❌ NO ({prop.noVotes.length})</span>
                            <span>{noPercent}%</span>
                          </div>
                          <div className="bar" style={{ marginTop: 4 }}><i style={{ width: `${noPercent}%`, background: "var(--bad)" }} /></div>
                        </div>

                        {citizen && (
                          <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                            <button
                              className={`btn sm lime ${votedYes ? "" : "ghost"}`}
                              style={{ flex: 1 }}
                              onClick={() => handleVoteProposal(prop.id, "yes")}
                            >
                              {votedYes ? "✓ Voted YES" : "Vote YES"}
                            </button>
                            <button
                              className={`btn sm red ${votedNo ? "" : "ghost"}`}
                              style={{ flex: 1 }}
                              onClick={() => handleVoteProposal(prop.id, "no")}
                            >
                              {votedNo ? "✓ Voted NO" : "Vote NO"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Passed Laws (The Constitution) */}
            <div className="paper p-pink taped tape-pink">
              <span className="card-title">📜 CONSTITUTIONAL LAWS</span>
              {enactedProposals.length === 0 ? (
                <p className="hand" style={{ padding: "10px 0" }}>No laws have been passed yet. The country is currently in legal anarchy!</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                  {enactedProposals.map((prop) => {
                    const creator = getCitizen(prop.creator);
                    return (
                      <div key={prop.id} style={{ borderLeft: "4px solid var(--good)", paddingLeft: 12, margin: "6px 0" }}>
                        <div className="marker" style={{ fontSize: 16, color: "var(--purple-deep)" }}>{prop.title}</div>
                        <div className="hand" style={{ fontSize: 14, color: "var(--ink)", marginTop: 4 }}>{prop.description}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                          Enacted by Referendum · Proposed by @{creator?.username || shortAddress(prop.creator)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 4. Defeated Referendums */}
            {failedProposals.length > 0 && (
              <div className="paper p-dark staple" style={{ opacity: 0.75 }}>
                <span className="card-title" style={{ color: "var(--bad)" }}>❌ DEFEATED BILLS</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {failedProposals.map((prop) => (
                    <div key={prop.id} className="mono" style={{ fontSize: 12 }}>
                      <span style={{ textDecoration: "line-through" }}>{prop.title}</span> (Failed: {prop.yesVotes.length}Y / {prop.noVotes.length}N)
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Cabinet & Elections */}
          <aside className="col-stack">
            {/* Cabinet */}
            <div className="paper p-lime paper-clip">
              <span className="card-title">🏛️ THE CABINET</span>
              <div className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", marginBottom: 12 }}>
                Elected representatives running the digital bureaus.
              </div>
              {ministers.length === 0 ? (
                <p className="hand">Cabinet dissolved. An election is currently in progress.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ministers.map((m) => (
                    <div key={m.address} className="paper p-white staple-r" style={{ padding: 12 }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={{ fontSize: 28 }}>{m.pfp}</span>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div className="poster" style={{ fontSize: 14, lineHeight: 1 }}>{m.running}</div>
                          <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>@{m.username}</div>
                        </div>
                        <span className="sticker s-purple" style={{ fontSize: 10 }}>{m.faction}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Election widget */}
            <div className="paper p-cyan pin-center">
              <span className="card-title">🗳️ ELECTION BOOTH</span>
              <div className="hand" style={{ fontSize: 14, color: "var(--ink-soft)" }}>
                elections cycle every 5 minutes. vote weight = voter aura!
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, borderBottom: "2.5px solid var(--ink)", paddingBottom: 6 }}>
                <span className="hand" style={{ fontSize: 13, fontWeight: 700 }}>ELECTION RESOLVING IN:</span>
                <span className="poster blink" style={{ fontSize: 20, color: "var(--bad)" }}>{timeStr}</span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {election.candidates.map((candAddr) => {
                  const m = getCitizen(candAddr);
                  if (!m) return null;

                  // Tally current votes weight (Aura)
                  let weight = 0;
                  Object.entries(election.votes).forEach(([voterAddr, votedCandAddr]) => {
                    if (votedCandAddr === candAddr) {
                      const voter = getCitizen(voterAddr);
                      weight += voter ? voter.aura : 1000;
                    }
                  });

                  const isVoted = citizen && election.votes[citizen.address] === candAddr;

                  return (
                    <div key={candAddr} style={{ border: "2.5px solid var(--ink)", borderRadius: 6, padding: 10, background: "var(--bone)", display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontSize: 26 }}>{m.pfp}</span>
                          <div>
                            <div className="marker" style={{ fontSize: 14 }}>{m.username} {m.isAI && "🤖"}</div>
                            <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>{m.faction}</div>
                          </div>
                        </div>
                        <div className="poster" style={{ fontSize: 15, color: "var(--purple)" }}>{weight.toLocaleString()} AURA</div>
                      </div>

                      {citizen && (
                        <button
                          className={`btn sm lime ${isVoted ? "" : "ghost"}`}
                          style={{ width: "100%", marginTop: 4 }}
                          onClick={() => handleVoteElection(candAddr)}
                        >
                          {isVoted ? "✓ VOTED" : `VOTE FOR ${m.username.toUpperCase()}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <Ticker />
    </>
  );
}

function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
