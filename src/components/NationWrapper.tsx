"use client";

import { useEffect, useState } from "react";
import { startCampaignLoop } from "@/ai/engine";
import { db, loadStateFromServer } from "@/lib/db";
import { requestWorldTick, upgradeLegacyKeyIfNeeded } from "@/lib/actionClient";
import { adoptLegacySession } from "@/lib/session";

// How often we ask the server to advance the world and hand back fresh state.
// The server collapses ticks that arrive too close together, so more open tabs
// does not mean more elections resolving.
const TICK_MS = 5000;

export default function NationWrapper({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let tick = 0;
    let campaign = 0;

    try {
      // 1. `?reset=true` drops this browser's cached copy of the nation. It
      //    deliberately does NOT clear all of localStorage — your citizenship key
      //    lives there and there is no copy of it on the server, so wiping it
      //    would destroy the passport rather than refresh the page.
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get("reset") === "true") {
        db.clearLocal();
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 2. Recover identity from this browser, then load the nation from the server.
      //    Seeding now happens server-side on first read, so there is no bootNation()
      //    call here — a client can't invent citizens.
      adoptLegacySession();

      loadStateFromServer()
        .then(() => upgradeLegacyKeyIfNeeded())
        .catch((err) => console.error("Boot sequence problem:", err))
        .finally(() => setReady(true));

      // 3. AI chatter. The posts themselves are written server-side by /api/ai/*.
      campaign = startCampaignLoop(() => {
        window.dispatchEvent(new Event("nation-update"));
      }, 45000);

      // 4. The world clock. Resolution logic lives on the server; this only asks it
      //    to run, and only while the tab is actually being looked at.
      tick = window.setInterval(() => {
        if (document.visibilityState === "visible") requestWorldTick();
      }, TICK_MS);

      return () => {
        window.clearInterval(campaign);
        window.clearInterval(tick);
      };
    } catch (err: any) {
      console.error("Boot error:", err);
      setError(err.message || String(err));
      window.clearInterval(campaign);
      window.clearInterval(tick);
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
          {/* Clears the cached nation, not the citizenship key — a crash screen
              is the worst possible place to quietly delete someone's passport. */}
          <button className="btn yellow" onClick={() => { db.clearLocal(); window.location.reload(); }}>
            CLEAR CACHED NATION & RELOAD
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
