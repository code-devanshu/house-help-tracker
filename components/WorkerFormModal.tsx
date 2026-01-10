"use client";

import { useMemo, useState } from "react";
import type { Worker } from "@/lib/storage/schema";
import { makeId } from "@/lib/utils/id";

export function WorkerFormModal({
  onClose,
  onSave,
  initialWorker,
}: {
  onClose: () => void;
  onSave: (worker: Worker) => void;
  initialWorker?: Worker;
}) {
  const mode = initialWorker ? "edit" : "create";

  const [name, setName] = useState<string>(initialWorker?.name ?? "");
  const [defaultShiftLabel, setDefaultShiftLabel] = useState<string>(
    initialWorker?.defaultShiftLabel ?? ""
  );

  const title = useMemo(
    () => (mode === "create" ? "Add Worker" : "Edit Worker"),
    [mode]
  );

  const canSave = name.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;

    const now = Date.now();

    const worker: Worker = {
      id: initialWorker?.id ?? makeId("worker"),
      name: name.trim(),
      defaultShiftLabel: defaultShiftLabel.trim() || undefined,
      createdAt: initialWorker?.createdAt ?? now,
      updatedAt: now,
    };

    onSave(worker);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="text-sm text-slate-600">
              Keep it simple — you can edit later.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-2 py-1 text-sm hover:bg-slate-50"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Worker name</span>
            <input
              className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="e.g., Sita / Raju / Cook"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-medium">
              Default shift label (optional)
            </span>
            <input
              className="rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="e.g., Morning / Full Day"
              value={defaultShiftLabel}
              onChange={(e) => setDefaultShiftLabel(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={[
              "rounded-md px-4 py-2 text-sm font-semibold text-white",
              canSave
                ? "bg-slate-900 hover:bg-slate-800"
                : "bg-slate-400 cursor-not-allowed",
            ].join(" ")}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
