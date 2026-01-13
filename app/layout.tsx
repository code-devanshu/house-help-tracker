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
    <html lang="en">
      <body className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100 antialiased">
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-linear-to-br from-indigo-950/40 via-slate-950 to-black" />

          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.15) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.15) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />

          {/* Soft glow */}
          <div className="absolute -top-40 left-1/2 h-150 w-150 -translate-x-1/2 rounded-full bg-indigo-600/10 blur-3xl" />
        </div>

        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
