"use client";

import { useLocalStorageAutoSync } from "@/hooks/useLocalStorageAutoSync";
import { ToastContainer } from "@/components/Toast";
import { SessionProvider } from "next-auth/react";

export default function Providers({ children }: { children: React.ReactNode }) {
  useLocalStorageAutoSync({ debounceMs: 1000 });
  return (
    <SessionProvider>
      {children}
      <ToastContainer />
    </SessionProvider>
  );
}
