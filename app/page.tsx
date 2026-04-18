import GoogleSSOButton from "@/components/GoogleSSOButton";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden text-white">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-indigo-600/10 blur-[100px]" />
        <div className="absolute top-1/2 -right-40 h-[400px] w-[400px] rounded-full bg-violet-600/8 blur-[80px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[400px] rounded-full bg-cyan-600/6 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 py-20 lg:flex-row lg:items-center lg:gap-16">

        {/* ── Left: Value prop ── */}
        <section className="flex-1 max-w-2xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3.5 py-1.5 text-xs font-medium text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_2px_rgba(99,102,241,0.6)]" />
            Private · Offline-first · Auto-synced
          </div>

          {/* Headline */}
          <h1 className="mt-6 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-[64px] lg:leading-[1.08]">
            Pay your house help{" "}
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-cyan-400 bg-clip-text text-transparent">
              correctly, every time.
            </span>
          </h1>

          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/55">
            Track attendance, calculate salaries automatically, lock months after payout — no spreadsheets, no mental math.
          </p>

          {/* Features */}
          <div className="mt-10 flex flex-wrap gap-2.5">
            {[
              { icon: "📅", label: "Tap-to-mark attendance" },
              { icon: "₹", label: "Auto salary calculation" },
              { icon: "🔒", label: "Month locking" },
              { icon: "📄", label: "PDF payslips" },
              { icon: "☁️", label: "Cloud sync" },
              { icon: "🔗", label: "Shareable links" },
            ].map(({ icon, label }) => (
              <div
                key={label}
                className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.04] px-3.5 py-2 text-sm text-white/70"
              >
                <span className="text-base leading-none">{icon}</span>
                {label}
              </div>
            ))}
          </div>

          {/* Social proof */}
          <p className="mt-8 text-sm text-white/30">
            Works for maids, cooks, drivers, gardeners, and more.
          </p>
        </section>

        {/* ── Right: Sign-in card ── */}
        <section className="mt-12 w-full max-w-sm lg:mt-0 lg:shrink-0">
          <div className="relative rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_32px_80px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            {/* Subtle inner glow */}
            <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-b from-white/[0.05] to-transparent" />

            <div className="relative">
              {/* App icon */}
              <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_8px_24px_rgba(99,102,241,0.4)]">
                <span className="text-xl">🏠</span>
              </div>

              <h2 className="text-xl font-semibold text-white">Get started</h2>
              <p className="mt-1.5 text-sm text-white/50">
                Sign in with Google. Your data stays private.
              </p>

              <GoogleSSOButton />

              {/* Trust indicators */}
              <div className="mt-5 space-y-2.5">
                {[
                  "No credit card required",
                  "Your data encrypted & private",
                  "Works offline, syncs automatically",
                ].map((item) => (
                  <div key={item} className="flex items-center gap-2.5 text-xs text-white/40">
                    <svg className="h-3.5 w-3.5 shrink-0 text-emerald-400" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
