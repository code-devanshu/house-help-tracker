"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { AuthButtons } from "@/components/AuthButtons";
import {
  deleteWorker,
  loadAppData,
  saveAppData,
  upsertWorker,
} from "@/lib/storage/localStore";
import type { Draft, Worker } from "@/lib/storage/schema";
import { makeId, timeAgo } from "@/lib/utils/id";
import { getAppData, syncAppData } from "./action";
import { useLocalStorageAutoSync } from "@/hooks/useLocalStorageAutoSync";

export default function WorkersPage() {
  useLocalStorageAutoSync({ debounceMs: 1000 });
  const [isPending, startTransition] = useTransition();

  // ✅ Fix: Initialize state directly from local storage.
  // This prevents the "cascading render" error by setting the initial state synchronously.
  const [workers, setWorkers] = useState<Worker[]>(() => {
    // This runs only once on initialization
    if (typeof window !== "undefined") {
      const data = loadAppData();
      return data.workers;
    }
    return [];
  });

  const [draft, setDraft] = useState<Draft>({
    name: "",
    defaultShiftLabel: "",
  });

  // 1. INITIAL SYNC ON MOUNT
  useEffect(() => {
    startTransition(async () => {
      try {
        const remote = await getAppData();
        if (remote?.data) {
          // Sync Server -> Local
          saveAppData(remote.data, { silent: true });
          setWorkers(remote.data.workers);
        } else {
          // Sync Local -> Server (First time setup)
          const currentLocal = loadAppData();
          await syncAppData(currentLocal);
        }
      } catch (err) {
        console.error("Initial sync failed:", err);
      }
    });
  }, []);

  // 2. REUSABLE PERSISTENCE LOGIC
  // Called from Event Handlers (Add/Delete)
  const persistAndSync = (nextData: ReturnType<typeof loadAppData>) => {
    // Update local state for instant UI feedback (Optimistic)
    setWorkers(nextData.workers);

    // Sync to Supabase in the background via Server Action
    startTransition(async () => {
      const result = await syncAppData(nextData);
      if (!result.ok) {
        console.error("Cloud sync failed:", result.error);
      }
    });
  };

  // 3. HANDLERS
  const canAdd = useMemo(() => draft.name.trim().length >= 2, [draft.name]);
  const empty = workers.length === 0;

  const handleAdd = () => {
    if (!canAdd) return;

    const now = Date.now();
    const worker: Worker = {
      id: makeId("worker"),
      name: draft.name.trim(),
      defaultShiftLabel: draft.defaultShiftLabel.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const next = upsertWorker(worker);
    persistAndSync(next);
    setDraft({ name: "", defaultShiftLabel: "" });
  };

  const handleDelete = (workerId: string) => {
    const ok = window.confirm("Delete this worker and all their entries?");
    if (!ok) return;

    const next = deleteWorker(workerId);
    persistAndSync(next);
  };

  return (
    <main className="text-slate-100">
      <header className="border-b border-white/10 bg-[#0B1020]/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-5">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white">
                  Workers
                </h1>
                <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-1 text-[11px] font-medium text-indigo-400 ring-1 ring-indigo-400/20">
                  Cloud-synced
                </span>
                <span className="inline-flex items-center rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium text-white/70 ring-1 ring-white/10">
                  {workers.length} total
                </span>
              </div>
              <p className="mt-1 max-w-[62ch] text-sm text-white/55">
                Manage your team. Changes are saved locally and synced to your
                account automatically.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2">
                <AuthButtons />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* Left: Add worker Sidebar */}
          <aside className="rounded-2xl border border-white/10 bg-[#0F1730] shadow-xl">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-white/90">
                Add worker
              </div>
              <div className="mt-1 text-xs text-white/55">
                Create a worker profile.
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-white/80">Name</span>
                <input
                  value={draft.name}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g., Yashoda di"
                  className="h-11 rounded-xl border border-white/10 bg-[#0B1020] px-4 text-sm text-white outline-none focus:border-indigo-400/50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-white/80">
                  Default shift label
                </span>
                <input
                  value={draft.defaultShiftLabel}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      defaultShiftLabel: e.target.value,
                    }))
                  }
                  placeholder="Morning / Evening"
                  className="h-11 rounded-xl border border-white/10 bg-[#0B1020] px-4 text-sm text-white outline-none focus:border-indigo-400/50"
                />
              </label>

              <button
                type="button"
                onClick={handleAdd}
                disabled={!canAdd || isPending}
                className={`h-11 w-full rounded-xl px-4 text-sm font-semibold transition ${
                  canAdd
                    ? "bg-indigo-500 text-white hover:bg-indigo-400"
                    : "bg-white/10 text-white/40"
                }`}
              >
                {isPending ? "Syncing..." : "Add worker"}
              </button>
            </div>

            {/* Sync Status Footer */}
            <div className="border-t border-white/10 bg-black/10 px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPending ? "bg-yellow-400 animate-pulse" : "bg-green-500"
                  }`}
                />
                <span>
                  {isPending ? "Syncing changes..." : "Cloud is up to date"}
                </span>
              </div>
            </div>
          </aside>

          {/* Right: List Section */}
          <div className="rounded-2xl border border-white/10 bg-[#0F1730] shadow-xl">
            <div className="flex items-start justify-between gap-3 border-b border-white/10 px-6 py-4">
              <div className="text-sm font-semibold text-white/90">
                Your workers
              </div>
            </div>

            {empty ? (
              <div className="p-6 text-center text-white/40 text-sm">
                No workers added yet.
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {workers.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/5 transition-colors"
                  >
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {w.name}
                      </div>
                      <div className="text-xs text-white/40">
                        Updated {timeAgo(w.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/workers/${w.id}`}
                        className="px-3 py-1.5 bg-white text-black text-xs font-bold rounded-lg hover:bg-gray-200"
                      >
                        Open
                      </Link>
                      <button
                        onClick={() => handleDelete(w.id)}
                        className="px-3 py-1.5 border border-white/10 text-xs font-bold rounded-lg text-white/80 hover:bg-white/5"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
