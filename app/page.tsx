import GoogleSSOButton from "@/components/GoogleSSOButton";

export default function HomePage() {
  return (
    <main className=" text-white">
      <div className="relative mx-auto flex min-h-screen max-w-6xl items-center px-6 py-16">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          {/* Left: Brand / value */}
          <section className="max-w-xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
              <span className="h-2 w-2 rounded-full bg-emerald-400/90" />
              Private • Google Sign-in • Local-first
            </div>

            <h1 className="mt-5 text-4xl font-extrabold tracking-tight sm:text-5xl">
              House Help Tracker
            </h1>

            <p className="mt-4 text-base leading-relaxed text-white/70 sm:text-lg">
              Track attendance, auto-calculate monthly salary, and lock months
              so totals never change by mistake.
            </p>

            <div className="mt-8 grid gap-3 text-sm text-white/70 sm:grid-cols-2">
              <Feature
                title="Attendance calendar"
                desc="Tap-to-mark days, notes & hours."
              />
              <Feature
                title="Salary calc"
                desc="Monthly salary + paid OFF allowance."
              />
              <Feature title="Month lock" desc="Prevent edits after payout." />
              <Feature
                title="Export-ready"
                desc="PDF export stays on client."
              />
            </div>
          </section>

          {/* Right: Login card */}
          <section className="lg:justify-self-end">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/6 p-6 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    Sign in to continue
                  </div>
                  <div className="mt-1 text-sm text-white/60">
                    Secure access to your workers and months.
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/70">
                  v1
                </div>
              </div>

              <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-white/60">What’s protected?</div>
                <div className="mt-2 grid gap-2 text-sm text-white/80">
                  <LineItem>Workers list</LineItem>
                  <LineItem>Attendance entries</LineItem>
                  <LineItem>Salary & month locks</LineItem>
                </div>
              </div>

              <GoogleSSOButton />

              <div className="mt-4 text-xs leading-relaxed text-white/45">
                By continuing, you agree to use this app for personal tracking.
                Your UI stays the same when we later add sync/DB.
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function Feature({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold text-white/90">{title}</div>
      <div className="mt-1 text-sm text-white/60">{desc}</div>
    </div>
  );
}

function LineItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-1.5 w-1.5 rounded-full bg-indigo-300/80" />
      <span>{children}</span>
    </div>
  );
}
