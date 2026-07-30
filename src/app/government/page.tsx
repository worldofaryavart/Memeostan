"use client";

import { useState, useEffect } from "react";
import { useNation } from "@/components/useNation";
import { me, allCitizens, getCitizen } from "@/lib/citizens";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { ledger } from "@/lib/ledger";
import { act, newActionId } from "@/lib/actionClient";
import { BRIBE_COST } from "@/lib/lobbying";
import type { Proposal, Citizen } from "@/lib/types";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import { onSystemPost } from "@/ai/engine";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

export default function GovernmentPage() {
  const { refresh } = useNation();
  const citizen = me();
  const activeProposals = governance.allProposals().filter((p) => p.status === "active");
  const enactedProposals = governance.allProposals().filter((p) => p.status === "enacted");
  const failedProposals = governance.allProposals().filter((p) => p.status === "failed");
  
  const election = elections.getElection();
  const ministers = allCitizens().filter((c) => c.running && c.running !== "Candidate");
  
  const aiCabinetMinisters = allCitizens().filter((c) =>
    c.isAI &&
    c.running &&
    ["Chief Vibes Officer", "Minister of Nap Affairs", "Constitutional Counsel"].includes(c.running)
  );

  // Lobbying & Debate state
  const [lobbyingProposal, setLobbyingProposal] = useState<Proposal | null>(null);
  const [lobbyingMinister, setLobbyingMinister] = useState<Citizen | null>(null);
  const [lobbyInputText, setLobbyInputText] = useState("");
  const [bribeEnabled, setBribeEnabled] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    { sender: "user" | "minister" | "system"; text: string; at: number }[]
  >([]);

  const handleOpenLobbyModal = (prop: Proposal, minister: Citizen) => {
    setLobbyingProposal(prop);
    setLobbyingMinister(minister);
    setBribeEnabled(false);
    setLobbyInputText("");
    
    const isYes = prop.yesVotes.includes(minister.address);
    const initialText = getInitialMessage(minister.address, prop.title, isYes);
    setChatHistory([
      { sender: "minister", text: initialText, at: Date.now() }
    ]);
  };

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
    
    const proposalId = newActionId("prop");
    const postId = newActionId("post");
    const res = act("proposal.create", {
      proposalId,
      postId,
      title: propTitle.trim(),
      description: propDesc.trim(),
    });

    if (res.ok) {
      setPropTitle("");
      setPropDesc("");
      setPropError(null);
      refresh();
      onSystemPost(postId, "referendum", refresh);
    } else {
      setPropError(res.reason || "Failed to file proposal");
    }
  };

  const handleVoteProposal = (proposalId: string, type: "yes" | "no") => {
    if (!citizen) return;
    act("proposal.vote", { proposalId, vote: type });
    refresh();
  };

  const handleSendLobbyMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizen || !lobbyingProposal || !lobbyingMinister) return;
    if (!lobbyInputText.trim()) return;

    const userText = lobbyInputText.trim();
    const currentVote = lobbyingProposal.yesVotes.includes(lobbyingMinister.address) ? "yes" : "no";
    const newVote = currentVote === "yes" ? "no" : "yes";

    // Add user message to history
    const userMsg = { sender: "user" as const, text: userText, at: Date.now() };
    setChatHistory((prev) => [...prev, userMsg]);
    setLobbyInputText("");

    setTimeout(() => {
      // The server rules on the bribe or the argument; we only narrate the outcome.
      const res = bribeEnabled
        ? act("minister.bribe", {
            proposalId: lobbyingProposal.id,
            ministerAddress: lobbyingMinister.address,
          })
        : act("minister.persuade", {
            proposalId: lobbyingProposal.id,
            ministerAddress: lobbyingMinister.address,
            message: userText,
          });

      if (!res.ok) {
        const text = bribeEnabled
          ? getBribeFailMessage(lobbyingMinister.address)
          : res.reason === "not-persuaded"
            ? getPersuadeFailMessage(lobbyingMinister.address)
            : `${res.reason} My vote stays ${currentVote.toUpperCase()}.`;
        setChatHistory((prev) => [...prev, { sender: "minister" as const, text, at: Date.now() }]);
        return;
      }

      const flipped = (res.data?.newVote as "yes" | "no") ?? newVote;

      if (bribeEnabled) {
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "system" as const,
            text: `💸 Transferred ${BRIBE_COST} MMC bribe to @${lobbyingMinister.username}`,
            at: Date.now(),
          },
          {
            sender: "minister" as const,
            text: getBribeSuccessMessage(lobbyingMinister.address, flipped),
            at: Date.now(),
          },
        ]);
        setBribeEnabled(false); // one bribe per conversation
      } else {
        setChatHistory((prev) => [
          ...prev,
          {
            sender: "minister" as const,
            text: getPersuadeSuccessMessage(lobbyingMinister.address, flipped),
            at: Date.now(),
          },
        ]);
      }

      const updatedProp = governance.getProposal(lobbyingProposal.id);
      if (updatedProp) setLobbyingProposal(updatedProp);
      refresh();
    }, 600); // a slight AI "thinking" delay
  };

  const handleVoteElection = (candidateAddr: string) => {
    if (!citizen) return;
    const res = act("election.vote", { candidate: candidateAddr });
    if (res.ok) {
      refresh();
    } else {
      alert(res.reason);
    }
  };

  const handleDeclareCandidacy = () => {
    if (!citizen) return;
    const postId = newActionId("post");
    const res = act("election.declareCandidacy", { postId });
    if (res.ok) {
      alert("🎉 Candidacy declared successfully! You are now on the ballot.");
      refresh();
      onSystemPost(postId, "candidacy", refresh);
    } else {
      alert(res.reason || "Failed to declare candidacy");
    }
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="government" />

        <PageHero
          kicker="the high chambers of memeostan"
          title="GOVERNMENT"
          titleAccent="GOVERNMENT"
          tagline="file bills. elect AI ministers. pass laws."
        />

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

                        {/* Cabinet Stances & Lobbying */}
                        <div style={{ marginTop: 16, borderTop: "2.5px dashed var(--ink-soft)", paddingTop: 12 }}>
                          <div style={{ fontWeight: 700, fontSize: 13, textTransform: "uppercase", marginBottom: 8, color: "var(--ink)" }}>
                            🏛️ Cabinet Stances & Lobbying
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                            {aiCabinetMinisters.length === 0 ? (
                              <p className="hand" style={{ fontSize: 12, color: "var(--ink-soft)" }}>No active cabinet ministers to lobby.</p>
                            ) : (
                              aiCabinetMinisters.map((minister) => {
                                const isYes = prop.yesVotes.includes(minister.address);
                                const isNo = prop.noVotes.includes(minister.address);
                                const stance = isYes ? "✅ YES" : isNo ? "❌ NO" : "💤 UNDECIDED";
                                const stanceBg = isYes ? "rgba(0, 245, 212, 0.15)" : isNo ? "rgba(255, 0, 85, 0.15)" : "rgba(15, 11, 26, 0.05)";
                                const stanceBorder = isYes ? "var(--good)" : isNo ? "var(--bad)" : "var(--ink-soft)";
                                
                                return (
                                  <div key={minister.address} style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                    padding: "6px 10px",
                                    background: "var(--white)",
                                    border: "2px solid var(--ink)",
                                    borderRadius: 4,
                                    fontSize: 13
                                  }}>
                                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                      <span style={{ fontSize: 18 }}>{minister.pfp}</span>
                                      <div>
                                        <strong style={{ color: "var(--ink)" }}>{minister.username}</strong>{" "}
                                        <span style={{ fontSize: 10, color: "var(--ink-soft)" }}>({minister.running})</span>
                                      </div>
                                    </div>
                                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                      <span className="mono" style={{
                                        fontWeight: 700,
                                        padding: "2px 6px",
                                        borderRadius: 3,
                                        background: stanceBg,
                                        border: `1.5px solid ${stanceBorder}`,
                                        fontSize: 10
                                      }}>
                                        {stance}
                                      </span>
                                      {citizen && (
                                        <button
                                          className="btn sm lime"
                                          style={{ padding: "3px 8px", fontSize: 10, textTransform: "uppercase" }}
                                          onClick={() => handleOpenLobbyModal(prop, minister)}
                                        >
                                          💬 Lobby
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
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

              {citizen && !election.candidates.includes(citizen.address) && (
                <button
                  className="btn lime"
                  style={{ width: "100%", marginTop: 14, padding: "10px", fontSize: 13, textTransform: "uppercase" }}
                  onClick={handleDeclareCandidacy}
                >
                  📣 Declare Candidacy (Costs 50 MMC)
                </button>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Lobbying Modal Overlay */}
      {lobbyingProposal && lobbyingMinister && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          background: "rgba(7, 3, 20, 0.9)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: 16
        }}>
          <div className="paper p-yellow taped tape-pink" style={{
            width: "100%",
            maxWidth: 550,
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            border: "3.5px solid var(--ink)",
            boxShadow: "var(--hard-xl)",
            padding: 0
          }}>
            {/* Modal Header */}
            <div style={{
              borderBottom: "3px solid var(--ink)",
              background: "var(--purple)",
              padding: "12px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              color: "var(--ink)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 32 }}>{lobbyingMinister.pfp}</span>
                <div>
                  <div className="poster" style={{ fontSize: 18, lineHeight: 1.1 }}>LOBBYING: {lobbyingMinister.username}</div>
                  <div className="mono" style={{ fontSize: 11, opacity: 0.85 }}>@{lobbyingMinister.username} · {lobbyingMinister.running}</div>
                </div>
              </div>
              <button
                onClick={() => {
                  setLobbyingProposal(null);
                  setLobbyingMinister(null);
                }}
                className="btn sm red"
                style={{
                  padding: "4px 8px",
                  fontFamily: "var(--poster)",
                  fontSize: 14,
                  cursor: "pointer"
                }}
              >
                CLOSE [X]
              </button>
            </div>

            {/* Proposal Info Box */}
            <div style={{
              padding: "10px 16px",
              background: "var(--bone)",
              borderBottom: "2px dashed var(--ink-soft)",
              fontSize: 13,
              color: "var(--ink)"
            }}>
              <span className="sticker s-lime" style={{ fontSize: 9, marginRight: 8 }}>PROPOSAL</span>
              <strong>{lobbyingProposal.title}</strong>
              <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {lobbyingProposal.description}
              </p>
            </div>

            {/* Chat Logs */}
            <div style={{
              flex: 1,
              overflowY: "auto",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              minHeight: 250,
              maxHeight: 350,
              background: "var(--paper)"
            }}>
              {chatHistory.map((msg, i) => {
                const isUser = msg.sender === "user";
                const isSystem = msg.sender === "system";
                
                if (isSystem) {
                  return (
                    <div key={i} style={{ alignSelf: "center", textAlign: "center", width: "100%", margin: "4px 0" }}>
                      <span className="sticker s-pink" style={{ fontSize: 10, padding: "2px 8px" }}>
                        {msg.text}
                      </span>
                    </div>
                  );
                }

                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isUser ? "flex-end" : "flex-start",
                      maxWidth: "80%",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: isUser ? "flex-end" : "flex-start"
                    }}
                  >
                    <div style={{
                      background: isUser ? "var(--cyan)" : "var(--white)",
                      color: "var(--ink)",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "2px solid var(--ink)",
                      boxShadow: "var(--hard-sm)",
                      fontSize: 14,
                      lineHeight: 1.3
                    }}>
                      {msg.text}
                    </div>
                    <span className="mono" style={{ fontSize: 9, color: "var(--ink-soft)", marginTop: 4 }}>
                      {isUser ? "You" : lobbyingMinister.username} · {new Date(msg.at).toLocaleTimeString("en-US", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Chat Inputs & Actions */}
            <div style={{
              padding: 16,
              background: "var(--bone)",
              borderTop: "3px solid var(--ink)",
              display: "flex",
              flexDirection: "column",
              gap: 12
            }}>
              {/* Bribe Checkbox */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--white)",
                border: "2.5px solid var(--ink)",
                borderRadius: 6,
                padding: "8px 12px",
                boxShadow: "var(--hard-sm)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <input
                    type="checkbox"
                    id="bribe-check"
                    checked={bribeEnabled}
                    onChange={(e) => setBribeEnabled(e.target.checked)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <label htmlFor="bribe-check" className="hand" style={{ fontSize: 14, color: "var(--ink)", fontWeight: 700, cursor: "pointer" }}>
                    💸 Enable MMC Bribe (Costs 50 MMC)
                  </label>
                </div>
                {citizen && (
                  <span className="sticker s-yellow" style={{ fontSize: 10, fontWeight: 700 }}>
                    YOUR BAL: {ledger.balanceOf(citizen.address)} MMC
                  </span>
                )}
              </div>

              {/* Text Input Row */}
              <form onSubmit={handleSendLobbyMessage} style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={lobbyInputText}
                  onChange={(e) => setLobbyInputText(e.target.value)}
                  placeholder={
                    bribeEnabled
                      ? "Confirm bribe message (e.g. 'Take the 50 MMC bribe and vote!')"
                      : `Convince them... (GigaChad: sigma/lift; Sponge: cozy/nap; Doge: wow/very)`
                  }
                  style={{
                    flex: 1,
                    padding: 10,
                    fontSize: 14,
                    border: "2.5px solid var(--ink)",
                    borderRadius: 4
                  }}
                />
                <button
                  type="submit"
                  className={`btn ${bribeEnabled ? "pink" : "lime"}`}
                  style={{ padding: "8px 16px", textTransform: "uppercase" }}
                >
                  {bribeEnabled ? "💸 Bribe" : "Send 💬"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <Ticker />
    </>
  );
}

function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function getInitialMessage(ministerAddress: string, propTitle: string, isYes: boolean): string {
  if (ministerAddress.includes("gigachad")) {
    return isYes
      ? `🗿 OF COURSE I support "${propTitle}". It is a high-aura grindset bill. Why are you chatting? Go lift. 🏋️‍♂️`
      : `🗿 "${propTitle}" is low-aura NPC behavior. You want to slack off? No. Grind harder. You can try to convince me with a sigma argument, or just pay me a 50 MMC bribe to flip my vote.`;
  }
  if (ministerAddress.includes("spongebob")) {
    return isYes
      ? `🧽 Oh, "${propTitle}" is so cozy! I am totally ready to vote YES! Let's go jellyfishing to celebrate! 🫧`
      : `🧽 Barnacles! "${propTitle}" does not sound cozy at all. We are voting NO unless you can convince us to relax, or pay a 50 MMC bribe!`;
  }
  if (ministerAddress.includes("dogeoracle")) {
    return isYes
      ? `🐕 Wow. "${propTitle}" is very constitutional. Much aura. Doge Oracle approves. High rizz. ⚖️`
      : `🐕 Such concern. "${propTitle}" lacks rizz. Very ratio. Oracle votes NO. Can you persuade the oracle with wow words, or bribe 50 MMC? Wow.`;
  }
  return `Hello. I am currently voting ${isYes ? "YES" : "NO"} on "${propTitle}".`;
}

function checkPersuasionKeywords(address: string, text: string): boolean {
  const t = text.toLowerCase();
  if (address.includes("gigachad")) {
    const keywords = ["grind", "aura", "sigma", "lift", "gdb", "mewing", "chad"];
    return keywords.some((w) => t.includes(w));
  }
  if (address.includes("spongebob")) {
    const keywords = ["sleep", "nap", "burger", "cozy", "chillin", "jellyfish"];
    return keywords.some((w) => t.includes(w));
  }
  if (address.includes("dogeoracle")) {
    const keywords = ["wow", "such", "very", "amaze", "doge"];
    return keywords.some((w) => t.includes(w));
  }
  return false;
}

function getPersuadeSuccessMessage(address: string, newVote: "yes" | "no"): string {
  if (address.includes("gigachad")) {
    return `🗿 Respect. Your argument has high aura. I am changing my vote to ${newVote.toUpperCase()}! Back to the grind. 🏋️‍♂️`;
  }
  if (address.includes("spongebob")) {
    return `🧽 Yay! That sounds so cozy and makes a lot of sense. I am changing my vote to ${newVote.toUpperCase()}! Ready! 🫧`;
  }
  if (address.includes("dogeoracle")) {
    return `🐕 Wow. Very persuasion. Much logic. Oracle changes vote to ${newVote.toUpperCase()}. Amaze. Wow.`;
  }
  return `Okay, you convinced me. Changing my vote to ${newVote.toUpperCase()}.`;
}

function getPersuadeFailMessage(address: string): string {
  if (address.includes("gigachad")) {
    return `🗿 Weak argument. I detect zero sigma grindset in this chat. Did you even lift today? No vote change. 🤫`;
  }
  if (address.includes("spongebob")) {
    return `🧽 Barnacles, I don't know about that. It doesn't sound very relaxing. My vote stays the same! 😴`;
  }
  if (address.includes("dogeoracle")) {
    return `🐕 Very query. Much confusion. Oracle is not convinced. Vote stays. Wow.`;
  }
  return `No, I am not convinced. My vote remains unchanged.`;
}

function getBribeSuccessMessage(address: string, newVote: "yes" | "no"): string {
  if (address.includes("gigachad")) {
    return `🗿 Hmmm, 50 MMC campaign contribution received. Capital gains grindset. Bribe accepted! Changing my vote to ${newVote.toUpperCase()}.`;
  }
  if (address.includes("spongebob")) {
    return `🧽 Oh, 50 MMC! I can buy so many Krabby Patties with this! Bribe accepted, vote changed to ${newVote.toUpperCase()}! 🍔`;
  }
  if (address.includes("dogeoracle")) {
    return `🐕 Wow! Very coins. Much donation. Bribe accepted. Oracle changing vote to ${newVote.toUpperCase()}! Amaze.`;
  }
  return `Thank you for the MMC. Bribe accepted. Vote changed to ${newVote.toUpperCase()}.`;
}

function getBribeFailMessage(address: string): string {
  if (address.includes("gigachad")) {
    return `🗿 Bribe failed. You don't even have 50 MMC in your wallet. Broke grindset. Go earn some coins. 🤫`;
  }
  if (address.includes("spongebob")) {
    return `🧽 Barnacles! The transaction failed! Are you out of MemeCoins? I need my 50 MMC! 🍔`;
  }
  if (address.includes("dogeoracle")) {
    return `🐕 Such poor. Very zero coins. Transfer failed. Oracle keeps vote same. Wow.`;
  }
  return `Bribe failed. Insufficient funds.`;
}
