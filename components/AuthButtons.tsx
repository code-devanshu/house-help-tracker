"use client";

import { useEffect, useState } from "react";
import type { Session } from "next-auth";
import { signIn, signOut } from "next-auth/react";
import { AuthUserChip } from "./AuthUserChip";

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

  const { name, email, image } = session.user;
  const initials =
    name
      ?.split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() ?? "U";

  return (
    <AuthUserChip
      image={image}
      email={email}
      name={name}
      initials={initials}
      signOut={signOut}
    />
  );
}
