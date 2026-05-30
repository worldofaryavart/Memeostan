"use client";

import { useEffect, useState } from "react";
import { bootNation } from "@/data/seed";
import { startCampaignLoop } from "@/ai/engine";
import { recordGdbSnapshot } from "@/lib/economy";
import { elections } from "@/lib/elections";
import { governance } from "@/lib/governance";

export default function NationWrapper({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      // 1. Check for query parameter reset override
      if (typeof window !== "undefined") {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("reset") === "true") {
          window.localStorage.clear();
          // Remove '?reset=true' from the URL bar without reloading
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        }
      }

      // 2. Boot/seed the nation
      bootNation();
      setReady(true);

      // 2. Start the AI campaign loop (which posts, replies, and votes periodically)
      const campaign = startCampaignLoop(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new Event("nation-update"));
        }
      }, 120000);

      // 3. Start the national database state clock
      const tick = window.setInterval(() => {
        // Periodic state snapshots and resolution steps
        try {
          recordGdbSnapshot();
          elections.resolveElection();
          governance.resolveExpired();
          
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("nation-update"));
          }
        } catch (err: any) {
          console.error("Error during nation state tick:", err);
        }
      }, 4000);

      return () => {
        window.clearInterval(campaign);
        window.clearInterval(tick);
      };
    } catch (err: any) {
      console.error("Boot error:", err);
      setError(err.message || String(err));
    }
  }, []);

  if (error) {
    return (
      <div style={{ background: "var(--board)", minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>
        <div className="paper p-red" style={{ maxWidth: 500, padding: 30, textAlign: "center", border: "3px solid #000" }}>
          <h2 className="poster" style={{ fontSize: 28, marginBottom: 15, color: "#fff" }}>💥 BOOT CRASH DETECTED</h2>
          <p className="mono" style={{ fontSize: 13, marginBottom: 20, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.3)", padding: 15, borderRadius: 6, color: "#fff", textAlign: "left" }}>
            {error}
          </p>
          <button className="btn yellow" onClick={() => { localStorage.clear(); window.location.reload(); }}>
            RESET LOCALSTORAGE & RELOAD
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div style={{ background: "var(--board)", minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <p className="poster" style={{ padding: 80, textAlign: "center", fontSize: 30, color: "var(--bone)" }}>
          🧠 booting the nation… 10%
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
