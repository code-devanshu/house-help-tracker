"use client";

type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ value, onChange, disabled = false }: ToggleProps) {
  return (
    <label className={`inline-flex items-center ${disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer"}`}>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      {/* Track */}
      <span className={[
        "relative inline-block h-6 w-10 rounded-full border transition-colors duration-200",
        "border-white/10 bg-white/[0.08]",
        "peer-checked:border-indigo-400/30 peer-checked:bg-indigo-500",
        "peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-500/25",
        "peer-checked:[&_.thumb]:translate-x-4",
      ].join(" ")}>
        {/* Thumb */}
        <span className={[
          "thumb absolute top-0.5 left-0.5 h-5 w-5 rounded-full",
          "bg-white/60 shadow-sm",
          "peer-checked:bg-white",
          "transition-transform duration-200 ease-in-out will-change-transform",
          "peer-checked:shadow-[0_2px_8px_rgba(99,102,241,0.4)]",
        ].join(" ")} />
      </span>
    </label>
  );
}
