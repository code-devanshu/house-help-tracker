import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "House Help Tracker",
  description: "Attendance + salary tracker",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Anti-flash: apply stored theme before first paint */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('theme')||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark')})()` }} />
      </head>
      <body className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-indigo-50 via-white to-slate-50 dark:from-indigo-950/40 dark:via-slate-950 dark:to-black" />

          <div
            className="absolute inset-0 opacity-[0.03] dark:opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(99,102,241,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.4) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          <div className="absolute -top-40 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-indigo-500/5 blur-3xl dark:bg-indigo-600/10" />
        </div>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
