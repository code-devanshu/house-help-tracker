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

export default function WorkersPage() {
  const [isPending, startTransition] = useTransition();

  // ---------- STATE ----------
  const [workers, setWorkers] = useState<Worker[]>(() => {
    if (typeof window !== "undefined") {
      return loadAppData().workers;
    }
    return [];
  });

  const [draft, setDraft] = useState<Draft>({
    name: "",
    defaultShiftLabel: "",
  });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    workerId: string | null;
    workerName: string;
    typed: string;
  }>({
    open: false,
    workerId: null,
    workerName: "",
    typed: "",
  });

  // ---------- INITIAL SYNC ----------
  useEffect(() => {
    startTransition(async () => {
      try {
        const remote = await getAppData();

        if (remote?.data) {
          saveAppData(remote.data, { silent: true });
          setWorkers(remote.data.workers);
        } else {
          const local = loadAppData();
          await syncAppData(local);
        }
      } catch (err) {
        console.error("Initial sync failed:", err);
      }
    });
  }, []);

  // ---------- HELPERS ----------
  const persistAndSync = (nextData: ReturnType<typeof loadAppData>) => {
    setWorkers(nextData.workers);

    startTransition(async () => {
      const result = await syncAppData(nextData);
      if (!result.ok) {
        console.error("Cloud sync failed:", result.error);
      }
    });
  };

  const canAdd = useMemo(() => draft.name.trim().length >= 2, [draft.name]);
  const empty = workers.length === 0;

  // ---------- ADD ----------
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

  // ---------- DELETE MODAL ----------
  const openDeleteModal = (worker: Worker) => {
    setDeleteModal({
      open: true,
      workerId: worker.id,
      workerName: worker.name,
      typed: "",
    });
  };

  const closeDeleteModal = () => {
    setDeleteModal({
      open: false,
      workerId: null,
      workerName: "",
      typed: "",
    });
  };

  const confirmDeleteModal = () => {
    if (!deleteModal.workerId) return;

    if (deleteModal.typed.trim() !== deleteModal.workerName.trim()) return;

    const next = deleteWorker(deleteModal.workerId);
    persistAndSync(next);
    closeDeleteModal();
  };

  // ---------- RENDER ----------
  return (
    <main className="text-slate-100">
      {/* HEADER */}
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

            <div className="rounded-2xl border border-white/10 bg-white/4 px-3 py-2">
              <AuthButtons />
            </div>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
          {/* ADD WORKER */}
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

            <div className="border-t border-white/10 bg-black/10 px-5 py-4">
              <div className="flex items-center gap-2 text-xs text-white/55">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isPending ? "bg-yellow-400 animate-pulse" : "bg-green-500"
                  }`}
                />
                {isPending ? "Syncing changes..." : "Cloud is up to date"}
              </div>
            </div>
          </aside>

          {/* WORKERS LIST */}
          <div className="rounded-2xl border border-white/10 bg-[#0F1730] shadow-xl">
            <div className="border-b border-white/10 px-6 py-4 text-sm font-semibold text-white/90">
              Your workers
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
                    className="flex items-center justify-between px-6 py-4 hover:bg-white/5"
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
                        onClick={() => openDeleteModal(w)}
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

      {/* DELETE CONFIRM MODAL */}
      {deleteModal.open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeDeleteModal();
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          <div className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0B1020] shadow-[0_30px_90px_rgba(0,0,0,0.7)]">
            <div className="border-b border-white/10 px-5 py-4">
              <div className="text-sm font-semibold text-white">
                Confirm deletion
              </div>
              <div className="mt-1 text-xs text-white/55">
                This action is permanent.
              </div>
            </div>

            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
                <div className="text-xs font-semibold text-rose-100">
                  Type the worker name to confirm:
                </div>
                <div className="mt-1 text-sm font-extrabold text-white">
                  {deleteModal.workerName}
                </div>
              </div>

              <input
                autoFocus
                value={deleteModal.typed}
                onChange={(e) =>
                  setDeleteModal((m) => ({ ...m, typed: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeDeleteModal();
                  if (e.key === "Enter") confirmDeleteModal();
                }}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0F1730] px-4 text-sm text-white outline-none focus:border-rose-400/50"
              />

              <div className="flex gap-3">
                <button
                  onClick={closeDeleteModal}
                  className="h-11 flex-1 rounded-xl border border-white/10 bg-white/5 text-sm font-semibold text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>

                <button
                  onClick={confirmDeleteModal}
                  disabled={
                    deleteModal.typed.trim() !==
                      deleteModal.workerName.trim() || isPending
                  }
                  className={`h-11 flex-1 rounded-xl text-sm font-extrabold transition ${
                    deleteModal.typed.trim() ===
                      deleteModal.workerName.trim() && !isPending
                      ? "bg-rose-500 text-white hover:bg-rose-400"
                      : "bg-white/10 text-white/40"
                  }`}
                >
                  Delete permanently
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
