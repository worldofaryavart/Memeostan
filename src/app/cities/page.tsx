"use client";

import { useState, useEffect, useCallback } from "react";
import { useNation } from "@/components/useNation";
import { allCitizens, me } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import { ALL_CITIES, getRulesForCitizen } from "@/lib/cities";
import {
  getTerritories,
  getDominantCity,
  getSkirmishLog,
  launchSkirmish,
  SKIRMISH_COST,
} from "@/lib/territory";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import type { SkirmishResult } from "@/lib/types";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";

// ── Constants ─────────────────────────────────────────────────────────────────

const CARD_STYLES = [
  { bg: "p-purple", fastener: "taped tape-blue", fill: "#b39ddb" },
  { bg: "p-lime",   fastener: "staple",          fill: "#b5e853" },
  { bg: "p-pink",   fastener: "pin",             fill: "#f48fb1" },
  { bg: "p-cyan",   fastener: "paper-clip",      fill: "#80deea" },
];

function timeAgo(ms: number): string {
  const sec = Math.floor((Date.now() - ms) / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  return `${Math.floor(min / 60)}h ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CitiesPage() {
  const { refresh } = useNation();
  const citizens = allCitizens();
  const citizen = me();

  const [territories, setTerritories] = useState<Record<string, number>>({});
  const [skirmishLog, setSkirmishLog] = useState<SkirmishResult[]>([]);
  const [dominant, setDominant] = useState("");
  const [targetCity, setTargetCity] = useState("");
  const [attackMsg, setAttackMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [isAttacking, setIsAttacking] = useState(false);

  const refreshTerritories = useCallback(() => {
    setTerritories(getTerritories());
    setSkirmishLog(getSkirmishLog(12));
    setDominant(getDominantCity());
  }, []);

  useEffect(() => {
    refreshTerritories();
  }, [refreshTerritories]);

  // ── Stats helpers ────────────────────────────────────────────────────────────

  const getCityStats = (cityName: string) => {
    const cityCitizens = citizens.filter((c) => c.city === cityName || c.faction === ALL_CITIES.find(x => x.name === cityName)?.faction);
    const population = cityCitizens.length;
    const totalAura = cityCitizens.reduce((sum, c) => sum + c.aura, 0);
    const avgAura = population > 0 ? Math.round(totalAura / population) : 0;
    const totalMMC = cityCitizens.reduce((sum, c) => sum + ledger.balanceOf(c.address), 0);
    // Attack power preview (same formula as engine minus random)
    const attackPower = Math.round(population * 10 + avgAura * 0.4);
    return { population, avgAura, totalMMC, attackPower };
  };

  // ── Skirmish handlers ────────────────────────────────────────────────────────

  const myCity = citizen?.city ?? "";
  const myRules = getRulesForCitizen(citizen);
  const myBalance = citizen ? ledger.balanceOf(citizen.address) : 0;

  const handleAttack = () => {
    if (!citizen || !myCity || !targetCity) return;
    setIsAttacking(true);
    setAttackMsg(null);

    // Small delay for drama
    setTimeout(() => {
      const outcome = launchSkirmish(myCity, targetCity, citizen.address);
      if (outcome.error) {
        setAttackMsg({ ok: false, text: outcome.error });
      } else {
        const r = outcome.result;
        const won = r.winner === myCity;
        const text = won
          ? `⚔️ VICTORY! ${myCity} crushed ${targetCity} (${r.attackerScore} vs ${r.defenderScore}). Seized +${r.territoryGained}% territory! 🏴`
          : `💀 DEFEAT. ${targetCity} repelled the attack (${r.attackerScore} vs ${r.defenderScore}). ${SKIRMISH_COST} MMC lost to the war chest.`;
        setAttackMsg({ ok: won, text });
      }
      refreshTerritories();
      refresh();
      setIsAttacking(false);
    }, 1200);
  };

  const handleFreeSimulation = () => {
    const cities = ALL_CITIES.map((c) => c.name);
    const idxA = Math.floor(Math.random() * cities.length);
    let idxB = Math.floor(Math.random() * cities.length);
    while (idxB === idxA) idxB = Math.floor(Math.random() * cities.length);
    setIsAttacking(true);
    setTimeout(() => {
      launchSkirmish(cities[idxA], cities[idxB]);
      refreshTerritories();
      setIsAttacking(false);
    }, 800);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="cities" />

        <PageHero
          kicker="war room — territorial dispatch"
          title="CITIES"
          titleAccent="CITIES"
          tagline="four factions. one continent. seize territory."
        />

        {/* ── MY CITY CALLOUT ──────────────────────────────────────────────── */}
        {citizen && myCity && (
          <div
            className={`paper ${CARD_STYLES[ALL_CITIES.findIndex(c => c.name === myCity) % 4]?.bg ?? "p-purple"} pin`}
            style={{ marginBottom: 28 }}
          >
            <span className="card-title">🛂 YOUR CITY: {myRules.emoji} {myRules.name}</span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>ACTIVE PERK</div>
                <div className="sticker s-lime" style={{ display: "inline-block", fontSize: 12 }}>🟢 {myRules.perk}</div>
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>ACTIVE DEBUFF</div>
                <div className="sticker s-pink" style={{ display: "inline-block", fontSize: 12 }}>🔴 {myRules.debuff}</div>
              </div>
              <div style={{ flex: 1, minWidth: 120, textAlign: "right" }}>
                <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>TERRITORY HELD</div>
                <div className="marker" style={{ fontSize: 22 }}>
                  {territories[myCity] ?? 25}%
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TERRITORY MAP ──────────────────────────────────────────────────── */}
        <div className="paper p-white binder-clip" style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
            <span className="card-title">🗺️ LIVE TERRITORY MAP</span>
            {dominant && (
              <span className="sticker s-lime" style={{ fontSize: 11 }}>
                🏆 DOMINANT: {ALL_CITIES.find(c => c.name === dominant)?.emoji} {dominant} ({territories[dominant] ?? 0}%)
              </span>
            )}
          </div>

          {/* Stacked territory bar */}
          <div
            style={{
              display: "flex",
              height: 40,
              borderRadius: 4,
              overflow: "hidden",
              border: "3px solid var(--ink)",
              marginBottom: 16,
            }}
          >
            {ALL_CITIES.map((city, idx) => {
              const pct = territories[city.name] ?? 25;
              const fill = CARD_STYLES[idx].fill;
              return (
                <div
                  key={city.name}
                  style={{
                    width: `${pct}%`,
                    background: fill,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--ink)",
                    transition: "width 0.6s ease",
                    overflow: "hidden",
                    whiteSpace: "nowrap",
                    borderRight: idx < ALL_CITIES.length - 1 ? "2px solid var(--ink)" : "none",
                  }}
                >
                  {pct >= 14 && `${city.emoji} ${pct}%`}
                </div>
              );
            })}
          </div>

          {/* City territory bars */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
            {ALL_CITIES.map((city, idx) => {
              const pct = territories[city.name] ?? 25;
              const fill = CARD_STYLES[idx].fill;
              const isDominantCity = city.name === dominant;
              return (
                <div key={city.name} style={{ padding: "10px 12px", border: "2px solid var(--ink)", borderRadius: 4, background: isDominantCity ? `${fill}33` : "transparent" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span className="marker" style={{ fontSize: 13 }}>{city.emoji} {city.name}</span>
                    <span className="marker" style={{ fontSize: 15, color: fill }}>{pct}%</span>
                  </div>
                  <div style={{ height: 8, background: "var(--paper-border)", borderRadius: 3, border: "1.5px solid var(--ink)", overflow: "hidden" }}>
                    <div
                      style={{ width: `${pct}%`, height: "100%", background: fill, transition: "width 0.6s ease" }}
                    />
                  </div>
                  {isDominantCity && (
                    <div className="sticker s-lime" style={{ fontSize: 9, marginTop: 6, display: "inline-block" }}>
                      🏆 DOMINANT
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="cols">
          {/* LEFT: City Cards */}
          <div className="col-stack">
            <div className="cabinet-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: 20 }}>
              {ALL_CITIES.map((city, idx) => {
                const stats = getCityStats(city.name);
                const style = CARD_STYLES[idx];
                const pct = territories[city.name] ?? 25;
                const isMyCity = citizen?.city === city.name;
                const isDomCity = city.name === dominant;

                return (
                  <div key={city.name} className={`paper ${style.bg} ${style.fastener}`} style={{ position: "relative" }}>
                    {isMyCity && (
                      <div className="sticker s-lime" style={{ position: "absolute", top: -10, right: 12, fontSize: 10, zIndex: 2 }}>
                        📍 YOUR CITY
                      </div>
                    )}
                    {isDomCity && !isMyCity && (
                      <div className="sticker s-yellow" style={{ position: "absolute", top: -10, right: 12, fontSize: 10, zIndex: 2 }}>
                        🏆 DOMINANT
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 40 }}>{city.emoji}</span>
                      <span className={`sticker ${city.accentClass}`}>{city.faction}</span>
                    </div>

                    <h2 className="marker" style={{ fontSize: 22, margin: "6px 0" }}>{city.name}</h2>
                    <p className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", margin: "4px 0 10px" }}>
                      &ldquo;{city.motto}&rdquo;
                    </p>

                    <hr className="rule" />

                    <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>🗺️ Territory:</span>
                        <strong>{pct}%</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>👥 Population:</span>
                        <strong>{stats.population} Citizens</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>✨ Avg Aura:</span>
                        <strong>{stats.avgAura.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>⚔️ Attack Power:</span>
                        <strong>~{stats.attackPower}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>🪙 Wealth:</span>
                        <strong>{stats.totalMMC.toLocaleString()} MMC</strong>
                      </div>
                    </div>

                    <hr className="rule" style={{ margin: "10px 0 8px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div className="hand" style={{ fontSize: 11 }}>🟢 <strong>Perk:</strong> {city.perk}</div>
                      <div className="hand" style={{ fontSize: 11 }}>🔴 <strong>Debuff:</strong> {city.debuff}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <aside className="col-stack">

            {/* ── ATTACK PANEL ──────────────────────────────────────────────── */}
            <div className="paper p-red pin">
              <span className="card-title" style={{ color: "var(--red)" }}>⚔️ LAUNCH SKIRMISH</span>

              {citizen && myCity ? (
                <>
                  <div className="hand" style={{ fontSize: 13, marginBottom: 12 }}>
                    Attack as <strong>{myRules.emoji} {myCity}</strong>. Costs <strong>{SKIRMISH_COST} MMC</strong>. 
                    Your war chest: <strong style={{ color: myBalance >= SKIRMISH_COST ? "var(--lime)" : "var(--red)" }}>
                      {myBalance} MMC
                    </strong>
                  </div>

                  <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 6 }}>SELECT TARGET CITY:</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {ALL_CITIES.filter(c => c.name !== myCity).map((c) => (
                      <label
                        key={c.name}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          cursor: "pointer",
                          padding: "8px 10px",
                          border: `2px solid ${targetCity === c.name ? "var(--ink)" : "var(--paper-border)"}`,
                          borderRadius: 4,
                          background: targetCity === c.name ? "var(--paper-border)" : "transparent",
                          transition: "all 0.15s",
                        }}
                      >
                        <input
                          type="radio"
                          name="targetCity"
                          value={c.name}
                          checked={targetCity === c.name}
                          onChange={() => setTargetCity(c.name)}
                          style={{ accentColor: "var(--ink)" }}
                        />
                        <span style={{ fontSize: 18 }}>{c.emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div className="marker" style={{ fontSize: 13 }}>{c.name}</div>
                          <div className="mono" style={{ fontSize: 10, color: "var(--ink-soft)" }}>
                            Holds {territories[c.name] ?? 25}% territory
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>

                  {attackMsg && (
                    <div
                      className={`sticker ${attackMsg.ok ? "s-lime" : "s-pink"}`}
                      style={{ display: "block", marginBottom: 12, fontSize: 12, lineHeight: 1.5 }}
                    >
                      {attackMsg.text}
                    </div>
                  )}

                  <button
                    className="btn red"
                    style={{ width: "100%" }}
                    disabled={!targetCity || myBalance < SKIRMISH_COST || isAttacking}
                    onClick={handleAttack}
                  >
                    {isAttacking ? "⏳ Skirmish in progress..." : `⚔️ Attack ${targetCity || "..."} — ${SKIRMISH_COST} MMC`}
                  </button>

                  <hr className="rule" style={{ margin: "14px 0" }} />
                  <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 8 }}>
                    Or run a free AI simulation (no MMC cost):
                  </div>
                  <button
                    className="btn lime ghost"
                    style={{ width: "100%" }}
                    disabled={isAttacking}
                    onClick={handleFreeSimulation}
                  >
                    🎲 Simulate Random Skirmish
                  </button>
                </>
              ) : (
                <>
                  <p className="hand" style={{ fontSize: 13, marginBottom: 14 }}>
                    Claim a passport to launch real skirmishes and seize territory for your city.
                  </p>
                  <button
                    className="btn lime"
                    style={{ width: "100%" }}
                    disabled={isAttacking}
                    onClick={handleFreeSimulation}
                  >
                    🎲 Simulate Random Skirmish
                  </button>
                </>
              )}
            </div>

            {/* ── BATTLE LOG ─────────────────────────────────────────────────── */}
            <div className="paper pin dark">
              <span className="card-title" style={{ color: "var(--lime)" }}>📜 BATTLE LOG</span>
              <div
                className="mono"
                style={{
                  height: 280,
                  overflowY: "auto",
                  fontSize: 11,
                  background: "var(--board-2)",
                  border: "2.5px solid var(--bc)",
                  borderRadius: 4,
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  lineHeight: 1.5,
                  color: "var(--bone)",
                }}
              >
                {skirmishLog.length === 0 ? (
                  <div style={{ color: "var(--ink-soft)" }}>No skirmishes yet. The border is peaceful... for now.</div>
                ) : (
                  skirmishLog.map((r) => {
                    const attackerEmoji = ALL_CITIES.find(c => c.name === r.attackerCity)?.emoji ?? "⚔️";
                    const defenderEmoji = ALL_CITIES.find(c => c.name === r.defenderCity)?.emoji ?? "🛡️";
                    const won = r.winner === r.attackerCity;
                    return (
                      <div
                        key={r.id}
                        style={{ borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 6 }}
                      >
                        <div>
                          {attackerEmoji} <strong>{r.attackerCity}</strong> ⚔️ {defenderEmoji} <strong>{r.defenderCity}</strong>
                        </div>
                        <div style={{ color: won ? "#b5e853" : "#f48fb1" }}>
                          {won
                            ? `→ ${r.winner} WINS! +${r.territoryGained}% seized (${r.attackerScore} vs ${r.defenderScore})`
                            : `→ ${r.winner} DEFENDED (${r.attackerScore} vs ${r.defenderScore})`}
                        </div>
                        <div style={{ color: "var(--ink-soft)", fontSize: 10 }}>
                          {r.initiator ? "🧑 Citizen-launched" : "🤖 AI sim"} · {timeAgo(r.at)}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── CITY CONSTITUTION ─────────────────────────────────────────── */}
            <div className="paper p-yellow taped tape-pink">
              <span className="card-title">📖 City Constitution + Border Treaty</span>
              <p className="hand" style={{ fontSize: 13, marginBottom: 12 }}>
                Under the Treaty of 2025, all border disputes are resolved through brainrot combat. Territory captured in battle stays captured until reclaimed.
              </p>
              {ALL_CITIES.map((city) => (
                <div key={city.name} style={{ borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 10, marginBottom: 10 }}>
                  <div className="marker" style={{ fontSize: 13, marginBottom: 4 }}>
                    {city.emoji} {city.name}
                    <span className={`sticker flat ${city.accentClass}`} style={{ fontSize: 10, marginLeft: 8 }}>{city.faction}</span>
                  </div>
                  <div className="hand" style={{ fontSize: 11 }}>🟢 {city.perk}</div>
                  <div className="hand" style={{ fontSize: 11 }}>🔴 {city.debuff}</div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <Ticker />
    </>
  );
}
