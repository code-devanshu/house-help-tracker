"use client";

import { useState } from "react";

export function ShareButton({ onShare }: { onShare: () => Promise<void> }) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");

  const handleClick = async () => {
    if (status === "loading") return;

    try {
      setStatus("loading");
      await onShare();
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        relative inline-flex items-center gap-2
        rounded-xl border px-3 py-1.5
        text-xs font-semibold
        transition
        focus:outline-none focus:ring-4
        disabled:opacity-60 disabled:cursor-not-allowed
        ${status === "error"
          ? "border-rose-300 bg-rose-50 text-rose-600 focus:ring-rose-500/20 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
          : "border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 focus:ring-slate-200 dark:border-white/10 dark:bg-white/3 dark:text-white/80 dark:hover:bg-white/6 dark:focus:ring-white/15"
        }
      `}
      disabled={status === "loading"}
    >
      <span className="text-sm leading-none">
        {status === "copied" ? "✓" : status === "error" ? "✕" : "🔗"}
      </span>
      <span>
        {status === "loading"
          ? "Generating…"
          : status === "copied"
          ? "Link copied"
          : status === "error"
          ? "Failed — retry"
          : "Share"}
      </span>
    </button>
  );
}
