"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

export function AppNav() {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-2">
      <nav className="flex items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-white/8 dark:bg-white/3">
        <NavItem href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
        <NavItem href="/workers" label="Workers" active={pathname.startsWith("/workers")} />
      </nav>
      <ThemeToggle />
    </div>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-white text-slate-900 shadow-sm dark:bg-white/10 dark:text-white"
          : "text-slate-500 hover:text-slate-700 hover:bg-white/60 dark:text-white/45 dark:hover:text-white/70 dark:hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}
