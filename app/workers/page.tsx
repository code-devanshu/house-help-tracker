"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { showToast } from "@/components/Toast";
import {
  archiveWorker,
  deleteWorker,
  loadAppData,
  restoreWorker,
  saveAppData,
  upsertWorker,
} from "@/lib/storage/localStore";
import type { AppData, Draft, Worker } from "@/lib/storage/schema";
import { makeId, timeAgo } from "@/lib/utils/id";
import { getAppData, syncAppData } from "./action";

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WorkersPage() {
  const [isPending, startTransition] = useTransition();
  const [initialLoading, setInitialLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const [appData, setAppData] = useState<AppData>(() => {
    if (typeof window !== "undefined") return loadAppData();
    return { version: 3, workers: [], entries: [], monthLocks: [], salaryConfigs: [], deductions: [] };
  });

  const workers = appData.workers;
  const [draft, setDraft] = useState<Draft>({ name: "", defaultShiftLabel: "", startDate: new Date().toISOString().slice(0, 10) });
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean; workerId: string | null; workerName: string; typed: string;
  }>({ open: false, workerId: null, workerName: "", typed: "" });
  const [linkModal, setLinkModal] = useState<{ open: boolean; workerId: string | null }>({ open: false, workerId: null });

  const activeWorkers = useMemo(() => workers.filter((w) => !w.archivedAt), [workers]);
  const archivedWorkers = useMemo(() => workers.filter((w) => !!w.archivedAt), [workers]);
  const canAdd = useMemo(() => draft.name.trim().length >= 2, [draft.name]);

  // Group active workers by personId. Workers without personId are solo groups.
  const workerGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: { personId: string | null; workers: Worker[] }[] = [];
    for (const w of activeWorkers) {
      if (!w.personId) { groups.push({ personId: null, workers: [w] }); continue; }
      if (seen.has(w.personId)) continue;
      seen.add(w.personId);
      groups.push({ personId: w.personId, workers: activeWorkers.filter((a) => a.personId === w.personId) });
    }
    return groups;
  }, [activeWorkers]);

  // Workers that can be picked in the link modal (not in the same group)
  const linkableWorkers = useMemo(() => {
    if (!linkModal.workerId) return [];
    const current = workers.find((w) => w.id === linkModal.workerId);
    return activeWorkers.filter(
      (w) => w.id !== linkModal.workerId && !(current?.personId && w.personId === current.personId),
    );
  }, [linkModal.workerId, activeWorkers, workers]);

  useEffect(() => {
    startTransition(async () => {
      try {
        const remote = await getAppData();
        if (remote?.data) {
          saveAppData(remote.data, { silent: true });
          setAppData(remote.data);
        } else {
          const local = loadAppData();
          setAppData(local);
          await syncAppData(local);
        }
      } catch {
        showToast("Could not load cloud data. Showing local data.", "error");
      } finally {
        setInitialLoading(false);
      }
    });
  }, []);

  const persistAndSync = (nextData: ReturnType<typeof loadAppData>) => {
    setAppData(nextData);
    startTransition(async () => {
      const result = await syncAppData(nextData);
      if (!result.ok) showToast("Sync failed. Changes saved locally.", "error");
    });
  };

  const handleAdd = () => {
    if (!canAdd) return;
    const now = Date.now();
    const next = upsertWorker({
      id: makeId("worker"), name: draft.name.trim(),
      defaultShiftLabel: draft.defaultShiftLabel.trim() || undefined,
      startDate: draft.startDate || undefined,
      createdAt: now, updatedAt: now,
    });
    persistAndSync(next);
    setDraft({ name: "", defaultShiftLabel: "", startDate: new Date().toISOString().slice(0, 10) });
    setAddOpen(false);
  };

  const handleArchive = (w: Worker) => { persistAndSync(archiveWorker(w.id)); showToast(`${w.name} archived.`, "info"); };
  const handleRestore = (w: Worker) => { persistAndSync(restoreWorker(w.id)); showToast(`${w.name} restored.`, "success"); };

  const handleLink = (workerAId: string, workerBId: string) => {
    const a = workers.find((w) => w.id === workerAId)!;
    const b = workers.find((w) => w.id === workerBId)!;
    const personId = a.personId ?? b.personId ?? makeId("person");
    const now = Date.now();
    upsertWorker({ ...a, personId, updatedAt: now });
    persistAndSync(upsertWorker({ ...b, personId, updatedAt: now }));
    setLinkModal({ open: false, workerId: null });
    showToast("Linked as same person.", "success");
  };

  const handleUnlink = (w: Worker) => {
    persistAndSync(upsertWorker({ ...w, personId: undefined, updatedAt: Date.now() }));
    showToast(`${w.name} unlinked.`, "info");
  };
  const openDeleteModal = (worker: Worker) => setDeleteModal({ open: true, workerId: worker.id, workerName: worker.name, typed: "" });
  const closeDeleteModal = () => setDeleteModal({ open: false, workerId: null, workerName: "", typed: "" });
  const confirmDeleteModal = () => {
    if (!deleteModal.workerId) return;
    if (deleteModal.typed.trim().toLowerCase() !== deleteModal.workerName.trim().toLowerCase()) return;
    persistAndSync(deleteWorker(deleteModal.workerId));
    closeDeleteModal();
  };

  return (
    <main className="px-4 pt-8 pb-16 text-slate-100">

      {/* ── Page header ── */}
      <div className="mb-6">
        {/* Row 1: Title + Add button */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">Workers</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-white/45">
              {initialLoading ? "Loading…" : `${activeWorkers.length} active${archivedWorkers.length ? ` · ${archivedWorkers.length} archived` : ""}`}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Sync indicator — desktop only */}
            <div className={`hidden items-center gap-1.5 text-xs sm:flex ${isPending ? "text-amber-400" : "text-slate-400 dark:text-white/30"}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${isPending ? "bg-amber-400 animate-pulse" : "bg-green-500"}`} />
              {isPending ? "Syncing…" : "Synced"}
            </div>
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white shadow-[0_4px_14px_rgba(99,102,241,0.4)] transition hover:bg-indigo-400 active:scale-[0.98]"
            >
              <span className="text-base leading-none">+</span>
              <span className="hidden sm:inline">Add worker</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>

      </div>

      {/* ── Workers list ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.06)] dark:border-white/7 dark:bg-white/2.5 dark:shadow-[0_1px_3px_rgba(0,0,0,0.3)]">
        {initialLoading ? (
          <div className="divide-y divide-slate-100 dark:divide-white/6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-xl bg-slate-100 animate-pulse dark:bg-white/6" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-32 rounded-md bg-slate-100 animate-pulse dark:bg-white/6" />
                  <div className="h-2.5 w-20 rounded-md bg-slate-100 animate-pulse dark:bg-white/4" />
                </div>
                <div className="h-4 w-16 rounded-md bg-slate-100 animate-pulse dark:bg-white/6" />
              </div>
            ))}
          </div>
        ) : activeWorkers.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-white/5">👥</div>
            <div>
              <div className="text-sm font-medium text-slate-500 dark:text-white/60">No workers yet</div>
              <div className="mt-1 text-xs text-slate-400 dark:text-white/30">Add your first worker to start tracking attendance.</div>
            </div>
            <button
              onClick={() => setAddOpen(true)}
              className="mt-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-50 px-3 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition dark:bg-indigo-500/15 dark:text-indigo-400 dark:hover:bg-indigo-500/25"
            >
              <span>+</span> Add worker
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/6">
            {workerGroups.map((group) =>
              group.workers.length === 1 ? (
                <WorkerRow
                  key={group.workers[0].id}
                  worker={group.workers[0]}
                  onArchive={() => handleArchive(group.workers[0])}
                  onLink={activeWorkers.length >= 2 ? () => setLinkModal({ open: true, workerId: group.workers[0].id }) : undefined}
                />
              ) : (
                <div key={group.personId} className="border-l-2 border-indigo-300 dark:border-indigo-500/40">
                  <div className="flex items-center gap-1.5 border-b border-slate-100 bg-indigo-50/60 px-4 py-2 dark:border-white/5 dark:bg-indigo-500/5">
                    <svg className="h-3 w-3 text-indigo-400" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="2.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <circle cx="9.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M6 5.5v2M6 7.5l-2 1.5M6 7.5l2 1.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
                    </svg>
                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">Same person</span>
                    <span className="text-[11px] text-slate-400 dark:text-white/30">· {group.workers.length} roles</span>
                  </div>
                  {group.workers.map((w) => (
                    <WorkerRow
                      key={w.id}
                      worker={w}
                      onArchive={() => handleArchive(w)}
                      onUnlink={() => handleUnlink(w)}
                    />
                  ))}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Archived section ── */}
      {!initialLoading && archivedWorkers.length > 0 && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 dark:border-white/6 dark:bg-white/1.5">
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-3.5 text-sm transition hover:bg-slate-100 dark:hover:bg-white/2"
          >
            <div className="flex items-center gap-2 text-slate-400 font-medium dark:text-white/40">
              <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12v2H2V4zM3 7h10l-1 6H4L3 7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
              Archived
              <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] dark:bg-white/10">{archivedWorkers.length}</span>
            </div>
            <span className={`text-slate-300 text-xs transition-transform duration-200 dark:text-white/25 ${showArchived ? "rotate-180" : ""}`}>▼</span>
          </button>

          {showArchived && (
            <div className="divide-y divide-slate-100 border-t border-slate-200 dark:divide-white/5 dark:border-white/6">
              {archivedWorkers.map((w) => (
                <div key={w.id} className="flex items-center gap-3 px-4 py-3.5 opacity-60 hover:opacity-90 transition sm:px-5">
                  <WorkerAvatar name={w.name} muted />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-700 dark:text-white/70">{w.name}</div>
                    <div className="text-xs text-slate-400 dark:text-white/30">Archived {w.archivedAt ? timeAgo(w.archivedAt) : ""}</div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => handleRestore(w)} className="h-8 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition">
                      Restore
                    </button>
                    <button onClick={() => openDeleteModal(w)} className="h-8 rounded-lg border border-rose-500/25 bg-rose-500/10 px-3 text-xs font-semibold text-rose-400 hover:bg-rose-500/20 transition">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Add Worker Modal ── */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-4 sm:items-center sm:pb-0" onMouseDown={(e) => { if (e.target === e.currentTarget) setAddOpen(false); }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0D1117] dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/7">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">New worker</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-white/40">Add a worker to start tracking.</div>
              </div>
              <button onClick={() => setAddOpen(false)} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-lg leading-none dark:text-white/40 dark:hover:bg-white/6 dark:hover:text-white/70">×</button>
            </div>
            <div className="px-5 py-5 space-y-4">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">Name</span>
                <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAddOpen(false); }} placeholder="e.g. Sunita Devi" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:placeholder:text-white/25" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">Shift label <span className="normal-case font-normal tracking-normal text-slate-400 dark:text-white/25">(optional)</span></span>
                <input value={draft.defaultShiftLabel} onChange={(e) => setDraft((d) => ({ ...d, defaultShiftLabel: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); if (e.key === "Escape") setAddOpen(false); }} placeholder="e.g. Morning shift" className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:placeholder:text-white/25" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-white/40">Start date <span className="normal-case font-normal tracking-normal text-slate-400 dark:text-white/25">(optional)</span></span>
                <input type="date" value={draft.startDate} onChange={(e) => setDraft((d) => ({ ...d, startDate: e.target.value }))} className="h-11 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 scheme-dark dark:border-white/10 dark:bg-white/4 dark:text-white" />
              </label>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setAddOpen(false)} className="h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-500 hover:bg-slate-100 transition dark:border-white/10 dark:bg-white/4 dark:text-white/60 dark:hover:bg-white/7">Cancel</button>
                <button type="button" onClick={handleAdd} disabled={!canAdd || isPending} className={`h-11 flex-1 rounded-xl text-sm font-semibold transition ${canAdd ? "bg-indigo-500 text-white hover:bg-indigo-400 shadow-[0_4px_14px_rgba(99,102,241,0.35)]" : "bg-slate-100 text-slate-300 dark:bg-white/6 dark:text-white/25"}`}>Add worker</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Link Modal ── */}
      {linkModal.open && linkModal.workerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setLinkModal({ open: false, workerId: null }); }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0D1117] dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-white/7">
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">Link as same person</div>
                <div className="mt-0.5 text-xs text-slate-500 dark:text-white/40">Pick the other role of the same person.</div>
              </div>
              <button onClick={() => setLinkModal({ open: false, workerId: null })} className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition text-lg leading-none dark:text-white/40 dark:hover:bg-white/6 dark:hover:text-white/70">×</button>
            </div>
            <div className="max-h-72 overflow-y-auto p-2">
              {linkableWorkers.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400 dark:text-white/30">No other workers to link with.</div>
              ) : (
                linkableWorkers.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleLink(linkModal.workerId!, w.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/5"
                  >
                    <WorkerAvatar name={w.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">{w.name}</div>
                      {w.defaultShiftLabel && <div className="text-xs text-slate-400 dark:text-white/35">{w.defaultShiftLabel}</div>}
                      {w.personId && <div className="text-[11px] text-indigo-500 dark:text-indigo-400">Already in a group — will merge</div>}
                    </div>
                    <svg className="h-4 w-4 shrink-0 text-slate-300 dark:text-white/20" viewBox="0 0 14 14" fill="none">
                      <path d="M5 7h4M7 5l2 2-2 2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Modal ── */}
      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDeleteModal(); }}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm dark:bg-black/70" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-[0_24px_64px_rgba(0,0,0,0.12)] dark:border-white/10 dark:bg-[#0D1117] dark:shadow-[0_24px_64px_rgba(0,0,0,0.7)]">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-white/7">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">Delete permanently</div>
              <div className="mt-0.5 text-xs text-slate-500 dark:text-white/40">This removes all attendance, salary, and deduction data.</div>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div className="rounded-xl border border-rose-500/20 bg-rose-500/8 px-4 py-3">
                <div className="text-xs text-rose-600 dark:text-rose-300/70">Type to confirm:</div>
                <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{deleteModal.workerName}</div>
              </div>
              <input autoFocus value={deleteModal.typed} onChange={(e) => setDeleteModal((m) => ({ ...m, typed: e.target.value }))} onKeyDown={(e) => { if (e.key === "Escape") closeDeleteModal(); if (e.key === "Enter") confirmDeleteModal(); }} placeholder="Type name here" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-rose-400 focus:ring-4 focus:ring-rose-500/10 dark:border-white/10 dark:bg-white/4 dark:text-white dark:placeholder:text-white/20" />
              <div className="flex gap-3">
                <button onClick={closeDeleteModal} className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-white/4 dark:text-white/60 dark:hover:bg-white/7">Cancel</button>
                <button onClick={confirmDeleteModal} disabled={deleteModal.typed.trim().toLowerCase() !== deleteModal.workerName.trim().toLowerCase() || isPending} className={`h-10 flex-1 rounded-xl text-sm font-semibold transition ${deleteModal.typed.trim().toLowerCase() === deleteModal.workerName.trim().toLowerCase() && !isPending ? "bg-rose-500 text-white hover:bg-rose-400" : "bg-slate-100 text-slate-300 dark:bg-white/6 dark:text-white/25"}`}>Delete permanently</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WorkerAvatar({ name, muted = false }: { name: string; muted?: boolean }) {
  const initials = name.split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]!.toUpperCase()).join("");
  const hue = name.charCodeAt(0) % 6;
  const colors = [
    "from-indigo-500/50 to-violet-500/50",
    "from-emerald-500/50 to-teal-500/50",
    "from-amber-500/50 to-orange-500/50",
    "from-rose-500/50 to-pink-500/50",
    "from-cyan-500/50 to-sky-500/50",
    "from-violet-500/50 to-purple-500/50",
  ];
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${colors[hue]} ${muted ? "opacity-50" : ""}`}>
      <span className="text-xs font-bold text-white">{initials}</span>
    </div>
  );
}

function WorkerRow({
  worker,
  onArchive,
  onLink,
  onUnlink,
}: {
  worker: Worker;
  onArchive: () => void;
  onLink?: () => void;
  onUnlink?: () => void;
}) {
  return (
    <div className="group relative flex items-center gap-3 px-4 py-4 transition hover:bg-slate-50 sm:px-5 dark:hover:bg-white/2.5">
      <Link href={`/workers/${worker.id}`} className="absolute inset-0 z-0" aria-label={`Open ${worker.name}`} />

      <WorkerAvatar name={worker.name} />

      <div className="relative z-10 min-w-0 flex-1 pointer-events-none select-none">
        <div className="truncate text-sm font-semibold text-slate-900 dark:text-white/90">{worker.name}</div>
        {(worker.defaultShiftLabel || worker.startDate) && (
          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400 dark:text-white/35">
            {worker.defaultShiftLabel && <span>{worker.defaultShiftLabel}</span>}
            {worker.defaultShiftLabel && worker.startDate && <span className="text-slate-200 dark:text-white/15">·</span>}
            {worker.startDate && <span>Since {worker.startDate}</span>}
          </div>
        )}
      </div>

      <div className="relative z-10 flex shrink-0 items-center gap-2">
        {/* Mobile archive */}
        <button
          onClick={(e) => { e.stopPropagation(); onArchive(); }}
          className="flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-500 transition hover:border-amber-400/50 hover:bg-amber-50 hover:text-amber-600 sm:hidden dark:border-white/10 dark:text-white/40 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
        >
          Archive
        </button>

        <div className="hidden sm:flex items-center gap-2">
          {/* Unlink button — only for workers in a group */}
          {onUnlink && (
            <button
              onClick={(e) => { e.stopPropagation(); onUnlink(); }}
              title="Unlink from same person"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-rose-400/50 hover:bg-rose-50 hover:text-rose-500 transition dark:border-white/10 dark:text-white/35 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                <path d="M9 5a2.5 2.5 0 0 1 0 3.5l-1 1A2.5 2.5 0 0 1 4.5 6l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5 9a2.5 2.5 0 0 1 0-3.5l1-1A2.5 2.5 0 0 1 9.5 8l-.5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M4 4l6 6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          {/* Link button — only for solo workers */}
          {onLink && (
            <button
              onClick={(e) => { e.stopPropagation(); onLink(); }}
              title="Link with another worker (same person)"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-indigo-400/50 hover:bg-indigo-50 hover:text-indigo-500 transition dark:border-white/10 dark:text-white/35 dark:hover:border-indigo-500/30 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none">
                <path d="M8.5 5.5a2.5 2.5 0 0 1 0 3.5l-1 1A2.5 2.5 0 0 1 4 6.5l.5-.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                <path d="M5.5 8.5a2.5 2.5 0 0 1 0-3.5l1-1A2.5 2.5 0 0 1 10 7.5l-.5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
          )}

          <button
            onClick={(e) => { e.stopPropagation(); onArchive(); }}
            title="Archive"
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:border-amber-400/50 hover:bg-amber-50 hover:text-amber-600 transition dark:border-white/10 dark:text-white/35 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-300"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none">
              <path d="M2 4h12v2H2V4z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M3 6h10l-1 7H4L3 6z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
              <path d="M6 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
          <Link
            href={`/workers/${worker.id}`}
            className="inline-flex h-7 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-900 hover:text-white transition dark:border-white/10 dark:bg-white/4 dark:text-white/60 dark:hover:bg-white dark:hover:text-slate-900"
          >
            Open →
          </Link>
        </div>
      </div>
    </div>
  );
}
