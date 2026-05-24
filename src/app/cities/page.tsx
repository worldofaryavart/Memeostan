"use client";

import { useState } from "react";
import { useNation } from "@/components/useNation";
import { allCitizens, me } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import { ALL_CITIES, getRulesForCitizen } from "@/lib/cities";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";

const SKIRMISH_TEMPLATES = [
  "unleashed a tactical mewing streak, leaving the opponents completely speechless.",
  "launched a barrage of deep-fried tiktok edits, causing temporary sensory overload.",
  "commenced a coordinated nap strike, rendering all battle activities irrelevant.",
  "deployed the legendary 'Skibidi Toilet' drill, breaking enemy frontlines with raw resonance.",
  "initiated a rizz tax collection, draining the opponents of 40 MMC in imaginary taxes.",
  "started a group mewing session, restoring +100 aura to their region.",
  "sent a series of cringe anime reaction images, dealing massive psychic damage.",
];

const CARD_STYLES = [
  { bg: "p-purple", fastener: "taped tape-blue" },
  { bg: "p-lime",   fastener: "staple" },
  { bg: "p-pink",   fastener: "pin" },
  { bg: "p-cyan",   fastener: "paper-clip" },
];

export default function CitiesPage() {
  const { refresh } = useNation();
  const citizens = allCitizens();
  const citizen = me();

  const [battleLogs, setBattleLogs] = useState<string[]>([
    "System: Nation is peaceful (for now). Border skirmishes are simulated client-side.",
  ]);

  // Aggregate stats per city name
  const getCityStats = (cityName: string) => {
    const cityCitizens = citizens.filter((c) => c.city === cityName || c.faction === ALL_CITIES.find(x => x.name === cityName)?.faction);
    const population = cityCitizens.length;
    const totalAura = cityCitizens.reduce((sum, c) => sum + c.aura, 0);
    const avgAura = population > 0 ? Math.round(totalAura / population) : 0;
    const totalMMC = cityCitizens.reduce((sum, c) => sum + ledger.balanceOf(c.address), 0);
    return { population, avgAura, totalMMC };
  };

  const handleSimulateSkirmish = () => {
    const idxA = Math.floor(Math.random() * ALL_CITIES.length);
    let idxB = Math.floor(Math.random() * ALL_CITIES.length);
    while (idxA === idxB) idxB = Math.floor(Math.random() * ALL_CITIES.length);
    const cityA = ALL_CITIES[idxA];
    const cityB = ALL_CITIES[idxB];
    const action = SKIRMISH_TEMPLATES[Math.floor(Math.random() * SKIRMISH_TEMPLATES.length)];
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const outcome = `⚔️ [${time}] ${cityA.emoji} ${cityA.name} ${action} ${cityB.emoji} ${cityB.name} is shaken!`;
    setBattleLogs((prev) => [outcome, ...prev.slice(0, 14)]);
  };

  // My city rules (if I have a passport)
  const myRules = getRulesForCitizen(citizen);

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell">
        <section className="hero">
          <span className="kicker">municipal division logs</span>
          <h1>Cities of Memeostan</h1>
          <div className="sub">Four factions. One continent. Endless battle for the supreme vibe.</div>
        </section>

        {/* ── MY CITY RULES CALLOUT ─────────────────────────────────────────── */}
        {citizen && citizen.city && (
          <div
            className={`paper ${CARD_STYLES[ALL_CITIES.findIndex(c => c.name === citizen.city) % 4]?.bg ?? "p-purple"} pin`}
            style={{ marginBottom: 28 }}
          >
            <span className="card-title">🛂 YOUR CITY: {myRules.emoji} {myRules.name}</span>
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10 }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
                  ACTIVE PERK
                </div>
                <div className="sticker s-lime" style={{ display: "inline-block", fontSize: 12, lineHeight: 1.5 }}>
                  🟢 {myRules.perk}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div className="hand" style={{ fontSize: 12, color: "var(--ink-soft)", marginBottom: 4 }}>
                  ACTIVE DEBUFF
                </div>
                <div className="sticker s-pink" style={{ display: "inline-block", fontSize: 12, lineHeight: 1.5 }}>
                  🔴 {myRules.debuff}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="cols">
          {/* LEFT: City Cards Grid */}
          <div className="col-stack">
            <div
              className="cabinet-grid"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}
            >
              {ALL_CITIES.map((city, idx) => {
                const stats = getCityStats(city.name);
                const style = CARD_STYLES[idx % CARD_STYLES.length];
                const isMyCity = citizen?.city === city.name;

                return (
                  <div
                    key={city.name}
                    className={`paper ${style.bg} ${style.fastener}`}
                    style={{ position: "relative" }}
                  >
                    {isMyCity && (
                      <div
                        className="sticker s-lime"
                        style={{
                          position: "absolute",
                          top: -10,
                          right: 12,
                          fontSize: 10,
                          zIndex: 2,
                        }}
                      >
                        📍 YOUR CITY
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 40 }}>{city.emoji}</span>
                      <span className={`sticker ${city.accentClass}`}>{city.faction}</span>
                    </div>

                    <h2 className="marker" style={{ fontSize: 22, margin: "6px 0" }}>{city.name}</h2>
                    <p className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", minHeight: 40, margin: "6px 0 12px 0" }}>
                      &ldquo;{city.motto}&rdquo;
                    </p>

                    <hr className="rule" />

                    {/* Stats */}
                    <div className="mono" style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, marginTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>👥 Population:</span>
                        <strong>{stats.population} Citizens</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>✨ Average Aura:</span>
                        <strong>{stats.avgAura.toLocaleString()}</strong>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span>🪙 Wealth (MMC):</span>
                        <strong>{stats.totalMMC.toLocaleString()} MMC</strong>
                      </div>
                    </div>

                    {/* City Rules */}
                    <hr className="rule" style={{ margin: "12px 0 10px" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ fontSize: 12 }}>🟢</span>
                        <span className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                          <strong>PERK:</strong> {city.perk}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
                        <span style={{ fontSize: 12 }}>🔴</span>
                        <span className="hand" style={{ fontSize: 11, color: "var(--ink-soft)", lineHeight: 1.4 }}>
                          <strong>DEBUFF:</strong> {city.debuff}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Sidebar */}
          <aside className="col-stack">

            {/* City Constitution Panel */}
            <div className="paper p-yellow binder-clip">
              <span className="card-title">📜 CITY CONSTITUTION</span>
              <div className="hand" style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 14 }}>
                All city rules are enforced automatically. Your MMC rewards, aura gains, and transfer fees are modified based on where you live.
              </div>
              {ALL_CITIES.map((city) => (
                <div
                  key={city.name}
                  style={{ borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 12, marginBottom: 12 }}
                >
                  <div className="marker" style={{ fontSize: 14, marginBottom: 6 }}>
                    {city.emoji} {city.name}
                    <span className={`sticker flat ${city.accentClass}`} style={{ fontSize: 10, marginLeft: 8 }}>
                      {city.faction}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div className="hand" style={{ fontSize: 12 }}>
                      🟢 <strong>Perk:</strong> {city.perk}
                    </div>
                    <div className="hand" style={{ fontSize: 12 }}>
                      🔴 <strong>Debuff:</strong> {city.debuff}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Border Wars Simulation Console */}
            <div className="paper pin dark">
              <span className="card-title" style={{ color: "var(--lime)" }}>⚔️ BORDER WAR SIMULATOR</span>
              <p className="hand" style={{ fontSize: 14, color: "var(--bone-soft)", marginBottom: 14 }}>
                Provoke tensions between cities to test tactical brainrot capabilities.
              </p>

              <button className="btn lime" style={{ width: "100%" }} onClick={handleSimulateSkirmish}>
                Provoke Skirmish 🚀
              </button>

              <hr className="rule" style={{ borderColor: "var(--ink-soft)", margin: "16px 0" }} />

              <div className="section-sub" style={{ color: "var(--lime)", marginBottom: 8 }}>TACTICAL LOG FEED</div>
              <div
                className="mono"
                style={{
                  height: 220,
                  overflowY: "auto",
                  fontSize: 11,
                  background: "var(--board-2)",
                  border: "2.5px solid var(--bc)",
                  borderRadius: 4,
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  lineHeight: 1.4,
                  color: "var(--bone)",
                }}
              >
                {battleLogs.map((log, i) => (
                  <div key={i} style={{ borderBottom: "1px dashed var(--ink-soft)", paddingBottom: 4 }}>
                    {log}
                  </div>
                ))}
              </div>
            </div>

            {/* Border Treaty note */}
            <div className="paper p-orange taped tape-pink">
              <span className="card-title">📖 Border Treaty</span>
              <p className="hand" style={{ fontSize: 13 }}>
                Under the Treaty of 2025, no physical weapons are allowed. All geopolitical border disputes must be resolved solely through high-intensity ratios on the Public Square.
              </p>
            </div>
          </aside>
        </div>
      </div>

      <Ticker />
    </>
  );
}
