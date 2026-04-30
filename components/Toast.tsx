"use client";

import { useEffect, useState } from "react";

type ToastType = "error" | "success" | "info";

type ToastItem = {
  id: number;
  message: string;
  type: ToastType;
};

let _nextId = 0;
const _listeners = new Set<(items: ToastItem[]) => void>();
let _items: ToastItem[] = [];

function _notify(next: ToastItem[]) {
  _items = next;
  _listeners.forEach((fn) => fn(next));
}

export function showToast(message: string, type: ToastType = "info", durationMs = 4000) {
  const id = ++_nextId;
  _notify([..._items, { id, message, type }]);
  setTimeout(() => _notify(_items.filter((t) => t.id !== id)), durationMs);
}

const icons: Record<ToastType, string> = {
  error: "✕",
  success: "✓",
  info: "ℹ",
};

const styles: Record<ToastType, string> = {
  error: "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-100",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-100",
  info: "border-slate-200 bg-white text-slate-800 dark:border-white/15 dark:bg-white/7 dark:text-white/90",
};

const iconStyles: Record<ToastType, string> = {
  error: "bg-rose-100 text-rose-500 dark:bg-rose-500/20 dark:text-rose-300",
  success: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300",
  info: "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-white/60",
};

export function ToastContainer() {
  const [list, setList] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (items: ToastItem[]) => setList([...items]);
    _listeners.add(handler);
    return () => { _listeners.delete(handler); };
  }, []);

  if (list.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-9999 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {list.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_16px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-200 ${styles[t.type]}`}
        >
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${iconStyles[t.type]}`}>
            {icons[t.type]}
          </span>
          <span className="leading-snug">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
