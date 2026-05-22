"use client";

import { useEffect, useState, useCallback } from "react";

// All nation state lives in the db module (a singleton). React components read
// from it directly; after any mutation they call refresh() to re-render.
// The NationWrapper handles initialization, so we listen to "nation-update" events
// to stay in sync.
export function useNation() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleUpdate = () => setVersion((v) => v + 1);
    window.addEventListener("nation-update", handleUpdate);
    return () => window.removeEventListener("nation-update", handleUpdate);
  }, []);

  const refresh = useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("nation-update"));
    }
  }, []);

  return { ready: true, refresh };
}

