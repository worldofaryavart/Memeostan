"use client";

import { useState, useEffect } from "react";
import { useNation } from "@/components/useNation";
import { me, allCitizens, getCitizen } from "@/lib/citizens";
import { governance } from "@/lib/governance";
import { elections } from "@/lib/elections";
import { ledger } from "@/lib/ledger";
import { act, newActionId } from "@/lib/actionClient";
import { activeLaws, describeRule } from "@/lib/constitution";
import { currentQuorum, electorate, proposalDuration, tally } from "@/lib/quorum";
import { CLOCK, describeDuration } from "@/lib/clock";
import type { LawRule, LawRuleType } from "@/lib/types";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

export default function GovernmentPage() {
  const { refresh } = useNation();
  const citizen = me();
  const activeProposals = governance.allProposals().filter((p) => p.status === "active");
  const enactedProposals = governance.allProposals().filter((p) => p.status === "enacted");
  const failedProposals = governance.allProposals().filter((p) => p.status === "failed");
  
  const election = elections.getElection();
  // Elected office is held by citizens. The state organs carry their own titles
  // permanently and are not part of the cabinet.
  const ministers = allCitizens().filter(
    (c) => !c.isAI && c.running && c.running !== "Candidate"
  );

  // The constitution as it currently stands — what the Cyber Police actually
  // enforce. Anything not in here is legal, however strongly anyone feels.
  const constitution = activeLaws();
  const repealedLaws = governance.allProposals().filter((p) => p.repealedBy);
  const lapsedProposals = governance.allProposals().filter((p) => p.status === "lapsed");

  // How many citizens have to turn out for a vote to count for anything. Shown
  // everywhere a vote is taken — a rule nobody can see is just a surprise.
  const quorum = currentQuorum();
  const voters = electorate();

  // Proposal form state
  const [propTitle, setPropTitle] = useState("");
  const [propDesc, setPropDesc] = useState("");
  const [propError, setPropError] = useState<string | null>(null);
  const [ruleType, setRuleType] = useState<LawRuleType | "none">("none");
  const [ruleWord, setRuleWord] = useState("");
  const [ruleN, setRuleN] = useState(3);
  const [repealTarget, setRepealTarget] = useState("");

  /** Build the machine-checkable half of the bill, or nothing for a resolution. */
  const buildRule = (): LawRule | undefined => {
    switch (ruleType) {
      case "ban_word":
        return { type: "ban_word", words: [ruleWord.trim().toLowerCase()] };
      case "require_image":
        return { type: "require_image" };
      case "post_limit":
      case "min_length":
      case "ratio_limit":
        return { type: ruleType, n: ruleN };
      case "repeal":
        return { type: "repeal", target: repealTarget };
      default:
        return undefined;
    }
  };

  const rulePreview = (): string => {
    if (ruleType === "none") return "A resolution. It passes, it is recorded, and it binds nobody.";
    if (ruleType === "ban_word" && ruleWord.trim().length < 3) {
      return "A banned word needs at least 3 characters — shorter matches every post ever written.";
    }
    if (ruleType === "repeal" && !repealTarget) return "Pick the article to strike out.";
    const rule = buildRule();
    return rule ? describeRule(rule) : "";
  };

  const ruleIsValid =
    ruleType === "none" ||
    (ruleType === "ban_word" && ruleWord.trim().length >= 3) ||
    (ruleType === "repeal" && Boolean(repealTarget)) ||
    ["require_image", "post_limit", "min_length", "ratio_limit"].includes(ruleType);

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
    const rule = buildRule();
    const res = act("proposal.create", {
      proposalId,
      postId,
      title: propTitle.trim(),
      description: propDesc.trim(),
      // ban_word goes over the wire as a single `word`; the server owns the
      // shape of what gets stored, and never trusts an array from a browser.
      ...(rule
        ? { rule: rule.type === "ban_word" ? { type: "ban_word", word: ruleWord.trim().toLowerCase() } : rule }
        : {}),
    });

    if (res.ok) {
      setPropTitle("");
      setPropDesc("");
      setRuleType("none");
      setRuleWord("");
      setRepealTarget("");
      setPropError(null);
      refresh();
    } else {
      setPropError(res.reason || "Failed to file proposal");
    }
  };

  const handleVoteProposal = (proposalId: string, type: "yes" | "no") => {
    if (!citizen) return;
    act("proposal.vote", { proposalId, vote: type });
    refresh();
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
          tagline="file bills. stand for office. pass laws the state has to enforce."
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
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
                Quorum is <strong>{quorum}</strong> of {voters} citizen{voters === 1 ? "" : "s"},
                and a bill stays open for <strong>{describeDuration(proposalDuration())}</strong>.
                A bill with fewer votes than quorum lapses without a decision — and
                costs the proposer no Aura, because nobody rejected it.
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
                    placeholder="State your bill clearly. This is the reasoning citizens vote on."
                    maxLength={300}
                    onChange={(e) => setPropDesc(e.target.value)}
                    style={{ width: "100%", padding: 10, fontSize: 14, resize: "vertical" }}
                  />
                </div>

                {/* What the bill actually DOES. Free text alone would mean asking a
                    model whether a post "feels illegal"; a rule is something the
                    police can check and a citizen can predict. */}
                <div style={{ border: "2.5px dashed var(--ink-soft)", borderRadius: 6, padding: 10 }}>
                  <div className="marker" style={{ fontSize: 13, marginBottom: 6 }}>
                    ⚖️ WHAT THIS BILL ENFORCES
                  </div>

                  <select
                    value={ruleType}
                    onChange={(e) => setRuleType(e.target.value as LawRuleType | "none")}
                    style={{ width: "100%", padding: 8, fontSize: 13 }}
                  >
                    <option value="none">Nothing — a resolution of the assembly</option>
                    <option value="ban_word">Ban a word from public posts</option>
                    <option value="require_image">Require every post to carry a picture</option>
                    <option value="post_limit">Limit posts per five minutes</option>
                    <option value="min_length">Require a minimum post length</option>
                    <option value="ratio_limit">Make heavily downvoted posts an offence</option>
                    <option value="repeal">Repeal an existing article</option>
                  </select>

                  {ruleType === "ban_word" && (
                    <input
                      type="text"
                      value={ruleWord}
                      placeholder="the word to ban (3+ characters)"
                      maxLength={40}
                      onChange={(e) => setRuleWord(e.target.value)}
                      style={{ width: "100%", padding: 8, fontSize: 13, marginTop: 8 }}
                    />
                  )}

                  {(ruleType === "post_limit" || ruleType === "min_length" || ruleType === "ratio_limit") && (
                    <input
                      type="number"
                      value={ruleN}
                      min={1}
                      max={ruleType === "min_length" ? 200 : 100}
                      onChange={(e) => setRuleN(Math.max(1, Number(e.target.value) || 1))}
                      style={{ width: "100%", padding: 8, fontSize: 13, marginTop: 8 }}
                    />
                  )}

                  {ruleType === "repeal" && (
                    <select
                      value={repealTarget}
                      onChange={(e) => setRepealTarget(e.target.value)}
                      style={{ width: "100%", padding: 8, fontSize: 13, marginTop: 8 }}
                    >
                      <option value="">— pick an article —</option>
                      {constitution.map((law) => (
                        <option key={law.id} value={law.id}>
                          Article {law.article} — {law.title}
                        </option>
                      ))}
                    </select>
                  )}

                  <div
                    className="hand"
                    style={{ fontSize: 13, marginTop: 8, color: ruleIsValid ? "var(--ink)" : "var(--bad)" }}
                  >
                    {rulePreview()}
                  </div>
                </div>

                {propError && (
                  <div className="sticker s-pink" style={{ alignSelf: "flex-start", padding: "4px 8px" }}>
                    ⚠️ {propError}
                  </div>
                )}
                <button
                  type="submit"
                  className="btn lime"
                  disabled={!citizen || !propTitle.trim() || !propDesc.trim() || !ruleIsValid}
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
                    const count = tally(prop);

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

                        <div
                          className="mono"
                          style={{
                            fontSize: 11,
                            marginTop: 6,
                            color: count.quorumMet ? "var(--good)" : "var(--bad)",
                            fontWeight: 700,
                          }}
                        >
                          {count.quorumMet
                            ? `✓ QUORUM MET — ${count.cast} of ${count.quorum} votes cast`
                            : `QUORUM ${count.cast}/${count.quorum} — lapses without a decision if unmet`}
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
              <span className="card-title">📜 THE CONSTITUTION</span>
              <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 10px" }}>
                Every article the Cyber Police enforce, and nothing else. Anything
                not listed here is legal, however strongly anyone feels about it.
              </p>
              {constitution.length === 0 ? (
                <p className="hand" style={{ padding: "10px 0" }}>Every article has been repealed. Memeostan is in total legal anarchy.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10 }}>
                  {constitution.map((prop) => {
                    const creator = getCitizen(prop.creator);
                    const founding = prop.enactedAt === 0;
                    return (
                      <div key={prop.id} style={{ borderLeft: "4px solid var(--good)", paddingLeft: 12, margin: "6px 0" }}>
                        <div className="marker" style={{ fontSize: 16, color: "var(--purple-deep)" }}>
                          Article {prop.article} — {prop.title}
                        </div>
                        <div className="hand" style={{ fontSize: 14, color: "var(--ink)", marginTop: 4 }}>{prop.description}</div>
                        {prop.rule && (
                          <div
                            className="mono"
                            style={{
                              fontSize: 12,
                              marginTop: 6,
                              padding: "4px 8px",
                              background: "rgba(15, 11, 26, 0.06)",
                              borderRadius: 4,
                            }}
                          >
                            ⚖️ {describeRule(prop.rule)}
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 6 }}>
                          {founding
                            ? "Founding article · in force since the country was declared"
                            : `Enacted by referendum · proposed by @${creator?.username || shortAddress(prop.creator)}`}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {repealedLaws.length > 0 && (
                <div style={{ marginTop: 16, borderTop: "2.5px dashed var(--ink-soft)", paddingTop: 10 }}>
                  <div className="marker" style={{ fontSize: 13, marginBottom: 6 }}>🕊️ REPEALED</div>
                  {repealedLaws.map((prop) => (
                    <div key={prop.id} className="mono" style={{ fontSize: 12, opacity: 0.7 }}>
                      <span style={{ textDecoration: "line-through" }}>
                        Article {prop.article} — {prop.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {lapsedProposals.length > 0 && (
              <div className="paper p-white staple" style={{ opacity: 0.8 }}>
                <span className="card-title">💤 LAPSED FOR WANT OF A QUORUM</span>
                <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 8px" }}>
                  Nobody turned out. These were not defeated and may be tabled again.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {lapsedProposals.map((prop) => (
                    <div key={prop.id} className="mono" style={{ fontSize: 12 }}>
                      {prop.title} ({prop.yesVotes.length + prop.noVotes.length} vote
                      {prop.yesVotes.length + prop.noVotes.length === 1 ? "" : "s"} cast)
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                Citizens elected to office. They write the law; the civil service
                enforces it.
              </div>
              {ministers.length === 0 ? (
                <p className="hand">
                  No government has been formed. Memeostan is currently administered
                  entirely by its civil service.
                </p>
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
                a term of office lasts {describeDuration(CLOCK.electionTerm)}. citizens
                only — the civil service neither stands nor votes. aura weights your
                vote, up to twice a new citizen's and never more.
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 6 }}>
                Turnout of <strong>{quorum}</strong> required, or the ballot is void
                and no office changes hands.
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 12, borderBottom: "2.5px solid var(--ink)", paddingBottom: 6 }}>
                <span className="hand" style={{ fontSize: 13, fontWeight: 700 }}>ELECTION RESOLVING IN:</span>
                <span className="poster blink" style={{ fontSize: 20, color: "var(--bad)" }}>{timeStr}</span>
              </div>

              {election.candidates.length === 0 && (
                <div className="paper p-white" style={{ padding: 12, marginTop: 12 }}>
                  <div className="marker" style={{ fontSize: 14 }}>NO NOMINATIONS RECEIVED</div>
                  <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", marginTop: 4 }}>
                    Nobody has stood for office. If the ballot is still empty when polls
                    close, no government is formed and the civil service carries on
                    administering Memeostan without one.
                  </p>
                </div>
              )}

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
                            <div className="marker" style={{ fontSize: 14 }}>{m.username}</div>
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


      <Ticker />
    </>
  );
}


function shortAddress(addr: string): string {
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}
