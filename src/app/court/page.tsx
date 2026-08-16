"use client";

import { useState, useEffect } from "react";
import { useNation } from "@/components/useNation";
import { me, allCitizens, getCitizen } from "@/lib/citizens";
import { getActiveTrials, getResolvedTrials } from "@/lib/judiciary";
import { act, newActionId } from "@/lib/actionClient";
import { CLOCK, describeDuration } from "@/lib/clock";
import { ledger } from "@/lib/ledger";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

export default function CourtPage() {
  const { refresh } = useNation();
  const citizen = me();

  const activeTrials = getActiveTrials();
  const resolvedTrials = getResolvedTrials();
  const citizens = allCitizens().filter(
    (c) => c.address !== citizen?.address && c.username !== "Supreme Court Judge"
  );

  // Lawsuit Form State
  const [defendant, setDefendant] = useState("");
  const [charge, setCharge] = useState("EXCESSIVE CRINGE DISTRIBUTION");
  const [customCharge, setCustomCharge] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dynamic countdown timer trigger
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleFileLawsuit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!citizen) {
      setError("You must register a passport first!");
      return;
    }
    if (!defendant) {
      setError("Please select a defendant.");
      return;
    }
    if (!description.trim()) {
      setError("Please explain the charges.");
      return;
    }

    const finalCharge = charge === "CUSTOM" ? customCharge.trim() : charge;
    if (charge === "CUSTOM" && !finalCharge) {
      setError("Please write a custom charge name.");
      return;
    }

    const res = act("trial.file", {
      trialId: newActionId("trial"),
      postId: newActionId("post"),
      defendant,
      charge: finalCharge,
      description: description.trim(),
    });
    if (res.ok) {
      setDefendant("");
      setDescription("");
      setCustomCharge("");
      setError(null);
      setSuccess("⚖️ Lawsuit filed! The Court has posted the indictment to the Public Square feed.");
      refresh();
      setTimeout(() => setSuccess(null), 5000);
    } else {
      setError(res.reason || "Failed to file lawsuit.");
    }
  };

  const handleVote = (trialId: string, voteType: "guilty" | "innocent") => {
    if (!citizen) return;
    const res = act("trial.vote", { trialId, vote: voteType });
    if (res.ok) {
      refresh();
    } else {
      alert(res.reason);
    }
  };

  const shortAddress = (addr: string) => {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="court" />

        <PageHero
          kicker="the high tribunal of mock justice"
          title="SUPREME COURT"
          titleAccent="COURT"
          tagline="sue your rivals. vote the verdict. watch the drama."
        />

        <div className="cols">
          {/* LEFT COLUMN: Lawsuits & Active Trials */}
          <div className="col-stack">
            {/* Active Trials */}
            <div className="paper p-yellow paper-clip">
              <span className="card-title">⚖️ ACTIVE TRIALS IN COURTROOM</span>
              {activeTrials.length === 0 ? (
                <div style={{ textAlign: "center", padding: "30px 10px" }}>
                  <div style={{ fontSize: 40 }}>💤</div>
                  <h3 className="marker" style={{ marginTop: 10 }}>Court is Currently Adjourned</h3>
                  <p className="hand" style={{ color: "var(--ink-soft)", fontSize: 14 }}>
                    No citizens are currently standing trial. File a lawsuit or wait for the cyber police scanner to indict someone!
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 24, marginTop: 10 }}>
                  {activeTrials.map((trial) => {
                    const def = getCitizen(trial.defendant);
                    const pl = trial.plaintiff === "THE STATE" || trial.plaintiff === "0xai_supremecourt0000000000000000court0"
                      ? null
                      : getCitizen(trial.plaintiff);

                    const totalVotes = trial.yesVotes.length + trial.noVotes.length;
                    const yesPercent = totalVotes > 0 ? Math.round((trial.yesVotes.length / totalVotes) * 100) : 50;
                    const noPercent = totalVotes > 0 ? 100 - yesPercent : 50;

                    const timeLeftMs = trial.endsAt - now;
                    const timeStr = timeLeftMs > 0
                      ? `${Math.floor(timeLeftMs / 60000)}m ${Math.floor((timeLeftMs % 60000) / 1000)}s`
                      : "Resolving...";

                    const votedYes = citizen && trial.yesVotes.includes(citizen.address);
                    const votedNo = citizen && trial.noVotes.includes(citizen.address);

                    return (
                      <div
                        key={trial.id}
                        style={{
                          borderBottom: "3px dashed var(--ink-soft)",
                          paddingBottom: 24,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                          <div>
                            <span className="sticker flat s-pink" style={{ fontSize: 10, marginRight: 6 }}>
                              {trial.charge}
                            </span>
                            <h3 className="marker" style={{ fontSize: 20, color: "var(--purple)", margin: "6px 0 0 0" }}>
                              The State vs @{def?.username || "Unknown"}
                            </h3>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <span className="mono" style={{ fontSize: 11, color: "var(--ink-soft)", display: "block" }}>
                              TIME REMAINING:
                            </span>
                            <span className="poster blink" style={{ fontSize: 18, color: "var(--bad)" }}>
                              {timeStr}
                            </span>
                          </div>
                        </div>

                        <p className="hand" style={{ fontSize: 15, margin: "12px 0", color: "var(--ink)" }}>
                          &ldquo;{trial.description}&rdquo;
                        </p>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--ink-soft)", marginBottom: 12 }}>
                          <span>Prosecutor: {pl ? `@${pl.username}` : "THE STATE 🏛️"}</span>
                          <span>Trial ID: {trial.id}</span>
                        </div>

                        {/* Vote Percent Bars */}
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13 }}>
                            <span style={{ color: "var(--purple)" }}>🔥 GUILTY (YES): {trial.yesVotes.length}</span>
                            <span>{yesPercent}%</span>
                          </div>
                          <div className="bar" style={{ marginTop: 4 }}>
                            <i style={{ width: `${yesPercent}%`, background: "var(--purple)" }} />
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 13, marginTop: 8 }}>
                            <span style={{ color: "var(--good)" }}>🌿 INNOCENT (NO): {trial.noVotes.length}</span>
                            <span>{noPercent}%</span>
                          </div>
                          <div className="bar" style={{ marginTop: 4 }}>
                            <i style={{ width: `${noPercent}%`, background: "var(--good)" }} />
                          </div>
                        </div>

                        {/* Vote buttons */}
                        {citizen && (
                          <div style={{ display: "flex", gap: 12 }}>
                            <button
                              className={`btn sm purple ${votedYes ? "" : "ghost"}`}
                              style={{ flex: 1, padding: "8px 10px" }}
                              onClick={() => handleVote(trial.id, "guilty")}
                            >
                              {votedYes ? "✓ Voted GUILTY" : "⚖️ VOTE GUILTY"}
                            </button>
                            <button
                              className={`btn sm lime ${votedNo ? "" : "ghost"}`}
                              style={{ flex: 1, padding: "8px 10px" }}
                              onClick={() => handleVote(trial.id, "innocent")}
                            >
                              {votedNo ? "✓ Voted INNOCENT" : "🌿 VOTE INNOCENT"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Past Cases Archive */}
            <div className="paper p-white taped tape-pink">
              <span className="card-title">📜 COURT CASE DOSSIERS (ARCHIVE)</span>
              {resolvedTrials.length === 0 ? (
                <p className="hand" style={{ color: "var(--ink-soft)", margin: "10px 0" }}>
                  The archive folders are empty. No trials have concluded yet.
                </p>
              ) : (
                <div className="grid-2" style={{ marginTop: 12 }}>
                  {resolvedTrials.map((trial) => {
                    const def = getCitizen(trial.defendant);
                    const plName = trial.plaintiff === "THE STATE" || trial.plaintiff === "0xai_supremecourt0000000000000000court0"
                      ? "THE STATE"
                      : `@${getCitizen(trial.plaintiff)?.username || "Plaintiff"}`;

                    const isGuilty = trial.verdict === "GUILTY";

                    return (
                      <div
                        key={trial.id}
                        className="paper p-bone staple"
                        style={{
                          position: "relative",
                          padding: "16px 14px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          minHeight: 180,
                        }}
                      >
                        {/* Dossier Stamp */}
                        <div
                          className="mono"
                          style={{
                            position: "absolute",
                            top: 10,
                            right: 10,
                            border: `3px solid ${isGuilty ? "var(--bad)" : "var(--good)"}`,
                            color: isGuilty ? "var(--bad)" : "var(--good)",
                            padding: "2px 8px",
                            fontWeight: 900,
                            fontSize: 14,
                            borderRadius: 4,
                            transform: "rotate(12deg)",
                            textTransform: "uppercase",
                            letterSpacing: 1.5,
                            boxShadow: "0 0 4px rgba(0,0,0,0.1)",
                            background: "rgba(255,255,255,0.85)",
                          }}
                        >
                          {trial.verdict}
                        </div>

                        <div>
                          <div className="mono" style={{ fontSize: 9, color: "var(--ink-soft)" }}>
                            FILE NO: {trial.id}
                          </div>
                          <h4 className="marker" style={{ fontSize: 16, color: "var(--purple-deep)", margin: "4px 0" }}>
                            The State vs @{def?.username || "Unknown"}
                          </h4>
                          <span className="sticker flat s-dark" style={{ fontSize: 9, color: "var(--white)", padding: "2px 4px" }}>
                            {trial.charge}
                          </span>
                          <p
                            className="hand"
                            style={{
                              fontSize: 12,
                              color: "var(--ink)",
                              marginTop: 10,
                              lineHeight: 1.3,
                              display: "-webkit-box",
                              WebkitLineClamp: 3,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            &ldquo;{trial.description}&rdquo;
                          </p>
                        </div>

                        <div style={{ marginTop: 14, borderTop: "2px dotted var(--ink-soft)", paddingTop: 8 }}>
                          <div className="mono" style={{ fontSize: 9, color: "var(--ink-soft)", textTransform: "uppercase" }}>
                            Prosecutor: {plName}
                          </div>
                          <div
                            className="mono"
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: isGuilty ? "var(--bad)" : "var(--purple)",
                              marginTop: 2,
                            }}
                          >
                            Outcome: {trial.penalty}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Lawsuit filer form & Court Constitution */}
          <aside className="col-stack">
            {/* File Lawsuit Form */}
            <div className="paper p-cyan binder-clip">
              <span className="card-title">⚖️ FILE A LAWSUIT</span>
              <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 12 }}>
                Have a dispute? File a lawsuit against a fellow citizen for a flat fee of{" "}
                <strong style={{ color: "var(--bad)" }}>30 MMC</strong>. The community will act as the jury!
              </p>

              <form onSubmit={handleFileLawsuit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* Select Defendant */}
                <div>
                  <label className="mono" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    DEFENDANT (CITIZEN TO SUE)
                  </label>
                  <select
                    value={defendant}
                    onChange={(e) => setDefendant(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "2.5px solid var(--ink)", borderRadius: 4 }}
                  >
                    <option value="">-- Choose Citizen --</option>
                    {citizens.map((c) => (
                      <option key={c.address} value={c.address}>
                        @{c.username} ({shortAddress(c.address)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Charge Category */}
                <div>
                  <label className="mono" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    LAW VIOLATION CHARGE
                  </label>
                  <select
                    value={charge}
                    onChange={(e) => setCharge(e.target.value)}
                    style={{ width: "100%", padding: 8, border: "2.5px solid var(--ink)", borderRadius: 4 }}
                  >
                    <option value="EXCESSIVE CRINGE DISTRIBUTION">EXCESSIVE CRINGE DISTRIBUTION</option>
                    <option value="LOGIC USAGE IN A PUBLIC SPACE">LOGIC USAGE IN A PUBLIC SPACE</option>
                    <option value="SPAM FLOODING THE COMMONS">SPAM FLOODING THE COMMONS</option>
                    <option value="IMPROPER MEWING FORM">IMPROPER MEWING FORM</option>
                    <option value="EXCESSIVE OUTDOOR EXPOSURE">EXCESSIVE OUTDOOR EXPOSURE (TOUCHED GRASS)</option>
                    <option value="CUSTOM">-- WRITE CUSTOM CHARGE --</option>
                  </select>
                </div>

                {/* Custom Charge Text */}
                {charge === "CUSTOM" && (
                  <div>
                    <label className="mono" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                      CUSTOM CHARGE NAME
                    </label>
                    <input
                      type="text"
                      value={customCharge}
                      placeholder="e.g. TAX EVASION IN NEO OHIO"
                      onChange={(e) => setCustomCharge(e.target.value)}
                      style={{ width: "100%", padding: 8, border: "2.5px solid var(--ink)", borderRadius: 4 }}
                    />
                  </div>
                )}

                {/* Case Description */}
                <div>
                  <label className="mono" style={{ fontSize: 11, display: "block", marginBottom: 4 }}>
                    EVIDENCE &amp; DESCRIPTION
                  </label>
                  <textarea
                    rows={4}
                    value={description}
                    placeholder="Provide evidence of their crimes. Make it dramatic."
                    onChange={(e) => setDescription(e.target.value)}
                    style={{
                      width: "100%",
                      padding: 8,
                      border: "2.5px solid var(--ink)",
                      borderRadius: 4,
                      resize: "none",
                    }}
                  />
                </div>

                {error && (
                  <div className="sticker s-pink" style={{ padding: "4px 8px", fontSize: 12 }}>
                    ⚠️ {error}
                  </div>
                )}

                {success && (
                  <div className="sticker s-lime" style={{ padding: "4px 8px", fontSize: 12 }}>
                    {success}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn lime"
                  disabled={!citizen || !defendant || !description.trim()}
                  style={{ width: "100%", padding: "10px" }}
                >
                  File Lawsuit (-30 MMC) ⚖️
                </button>
              </form>
            </div>

            {/* Court Constitution Sidebar */}
            <div className="paper p-lime paper-clip">
              <span className="card-title">📜 JUDICIAL CONSTITUTION</span>
              <ul className="hand" style={{ fontSize: 13, paddingLeft: 16, margin: "8px 0", lineHeight: 1.5 }}>
                <li>
                  <strong>Community Jury</strong>: The verdict of every trial is determined by community vote (YES = Guilty, NO = Innocent).
                </li>
                <li style={{ marginTop: 8 }}>
                  <strong>Lawsuit Filing Fee</strong>: Filing a lawsuit charges <strong>30 MMC</strong>. State indictments by the AI Cyber Police are free.
                </li>
                <li style={{ marginTop: 8 }}>
                  <strong>Guilty Verdict Penalty</strong>: If declared guilty, the defendant is fined up to <strong>50 MMC</strong> (burned) and loses <strong>100 Aura</strong>.
                </li>
                <li style={{ marginTop: 8 }}>
                  <strong>Innocent Verdict Compensation</strong>: If acquitted, the defendant receives <strong>25 MMC</strong> compensation and <strong>+50 Aura</strong>.
                </li>
                <li style={{ marginTop: 8 }}>
                  <strong>Trial Duration</strong>: A trial runs for <strong>{describeDuration(CLOCK.trialDuration)}</strong>, long enough for a jury to assemble. If no citizen votes, the bench rules alone on the record and the penalty is halved.
                </li>
              </ul>
              {citizen && (
                <div
                  className="mono"
                  style={{
                    marginTop: 16,
                    padding: "8px 10px",
                    background: "var(--white)",
                    border: "2px solid var(--ink)",
                    borderRadius: 4,
                    fontSize: 11,
                    textAlign: "center",
                  }}
                >
                  YOUR ACCOUNT: 🪙 <strong>{ledger.balanceOf(citizen.address)} MMC</strong>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>

      <Ticker />
    </>
  );
}
