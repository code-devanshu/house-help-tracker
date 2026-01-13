"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";

export function AuthButtons() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = (await res.json()) as Session | null;
        if (mounted) setSession(data);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 animate-pulse rounded-full bg-white/10" />
        <div className="h-4 w-28 animate-pulse rounded bg-white/10" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <button
        onClick={() => signIn("google")}
        className="inline-flex h-9 items-center rounded-lg bg-white px-3 text-sm font-semibold text-slate-900 hover:brightness-95"
      >
        Continue with Google
      </button>
    );
  }

  const { name, image } = session.user;
  const initials =
    name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <div className="flex items-center gap-3">
      {/* Avatar */}
      {image ? (
        <div className="relative h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/20">
          <Image
            src={image}
            alt={name ?? "User"}
            fill
            sizes="36px"
            className="object-cover"
            priority
          />
        </div>
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">
          {initials}
        </div>
      )}

      {/* Email + logout */}
      <div className="hidden sm:block">
        <div className="max-w-45 truncate text-xs font-medium text-white/70">
          {name}
        </div>
        <button
          onClick={() => signOut()}
          className="text-[11px] cursor-pointer font-medium text-white/40 hover:text-white/70"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
