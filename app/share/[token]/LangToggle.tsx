"use client";

import { useRouter } from "next/navigation";

type Lang = "en" | "hi";

export function LangToggle({ token, monthKey, lang }: { token: string; monthKey: string; lang: Lang }) {
  const router = useRouter();
  const next: Lang = lang === "en" ? "hi" : "en";

  const handleToggle = () => {
    router.push(`/share/${token}?month=${monthKey}&lang=${next}`);
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-xs font-semibold text-white/60 transition hover:bg-white/[0.09] hover:text-white/85"
      title={lang === "en" ? "Switch to Hindi" : "Switch to English"}
    >
      <span className={lang === "en" ? "text-white/85" : "text-white/30"}>EN</span>
      <span className="text-white/20">/</span>
      <span className={lang === "hi" ? "text-white/85" : "text-white/30"}>HI</span>
    </button>
  );
}
