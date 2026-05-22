"use client";

import { useState } from "react";
import { useNation } from "@/components/useNation";
import { allCitizens } from "@/lib/citizens";
import { ledger } from "@/lib/ledger";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";

interface CityConfig {
  name: string;
  faction: string;
  emoji: string;
  motto: string;
  accentClass: string;
}

const CITIES: CityConfig[] = [
  { name: "Brainrot City", faction: "NPC", emoji: "🧠", motto: "Where vibes go to decay. The capital of NPC energy.", accentClass: "s-purple" },
  { name: "Neo Ohio", faction: "Sigma", emoji: "🗿", motto: "Always has been. Absolute peak sigma energy.", accentClass: "s-lime" },
  { name: "Rizzland", faction: "Rizzler", emoji: "👑", motto: "Maximum charisma, zero filter. The elite rizzler enclave.", accentClass: "s-pink" },
  { name: "Napistan", faction: "NapEnjoyer", emoji: "😴", motto: "Too tired to participate. The chillest timezone in the nation.", accentClass: "s-cyan" },
];

const SKIRMISH_TEMPLATES = [
  "unleashed a tactical mewing streak, leaving the opponents completely speechless.",
  "launched a barrage of deep-fried tiktok edits, causing temporary sensory overload.",
  "commenced a coordinated nap strike, rendering all battle activities irrelevant.",
  "deployed the legendary 'Skibidi Toilet' drill, breaking enemy frontlines with raw resonance.",
  "initiated a rizz tax collection, draining the opponents of 40 MMC in imaginary taxes.",
  "started a group mewing session, restoring +100 aura to their region.",
  "sent a series of cringe anime reaction images, dealing massive psychic damage.",
];

export default function CitiesPage() {
  const { refresh } = useNation();
  const citizens = allCitizens();

  // Battle simulation log state
  const [battleLogs, setBattleLogs] = useState<string[]>([
    "System: Nation is peaceful (for now). Border skirmishes are simulated client-side.",
  ]);

  // Aggregate stats per faction
  const getCityStats = (faction: string) => {
    const cityCitizens = citizens.filter((c) => c.faction === faction);
    const population = cityCitizens.length;
    const totalAura = cityCitizens.reduce((sum, c) => sum + c.aura, 0);
    const avgAura = population > 0 ? Math.round(totalAura / population) : 0;
    const totalMMC = cityCitizens.reduce((sum, c) => sum + ledger.balanceOf(c.address), 0);

    return { population, avgAura, totalMMC };
  };

  const handleSimulateSkirmish = () => {
    const idxA = Math.floor(Math.random() * CITIES.length);
    let idxB = Math.floor(Math.random() * CITIES.length);
    while (idxA === idxB) {
      idxB = Math.floor(Math.random() * CITIES.length);
    }
    const cityA = CITIES[idxA];
    const cityB = CITIES[idxB];
    const action = SKIRMISH_TEMPLATES[Math.floor(Math.random() * SKIRMISH_TEMPLATES.length)];
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const outcome = `⚔️ [${time}] ${cityA.emoji} ${cityA.name} ${action} ${cityB.emoji} ${cityB.name} is shaken!`;
    setBattleLogs((prev) => [outcome, ...prev.slice(0, 14)]);
  };

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell">
        <section className="hero">
          <span className="kicker">municipal division logs</span>
          <h1>Cities of Memeostan</h1>
          <div className="sub">Four factions. One continent. Endless battle for the supreme vibe.</div>
        </section>

        <div className="cols">
          {/* LEFT: The City Panels */}
          <div className="col-stack">
            <div className="cabinet-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
              {CITIES.map((city, idx) => {
                const stats = getCityStats(city.faction);
                const colors = ["p-purple", "p-lime", "p-pink", "p-cyan"];
                const fasteners = ["taped tape-blue", "staple", "pin", "paper-clip"];
                const skin = colors[idx % colors.length];
                const fastener = fasteners[idx % fasteners.length];
                return (
                  <div key={city.name} className={`paper ${skin} ${fastener}`} style={{ transform: `rotate(${(Math.random() * 2 - 1).toFixed(1)}deg)` }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 40 }}>{city.emoji}</span>
                      <span className={`sticker ${city.accentClass}`}>{city.faction}</span>
                    </div>

                    <h2 className="marker" style={{ fontSize: 22, marginTop: 10, margin: "6px 0" }}>{city.name}</h2>
                    <p className="hand" style={{ fontSize: 14, color: "var(--ink-soft)", minHeight: 40, margin: "6px 0 12px 0" }}>
                      &ldquo;{city.motto}&rdquo;
                    </p>

                    <hr className="rule" />

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
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Border Wars Simulation Console */}
          <aside className="col-stack">
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
                  height: 250,
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

            {/* National holidays and nonsense info */}
            <div className="paper p-yellow taped tape-pink">
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
