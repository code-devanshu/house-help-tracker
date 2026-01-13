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
    if (!enabled) {
      console.debug("[AutoSync] Disabled");
      return;
    }

    console.debug("[AutoSync] Enabled", { debounceMs });

    const handler = () => {
      console.debug("[AutoSync] Change event received");

      // debounce rapid changes
      if (timerRef.current) {
        console.debug("[AutoSync] Clearing previous debounce");
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(async () => {
        if (syncingRef.current) {
          console.debug("[AutoSync] Sync already in progress, skipping");
          return;
        }

        console.debug("[AutoSync] Debounce elapsed, preparing sync");

        const data: AppData = loadAppData();
        const payload = JSON.stringify(data);

        // avoid resync if nothing changed
        if (payload === lastPayloadRef.current) {
          console.debug("[AutoSync] Payload unchanged, skipping sync");
          return;
        }

        lastPayloadRef.current = payload;
        syncingRef.current = true;

        console.debug("[AutoSync] Sync started", {
          bytes: payload.length,
        });

        try {
          const res = await syncAppData(data);

          if (res.ok) {
            console.debug("[AutoSync] Sync successful", {
              updatedAt: res.data.updated_at,
            });
          } else {
            console.error("[AutoSync] Sync failed", res.error);
          }
        } catch (e) {
          console.error("[AutoSync] Sync exception", e);
        } finally {
          syncingRef.current = false;
          console.debug("[AutoSync] Sync finished");
        }
      }, debounceMs);
    };

    window.addEventListener("house_help_appdata_changed", handler);
    console.debug("[AutoSync] Event listener attached");

    return () => {
      window.removeEventListener("house_help_appdata_changed", handler);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      console.debug("[AutoSync] Cleaned up");
    };
  }, [debounceMs, enabled]);
}
