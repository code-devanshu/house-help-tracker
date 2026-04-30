"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type Props = {
  image?: string | null;
  name?: string | null;
  email?: string | null;
  initials: string;
  signOut: () => void;
};

export function AuthUserChip({ image, name, email, initials, signOut }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      // Logic: Only close if the click is truly outside the entire component wrapper
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };

    // Changed to mouseup/touchend - fires AFTER onPointerDown
    document.addEventListener("mouseup", handleClickOutside);
    document.addEventListener("touchend", handleClickOutside);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("mouseup", handleClickOutside);
      document.removeEventListener("touchend", handleClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // FIX: We use onPointerDown to beat the document listener
  const handleSignOut = (e: React.PointerEvent | React.MouseEvent) => {
    e.stopPropagation(); // Stop the document listener from seeing this click
    console.log("SIGN OUT TRIGGERED");
    signOut();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative inline-block">
      {/* Avatar Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full transition hover:opacity-80 focus:outline-none ring-2 ring-transparent focus:ring-indigo-500/50"
      >
        {image ? (
          <Image
            src={image}
            alt={name ?? "User"}
            fill
            sizes="36px"
            className="object-cover"
            priority
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-indigo-600 text-xs font-semibold text-white">
            {initials}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute right-0 top-12 z-1000 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_25px_70px_rgba(0,0,0,0.12)] backdrop-blur-xl dark:border-white/10 dark:bg-[#0B1020]/95 dark:shadow-[0_25px_70px_rgba(0,0,0,0.65)]">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-white/10">
            <div className="truncate text-sm font-semibold text-slate-900 dark:text-white/90">
              {name ?? "Signed in"}
            </div>
            <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-white/45">
              {email}
            </div>
          </div>

          <button
            type="button"
            onPointerDown={handleSignOut}
            className="w-full cursor-pointer px-4 py-3 text-left text-sm font-semibold text-rose-500 transition hover:bg-slate-50 focus:outline-none dark:text-rose-300 dark:hover:bg-white/5"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
