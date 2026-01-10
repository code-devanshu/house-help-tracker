"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import type { Worker } from "@/lib/storage/schema";
import {
  deleteWorker,
  loadAppData,
  upsertWorker,
} from "@/lib/storage/localStore";
import { makeId } from "@/lib/utils/id";

type Draft = {
  name: string;
  defaultShiftLabel: string;
};

const sortWorkers = (list: Worker[]) =>
  [...list].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

const timeAgo = (ts: number) => {
  const diff = Date.now() - ts;
  const sec = Math.max(1, Math.floor(diff / 1000));
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return "just now";
};

export default function WorkersPage() {
  const [workers, setWorkers] = useState<Worker[]>(() => {
    const data = loadAppData();
    return sortWorkers(data.workers);
  });

  const [draft, setDraft] = useState<Draft>({
    name: "",
    defaultShiftLabel: "",
  });

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
    setWorkers(sortWorkers(next.workers));
    setDraft({ name: "", defaultShiftLabel: "" });
  };

  const handleDelete = (workerId: string) => {
    const ok = window.confirm("Delete this worker and all their entries?");
    if (!ok) return;

    const next = deleteWorker(workerId);
    setWorkers(sortWorkers(next.workers));
  };

  return (
    <main className="min-h-[calc(100vh-0px)] bg-linear-to-b from-slate-50 via-white to-white">
      {/* Top header strip */}
      <div className="border-b bg-white/70 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                Workers
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Track attendance and monthly salary — simple, fast, and synced
                later with Google login.
              </p>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100">
                  Local storage (for now)
                </span>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {workers.length} total
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-xs text-slate-500">
                Next: Google SSO + DB
              </span>
              <div className="h-10 w-10 rounded-2xl bg-linear-to-br from-indigo-600 to-slate-900 shadow-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          {/* Add worker card */}
          <section className="flex h-fit flex-col rounded-3xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
            <div className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Add worker
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Add a name + optional default label. Salary settings are
                    done inside the worker page.
                  </div>
                </div>

                <span className="rounded-full bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  Quick add
                </span>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    Name
                  </span>
                  <input
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, name: e.target.value }))
                    }
                    placeholder="e.g., Yashoda di"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                  <span className="text-xs text-slate-500">
                    Minimum 2 characters.
                  </span>
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    Default shift label (optional)
                  </span>
                  <input
                    value={draft.defaultShiftLabel}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        defaultShiftLabel: e.target.value,
                      }))
                    }
                    placeholder="e.g., Food / Cleaning / Morning"
                    className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
                  />
                  <span className="text-xs text-transparent select-none">
                    placeholder
                  </span>
                </label>
              </div>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={!canAdd}
                  className={
                    !canAdd
                      ? "h-12 cursor-not-allowed rounded-2xl bg-slate-200 px-5 text-sm font-semibold text-slate-500"
                      : "h-12 rounded-2xl bg-linear-to-r from-indigo-600 to-indigo-700 px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus:outline-none focus:ring-4 focus:ring-indigo-200"
                  }
                >
                  Add worker
                </button>

                <div className="text-sm text-slate-600">
                  {canAdd ? (
                    <span>
                      Added workers appear instantly.{" "}
                      <span className="text-slate-400">No refresh.</span>
                    </span>
                  ) : (
                    "Enter a valid name to enable."
                  )}
                </div>
              </div>
            </div>

            <div className="border-t bg-slate-50 px-6 py-4">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400/70" />
                <span>Soon: Sign in with Google and sync across devices</span>
              </div>
            </div>
          </section>

          {/* Workers list card */}
          <section className="rounded-3xl bg-white shadow-[0_10px_30px_rgba(15,23,42,0.06)] ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-3 px-6 py-6">
              <div>
                <div className="text-sm font-semibold text-slate-900">
                  Your workers
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  Open a worker to edit attendance, salary and month locks.
                </div>
              </div>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                {workers.length} total
              </span>
            </div>

            {empty ? (
              <div className="px-6 pb-6">
                <div className="rounded-2xl border border-dashed border-slate-200 bg-linear-to-b from-slate-50 to-white p-5">
                  <div className="text-sm font-semibold text-slate-800">
                    No workers yet
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Add your first worker to start tracking.
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 pb-4">
                <div className="grid gap-3">
                  {workers.map((w) => (
                    <div
                      key={w.id}
                      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-px hover:shadow-md"
                    >
                      {/* Accent bar */}
                      <div className="absolute left-0 top-0 h-full w-1 bg-linear-to-b from-indigo-500 to-slate-900/70" />

                      <div className="flex items-start justify-between gap-4 pl-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="truncate text-base font-semibold text-slate-900">
                              {w.name}
                            </div>

                            {w.defaultShiftLabel ? (
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 ring-1 ring-indigo-100">
                                {w.defaultShiftLabel}
                              </span>
                            ) : (
                              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500 ring-1 ring-slate-200">
                                No label
                              </span>
                            )}
                          </div>

                          <div className="mt-1 text-xs text-slate-500">
                            Updated {timeAgo(w.updatedAt)}
                          </div>
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Link
                            href={`/workers/${w.id}`}
                            className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-200"
                          >
                            Open
                          </Link>

                          <button
                            type="button"
                            onClick={() => handleDelete(w.id)}
                            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-200"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
