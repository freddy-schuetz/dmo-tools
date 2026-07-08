"use client";

export type PillOption<T extends string | number> = { value: T; label: string };

interface Props<T extends string | number> {
  options: PillOption<T>[];
  value: T | T[];
  onChange: (v: T) => void;
  multi?: boolean;
  ariaLabel?: string;
}

// Generische Pill-Auswahl (Radius, Thema, Kategorie, Reichweite …) für alle Tools.
export default function OptionPills<T extends string | number>({
  options,
  value,
  onChange,
  multi = false,
  ariaLabel,
}: Props<T>) {
  const active = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-full px-3 py-1.5 text-sm font-medium ring-1 transition ${
            active(o.value)
              ? "bg-brand text-white ring-brand"
              : "bg-white text-slate-600 ring-slate-300 hover:bg-slate-50"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
