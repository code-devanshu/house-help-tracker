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
          ? "border-rose-500/40 bg-rose-500/10 text-rose-200 focus:ring-rose-500/20"
          : "border-white/10 bg-white/[0.03] text-white/80 hover:bg-white/[0.06] focus:ring-white/15"
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
