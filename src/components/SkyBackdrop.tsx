"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Sky } from "@/lib/weatherCodes";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Whether the user asked for reduced motion (SSR-safe, reactive). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia?.(REDUCED_MOTION_QUERY);
      if (!mq) return () => {};
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia?.(REDUCED_MOTION_QUERY).matches ?? false,
    () => false, // Server: assume motion is allowed until the client knows.
  );
}

interface Layer {
  id: number;
  sky: Sky;
}

/** Condition-appropriate ambient motion rendered inside each sky layer. */
function SkyEffects({ sky }: { sky: Sky }) {
  switch (sky) {
    case "clear-night":
      return <div className="fx-stars" />;
    case "cloudy-night":
      return (
        <>
          <div className="fx-stars fx-stars--dim" />
          <div className="fx-clouds" />
        </>
      );
    case "cloudy-day":
      return <div className="fx-clouds" />;
    case "rain":
      return <div className="fx-rain" />;
    case "snow":
      return <div className="fx-snow" />;
    case "storm":
      return (
        <>
          <div className="fx-rain fx-rain--heavy" />
          <div className="fx-flash" />
        </>
      );
    case "fog":
      return <div className="fx-fog" />;
    default:
      // clear-day gets its warm glow from the layer's ::after.
      return null;
  }
}

/**
 * Full-viewport, sky-reactive backdrop (FR-10). Crossfades between sky states by
 * stacking layers and fading the newest one in over the ones beneath, then
 * pruning the occluded layers once the fade finishes. Under
 * `prefers-reduced-motion` it swaps instantly to a single static layer.
 */
export default function SkyBackdrop({ sky }: { sky: Sky | null }) {
  const [layers, setLayers] = useState<Layer[]>([]);
  const nextId = useRef(0);
  const lastSky = useRef<Sky | null>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!sky || sky === lastSky.current) return;
    lastSky.current = sky;
    const layer = { id: nextId.current++, sky };
    // Reduced motion: no crossfade — replace outright with a single layer.
    setLayers((prev) => (reduced ? [layer] : [...prev, layer]));
  }, [sky, reduced]);

  // Once the top layer has faded in, drop everything beneath it.
  function handleSettled(id: number) {
    setLayers((prev) => {
      const idx = prev.findIndex((l) => l.id === id);
      return idx <= 0 ? prev : prev.slice(idx);
    });
  }

  return (
    <div className="sky-layer" aria-hidden="true">
      {layers.map((layer, i) => (
        <div
          key={layer.id}
          className="sky-grad"
          data-sky={layer.sky}
          // The bottom layer is the settled base (no fade); layers above it
          // animate in and then collapse down onto the base.
          data-base={i === 0 ? "" : undefined}
          // Only the layer's own fade-in (not bubbled child-effect animations)
          // should trigger pruning; the ambient effects loop infinitely anyway.
          onAnimationEnd={(e) => {
            if (e.target === e.currentTarget) handleSettled(layer.id);
          }}
        >
          <SkyEffects sky={layer.sky} />
        </div>
      ))}
    </div>
  );
}
