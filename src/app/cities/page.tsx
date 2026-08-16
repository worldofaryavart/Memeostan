"use client";

// /cities — what your city does to your economy.
//
// This page used to be 455 lines of territorial war: cities launching skirmishes
// at each other over percentages of a map, with a battle log and a control chart.
// It shared nothing with the law, the courts or the ledger, it needed a populated
// country to mean anything at all, and it was surface area competing with the one
// idea worth having.
//
// The war is gone. Cities stay, because they are cheap and they do something real:
// they are an identity you pick at registration and a set of live modifiers on
// what you earn. That is what this page is now — a reference a citizen can act on.

import { useNation } from "@/components/useNation";
import { me, allCitizens } from "@/lib/citizens";
import { ALL_CITIES, getRulesForCitizen } from "@/lib/cities";
import { RATES } from "@/lib/economy";
import TopBar from "@/components/TopBar";
import Ticker from "@/components/Ticker";
import FloatingStickers from "@/components/FloatingStickers";
import PageHero from "@/components/PageHero";
import { isStateAccount } from "@/lib/systemAccounts";

export default function CitiesPage() {
  const { refresh } = useNation();
  const citizen = me();
  const mine = getRulesForCitizen(citizen);

  const population = allCitizens().filter((c) => !isStateAccount(c.address));
  const headcount = (name: string) => population.filter((c) => c.city === name).length;

  return (
    <>
      <TopBar refresh={refresh} />

      <div className="shell" style={{ position: "relative" }}>
        <FloatingStickers preset="cities" />

        <PageHero
          kicker="four cities, four economies"
          title="CITIES"
          titleAccent="CITIES"
          tagline="where you live changes what you earn."
        />

        {citizen && (
          <div className="paper p-lime binder-clip" style={{ padding: 20, marginBottom: 20 }}>
            <span className="card-title">📍 YOUR CITY</span>
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 8 }}>
              <span style={{ fontSize: 40 }}>{mine.emoji}</span>
              <div style={{ minWidth: 0 }}>
                <div className="poster" style={{ fontSize: 22, lineHeight: 1 }}>{mine.name}</div>
                <div className="hand" style={{ fontSize: 14, color: "var(--ink-soft)" }}>{mine.motto}</div>
              </div>
            </div>
            <div className="mono" style={{ fontSize: 13, marginTop: 12, lineHeight: 1.6 }}>
              <div>✅ {mine.perk}</div>
              <div>⚠️ {mine.debuff}</div>
            </div>
          </div>
        )}

        <div className="grid-2">
          {ALL_CITIES.map((city) => {
            const isMine = citizen?.city === city.name;
            const postReward = Math.round(RATES.POST * city.postRewardMult);
            const upvoteReward = Math.round(RATES.UPVOTE_REWARD * city.upvoteRewardMult);

            return (
              <div
                key={city.name}
                className={`paper ${isMine ? "p-white" : "p-bone"} staple`}
                style={{ padding: 18, border: isMine ? "3px solid var(--good)" : undefined }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 32 }}>{city.emoji}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="poster" style={{ fontSize: 18, lineHeight: 1 }}>{city.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-soft)" }}>
                      {headcount(city.name)} citizen{headcount(city.name) === 1 ? "" : "s"} · {city.faction}
                    </div>
                  </div>
                  {isMine && <span className="sticker flat s-lime" style={{ fontSize: 10 }}>YOURS</span>}
                </div>

                <p className="hand" style={{ fontSize: 14, margin: "10px 0", color: "var(--ink)" }}>
                  {city.motto}
                </p>

                {/* The actual numbers, because "+20% post reward" is only useful
                    if you can see what it makes the reward. */}
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    background: "rgba(15, 11, 26, 0.06)",
                    borderRadius: 4,
                    padding: "8px 10px",
                    lineHeight: 1.7,
                  }}
                >
                  <div>post → {postReward} MMC</div>
                  <div>each upvote → {upvoteReward} MMC</div>
                  <div>spam tax → {city.spamTaxImmune ? "immune" : `${RATES.SPAM_TAX} MMC`}</div>
                  <div>
                    downvote → {city.downvoteAuraImmune ? "no aura loss" : `−${city.downvoteAuraPenalty} aura`}
                  </div>
                  {city.extraTransferFee > 0 && <div>transfers → +{city.extraTransferFee} MMC fee</div>}
                </div>

                <div className="mono" style={{ fontSize: 11, marginTop: 8, lineHeight: 1.6 }}>
                  <div>✅ {city.perk}</div>
                  <div>⚠️ {city.debuff}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="paper p-white staple" style={{ padding: 18, marginTop: 20 }}>
          <p className="hand" style={{ fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Rates shown are live — the Treasury retunes them as Gross Domestic Brainrot
            and the circulating supply move, so a city that pays well today may not
            tomorrow. Your city is set when you claim your passport. There is no war
            between cities; if you want to change what a city does to you, that is a
            bill, not a battle.
          </p>
        </div>
      </div>

      <Ticker />
    </>
  );
}
