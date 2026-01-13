"use client";

type ToggleProps = {
  value: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
};

export function Toggle({ value, onChange, disabled = false }: ToggleProps) {
  return (
    <label
      className={[
        "inline-flex items-center",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />

      {/* Track */}
      <span
        className={[
          "relative",
          "w-[54px] h-[28px]",
          "rounded-full",
          "border border-slate-900/50",
          "bg-slate-200",
          "transition-colors duration-300 ease-in-out",
          "peer-checked:bg-blue-600",
          "peer-focus-visible:ring-4 peer-focus-visible:ring-blue-500/30",

          // 🔑 move thumb when checked
          "peer-checked:[&_.toggle-thumb]:translate-x-[26px]",
        ].join(" ")}
      >
        {/* Thumb */}
        <span
          className={[
            "toggle-thumb",
            "absolute top-[1px] left-[1px]",
            "h-[26px] w-[26px]",
            "rounded-full bg-white",
            "shadow-[0_6px_14px_rgba(2,6,23,0.25)]",
            "grid place-items-center",
            "transition-transform duration-300 ease-in-out",
            "will-change-transform",
            disabled ? "" : "active:scale-[0.97]",
          ].join(" ")}
        >
          {/* Settings icon */}
          <span
            className={[
              "text-[13px]",
              "text-slate-700",
              "transition-transform duration-300 ease-in-out",
              // subtle rotation when enabled
              "peer-checked:rotate-90",
              "peer-checked:text-blue-600",
            ].join(" ")}
          ></span>
        </span>
      </span>
    </label>
  );
}
