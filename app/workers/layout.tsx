import { AuthButtons } from "@/components/AuthButtons";
import type { ReactNode } from "react";

export default function WorkersLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100">
      {/* Subtle background gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-cyan-500/5" />

      {/* HEADER */}
      <header className="border-b border-white/10 bg-white/[0.03] backdrop-blur">
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
              </div>
              <p className="mt-1 max-w-[62ch] text-sm text-white/55">
                Manage your team. Changes are saved locally and synced to your
                account automatically.
              </p>
            </div>

            <div className="px-3 py-2 my-auto">
              <AuthButtons />
            </div>
          </div>
        </div>
      </header>

      {/* Page container */}
      <div className="relative mx-auto max-w-6xl pb-20">{children}</div>
    </div>
  );
}
