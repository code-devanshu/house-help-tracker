"use client";

import { useState } from "react";

export function ShareButton({ onShare }: { onShare: () => Promise<void> }) {
  const [status, setStatus] = useState<"idle" | "loading" | "copied">("idle");

  const handleClick = async () => {
    if (status === "loading") return;

    try {
      setStatus("loading");
      await onShare();
      setStatus("copied");

      // reset after a moment
      setTimeout(() => setStatus("idle"), 1600);
    } catch {
      setStatus("idle");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`
        relative inline-flex items-center gap-2
        rounded-xl border border-white/10
        bg-white/[0.03] px-3 py-1.5
        text-xs font-semibold text-white/80
        transition
        hover:bg-white/[0.06]
        focus:outline-none focus:ring-4 focus:ring-white/15
        disabled:opacity-60 disabled:cursor-not-allowed
      `}
      disabled={status === "loading"}
    >
      {/* Icon */}
      <span className="text-sm leading-none">
        {status === "copied" ? "✓" : "🔗"}
      </span>

      {/* Label */}
      <span>
        {status === "loading"
          ? "Generating…"
          : status === "copied"
          ? "Link copied"
          : "Share"}
      </span>
    </button>
  );
}
