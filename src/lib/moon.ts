/** Mean synodic month. Phase is cyclic, so the exact length only sets the drift. */
const SYNODIC_MS = 29.530588853 * 24 * 60 * 60 * 1000;
/** New moon at 2000-01-06 18:14 UTC. */
const NEW_MOON_EPOCH = Date.UTC(2000, 0, 6, 18, 14, 0);

export interface MoonPhase {
  /** 0 new → 0.5 full → 1 new again. */
  phase: number;
  /** 0–1 fraction of the disc that is lit. */
  illumination: number;
  name: string;
}

function phaseName(phase: number): string {
  const p = ((phase % 1) + 1) % 1;
  if (p < 0.03 || p >= 0.97) return "New moon";
  if (p < 0.22) return "Waxing crescent";
  if (p < 0.28) return "First quarter";
  if (p < 0.47) return "Waxing gibbous";
  if (p < 0.53) return "Full moon";
  if (p < 0.72) return "Waning gibbous";
  if (p < 0.78) return "Last quarter";
  return "Waning crescent";
}

/** Moon phase at an instant. Astronomical, no network call. */
export function moonPhase(epochMs: number): MoonPhase {
  const elapsed = epochMs - NEW_MOON_EPOCH;
  const age = ((elapsed % SYNODIC_MS) + SYNODIC_MS) % SYNODIC_MS;
  const phase = age / SYNODIC_MS;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  return { phase, illumination, name: phaseName(phase) };
}

/**
 * SVG path of the lit portion of a disc centered at (12, 12) with radius 9.
 * Northern hemisphere lights the right side while waxing; `southern` flips it.
 */
export function moonLitPath(phase: number, southern = false): string {
  const cx = 12;
  const cy = 12;
  const r = 9;
  const p = ((phase % 1) + 1) % 1;
  const waxing = p <= 0.5;
  const crescent = p < 0.25 || p > 0.75;
  const limbRight = southern ? !waxing : waxing;
  const limbSweep = limbRight ? 1 : 0;
  const termSweep = crescent ? limbSweep : 1 - limbSweep;
  const rx = Math.max(Math.abs(Math.cos(p * 2 * Math.PI)) * r, 0.2);
  const top = cy - r;
  const bottom = cy + r;
  return `M ${cx} ${top} A ${r} ${r} 0 0 ${limbSweep} ${cx} ${bottom} A ${rx} ${r} 0 0 ${termSweep} ${cx} ${top} Z`;
}
