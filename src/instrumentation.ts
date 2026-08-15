// instrumentation.ts — the nation's heartbeat.
//
// Next calls register() once when the server process starts. On a long-running
// host (a VPS, a container) that gives the country a clock of its own: elections
// close, trials reach a verdict and economic events fire whether or not anybody
// has a tab open.
//
// Until now the world only advanced when a browser asked it to, which meant
// closing the last tab froze time — an election could sit past its deadline
// indefinitely. The client still ticks, because that same request doubles as its
// poll for fresh state, but it is no longer what keeps the country running.
//
// Serverless hosts don't run this usefully: each invocation is its own
// short-lived process. There, drive /api/action with a cron instead.

const TICK_INTERVAL_MS = 5000;

export async function register() {
  // Edge and build passes also load this module; only the long-lived Node server
  // should start a clock.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.MEMEOSTAN_DISABLE_WORLD_CLOCK === "1") return;

  // Imported lazily so the module graph for edge/build never pulls in the driver.
  const { applyAction } = await import("@/lib/actions");
  const { mutateState } = await import("@/lib/serverState");

  let running = false;

  const tick = async () => {
    if (running) return; // a slow tick must not stack up behind itself
    running = true;
    try {
      await mutateState(() =>
        applyAction({
          type: "world.tick",
          payload: {},
          address: "",
          nonce: `clock-${Date.now()}`,
          ts: Date.now(),
        })
      );
    } catch (err) {
      // A tick failing is not fatal — the next one will try again. Most likely
      // cause is the database being briefly unreachable.
      console.error("[memeostan] world clock tick failed:", err);
    } finally {
      running = false;
    }
  };

  setInterval(tick, TICK_INTERVAL_MS).unref?.();
  console.info(
    `[memeostan] world clock started — ticking every ${TICK_INTERVAL_MS / 1000}s`
  );
}
