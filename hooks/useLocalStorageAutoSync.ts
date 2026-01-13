"use client";

import { useEffect, useRef } from "react";
import type { AppData } from "@/lib/storage/schema";
import { loadAppData } from "@/lib/storage/localStore";
import { syncAppData } from "@/app/workers/action";

type Options = {
  debounceMs?: number;
  enabled?: boolean;
};

export function useLocalStorageAutoSync({
  debounceMs = 1000,
  enabled = true,
}: Options = {}) {
  const timerRef = useRef<number | null>(null);
  const syncingRef = useRef(false);
  const lastPayloadRef = useRef<string>("");

  useEffect(() => {
    if (!enabled) return;

    const handler = () => {
      // debounce rapid changes
      if (timerRef.current) window.clearTimeout(timerRef.current);

      timerRef.current = window.setTimeout(async () => {
        if (syncingRef.current) return;

        const data: AppData = loadAppData();
        const payload = JSON.stringify(data);

        // avoid resync if nothing changed
        if (payload === lastPayloadRef.current) return;
        lastPayloadRef.current = payload;

        syncingRef.current = true;
        try {
          const res = await syncAppData(data);
          if (!res.ok) {
            console.error("Sync failed:", res.error);
          }
        } catch (e) {
          console.error("Sync exception:", e);
        } finally {
          syncingRef.current = false;
        }
      }, debounceMs);
    };

    window.addEventListener("house_help_appdata_changed", handler);

    return () => {
      window.removeEventListener("house_help_appdata_changed", handler);
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [debounceMs, enabled]);
}
