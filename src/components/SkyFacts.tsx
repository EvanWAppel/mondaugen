"use client";

import { useEffect, useState } from "react";
import type { SkyInput } from "@/lib/sky";

type SkyFactsProps = SkyInput;

/**
 * Three lines under the sun arc. The astronomy library loads with this
 * component, not with the forecast, so the first paint stays light.
 */
export default function SkyFacts(props: SkyFactsProps) {
  const [lines, setLines] = useState<[string, string, string] | null>(null);
  const [failed, setFailed] = useState(false);
  const {
    latitude,
    longitude,
    utcOffsetSeconds,
    nowMs,
    sunriseIso,
    sunsetIso,
    nextSunriseIso,
    hourlyTime,
    hourlyCloud,
  } = props;

  useEffect(() => {
    let cancelled = false;
    import("@/lib/sky")
      .then(({ skyLines }) => {
        if (cancelled) return;
        setLines(
          skyLines({
            latitude,
            longitude,
            utcOffsetSeconds,
            nowMs,
            sunriseIso,
            sunsetIso,
            nextSunriseIso,
            hourlyTime,
            hourlyCloud,
          }),
        );
        setFailed(false);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    latitude,
    longitude,
    utcOffsetSeconds,
    nowMs,
    sunriseIso,
    sunsetIso,
    nextSunriseIso,
    hourlyTime,
    hourlyCloud,
  ]);

  if (failed) {
    return <p className="sky-facts-error">Sky facts unavailable.</p>;
  }
  if (!lines) return null;
  return (
    <ul className="sky-facts" aria-label="Tonight's sky">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  );
}
