"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-0.5 rounded-xl border border-white/8 bg-white/3 p-1">
      <NavItem href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
      <NavItem href="/workers" label="Workers" active={pathname.startsWith("/workers")} />
    </nav>
  );
}

function NavItem({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-white/10 text-white shadow-sm"
          : "text-white/45 hover:text-white/70 hover:bg-white/5"
      }`}
    >
      {label}
    </Link>
  );
}
