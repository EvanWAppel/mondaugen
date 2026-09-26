"use client";

export type MapLayerMode = "radar" | "both" | "wind";

const OPTIONS: { value: MapLayerMode; label: string }[] = [
  { value: "radar", label: "Radar" },
  { value: "both", label: "Both" },
  { value: "wind", label: "Wind" },
];

interface MapLayerToggleProps {
  mode: MapLayerMode;
  onChange: (mode: MapLayerMode) => void;
}

/** Radar / Both / Wind. Session-only — not written to localStorage. */
export default function MapLayerToggle({ mode, onChange }: MapLayerToggleProps) {
  return (
    <div role="radiogroup" aria-label="Map layer" className="map-layer-toggle">
      {OPTIONS.map(({ value, label }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(value)}
            className={active ? "unit-active" : "unit-inactive"}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
