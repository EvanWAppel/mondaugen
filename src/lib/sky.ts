import {
  Body,
  EclipseKind,
  Equator,
  Horizon,
  Illumination,
  NextLocalSolarEclipse,
  NextLunarEclipse,
  Observer,
  SearchLocalSolarEclipse,
  SearchLunarEclipse,
  type Body as BodyName,
} from "astronomy-engine";
import { cloudsOnDate, meteorLine, nextShower } from "./showers";

const NAKED_EYE: BodyName[] = [
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
];

const DIRECTIONS = [
  "north",
  "northeast",
  "east",
  "southeast",
  "south",
  "southwest",
  "west",
  "northwest",
] as const;

/** Sun this far below the horizon before a planet counts as being in the dark. */
const DARK_SUN_ALT = -6;
/** Skip planets still in the haze. */
const MIN_PLANET_ALT = 10;

export interface PlanetSighting {
  name: string;
  /** Visual magnitude. Brighter is more negative. */
  magnitude: number;
  direction: (typeof DIRECTIONS)[number];
}

export function localIsoToMs(iso: string, utcOffsetSeconds: number): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(iso);
  if (!match) throw new Error(`Bad local time: ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return Date.UTC(year, month - 1, day, hour, minute) - utcOffsetSeconds * 1000;
}

/** The dark hours to judge "tonight" against. */
export function nightWindow(args: {
  nowMs: number;
  sunriseIso: string;
  sunsetIso: string;
  nextSunriseIso: string;
  utcOffsetSeconds: number;
}): { startMs: number; endMs: number } {
  const sunrise = localIsoToMs(args.sunriseIso, args.utcOffsetSeconds);
  const sunset = localIsoToMs(args.sunsetIso, args.utcOffsetSeconds);
  const nextSunrise = localIsoToMs(args.nextSunriseIso, args.utcOffsetSeconds);
  if (args.nowMs < sunrise) return { startMs: sunset - 86_400_000, endMs: sunrise };
  if (args.nowMs >= sunset) return { startMs: args.nowMs, endMs: nextSunrise };
  return { startMs: sunset, endMs: nextSunrise };
}

function compass(azimuth: number): (typeof DIRECTIONS)[number] {
  const turns = ((azimuth % 360) + 360) % 360;
  return DIRECTIONS[Math.round(turns / 45) % 8];
}

function altitudeAzimuth(body: BodyName, observer: Observer, ms: number): {
  altitude: number;
  azimuth: number;
} {
  const date = new Date(ms);
  const eq = Equator(body, date, observer, true, true);
  const hor = Horizon(date, observer, eq.ra, eq.dec, "normal");
  return { altitude: hor.altitude, azimuth: hor.azimuth };
}

/** Naked-eye planets in the dark during the window, brightest first. */
export function visiblePlanets(
  latitude: number,
  longitude: number,
  startMs: number,
  endMs: number,
): PlanetSighting[] {
  if (endMs <= startMs) return [];
  const observer = new Observer(latitude, longitude, 0);
  const span = endMs - startMs;
  const samples = [0.2, 0.5, 0.8].map((fraction) => startMs + span * fraction);
  const found: PlanetSighting[] = [];
  for (const body of NAKED_EYE) {
    let best: { altitude: number; azimuth: number; ms: number } | null = null;
    for (const ms of samples) {
      const sun = altitudeAzimuth(Body.Sun, observer, ms);
      if (sun.altitude >= DARK_SUN_ALT) continue;
      const planet = altitudeAzimuth(body, observer, ms);
      if (planet.altitude < MIN_PLANET_ALT) continue;
      if (!best || planet.altitude > best.altitude) {
        best = { altitude: planet.altitude, azimuth: planet.azimuth, ms };
      }
    }
    if (!best) continue;
    found.push({
      name: body,
      magnitude: Illumination(body, new Date(best.ms)).mag,
      direction: compass(best.azimuth),
    });
  }
  found.sort((a, b) => a.magnitude - b.magnitude);
  return found.slice(0, 4);
}

export function planetLine(planets: readonly PlanetSighting[]): string {
  if (planets.length === 0) return "No bright planets up tonight";
  return planets.map((planet) => `${planet.name} in the ${planet.direction}`).join(" · ");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatLocalDate(ms: number, utcOffsetSeconds: number): string {
  const local = new Date(ms + utcOffsetSeconds * 1000);
  return `${MONTHS[local.getUTCMonth()]} ${local.getUTCDate()}, ${local.getUTCFullYear()}`;
}

export interface EclipseFact {
  kind: string;
  when: string;
  peakMs: number;
}

function moonUp(observer: Observer, ms: number): boolean {
  return altitudeAzimuth(Body.Moon, observer, ms).altitude > 0;
}

/** The sooner of the next useful lunar eclipse and the next solar eclipse here. */
export function nextEclipse(
  latitude: number,
  longitude: number,
  startMs: number,
  utcOffsetSeconds: number,
): EclipseFact | null {
  const observer = new Observer(latitude, longitude, 0);
  let lunarPeak: { kind: string; ms: number } | null = null;
  let lunar = SearchLunarEclipse(new Date(startMs));
  for (let i = 0; i < 8; i += 1) {
    if (lunar.kind !== EclipseKind.Penumbral && moonUp(observer, lunar.peak.date.getTime())) {
      lunarPeak = { kind: `${lunar.kind} lunar`, ms: lunar.peak.date.getTime() };
      break;
    }
    lunar = NextLunarEclipse(lunar.peak);
  }

  let solar = SearchLocalSolarEclipse(new Date(startMs), observer);
  let solarPeak: { kind: string; ms: number } | null = null;
  for (let i = 0; i < 8; i += 1) {
    if (solar.peak.altitude > 0) {
      solarPeak = { kind: `${solar.kind} solar`, ms: solar.peak.time.date.getTime() };
      break;
    }
    solar = NextLocalSolarEclipse(solar.peak.time, observer);
  }

  const chosen =
    lunarPeak && (!solarPeak || lunarPeak.ms <= solarPeak.ms) ? lunarPeak : solarPeak;
  if (!chosen) return null;
  return {
    kind: chosen.kind,
    when: formatLocalDate(chosen.ms, utcOffsetSeconds),
    peakMs: chosen.ms,
  };
}

export function eclipseLine(fact: EclipseFact | null): string {
  if (!fact) return "No eclipse scheduled";
  return `Next eclipse · ${fact.kind} · ${fact.when}`;
}

export interface SkyInput {
  latitude: number;
  longitude: number;
  utcOffsetSeconds: number;
  nowMs: number;
  sunriseIso: string;
  sunsetIso: string;
  nextSunriseIso: string;
  hourlyTime: readonly string[];
  hourlyCloud: readonly number[];
}

function localDate(ms: number, utcOffsetSeconds: number): { year: number; month: number; day: number } {
  const local = new Date(ms + utcOffsetSeconds * 1000);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
  };
}

/** The three tonight's-sky lines, in display order. */
export function skyLines(input: SkyInput): [string, string, string] {
  const today = localDate(input.nowMs, input.utcOffsetSeconds);
  const peak = nextShower(today.year, today.month, today.day);
  const clouds = cloudsOnDate(input.hourlyTime, input.hourlyCloud, peak.year, peak.month, peak.day);
  const meteors = meteorLine(today.year, today.month, today.day, input.utcOffsetSeconds, clouds);
  const window = nightWindow(input);
  const planets = planetLine(
    visiblePlanets(input.latitude, input.longitude, window.startMs, window.endMs),
  );
  const eclipse = eclipseLine(
    nextEclipse(input.latitude, input.longitude, input.nowMs, input.utcOffsetSeconds),
  );
  return [meteors, planets, eclipse];
}
