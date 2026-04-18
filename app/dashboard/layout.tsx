import { AppNav } from "@/components/AppNav";
import { AuthButtons } from "@/components/AuthButtons";
import type { ReactNode } from "react";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-br from-indigo-500/4 via-transparent to-cyan-500/3" />

      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex h-14 items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-linear-to-br from-indigo-500 to-violet-600 shadow-[0_4px_12px_rgba(99,102,241,0.35)]">
                <span className="text-sm leading-none">🏠</span>
              </div>
              <span className="text-sm font-semibold text-white/90">House Help</span>
              <span className="hidden rounded-full bg-indigo-500/15 px-2 py-0.5 text-[11px] font-medium text-indigo-400 ring-1 ring-indigo-400/20 sm:inline">
                Cloud-synced
              </span>
            </div>

            <div className="flex items-center gap-3">
              <AppNav />
              <AuthButtons />
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto max-w-6xl pb-24">{children}</div>
    </div>
  );
}
