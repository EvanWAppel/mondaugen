import { moonPhase } from "./moon";

/** A major annual shower. Peak day is the usual date; it can drift by about a day. */
export interface Shower {
  name: string;
  peakMonth: number;
  peakDay: number;
  zhr: number;
}

/**
 * The showers worth planning around. Minor streams and outbursts are omitted
 * on purpose (FR-16).
 */
export const SHOWERS: readonly Shower[] = [
  { name: "Quadrantids", peakMonth: 1, peakDay: 4, zhr: 110 },
  { name: "Lyrids", peakMonth: 4, peakDay: 22, zhr: 18 },
  { name: "Eta Aquariids", peakMonth: 5, peakDay: 6, zhr: 50 },
  { name: "Delta Aquariids", peakMonth: 7, peakDay: 30, zhr: 25 },
  { name: "Perseids", peakMonth: 8, peakDay: 12, zhr: 100 },
  { name: "Orionids", peakMonth: 10, peakDay: 21, zhr: 20 },
  { name: "Leonids", peakMonth: 11, peakDay: 17, zhr: 15 },
  { name: "Geminids", peakMonth: 12, peakDay: 14, zhr: 150 },
  { name: "Ursids", peakMonth: 12, peakDay: 22, zhr: 10 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A moon this bright washes out all but the brightest meteors. */
const BRIGHT_MOON = 0.65;

export interface ShowerPeak {
  name: string;
  year: number;
  month: number;
  day: number;
  daysUntil: number;
  zhr: number;
}

function utcDay(year: number, month: number, day: number): number {
  return Date.UTC(year, month - 1, day);
}

/** The next major-shower peak on or after a calendar date. */
export function nextShower(year: number, month: number, day: number): ShowerPeak {
  const today = utcDay(year, month, day);
  let best: ShowerPeak | null = null;
  for (const shower of SHOWERS) {
    let peakYear = year;
    let at = utcDay(year, shower.peakMonth, shower.peakDay);
    if (at < today) {
      peakYear += 1;
      at = utcDay(peakYear, shower.peakMonth, shower.peakDay);
    }
    const daysUntil = Math.round((at - today) / 86_400_000);
    if (!best || daysUntil < best.daysUntil) {
      best = {
        name: shower.name,
        year: peakYear,
        month: shower.peakMonth,
        day: shower.peakDay,
        daysUntil,
        zhr: shower.zhr,
      };
    }
  }
  if (!best) throw new Error("No meteor showers are defined.");
  return best;
}

export function showerDateLabel(peak: ShowerPeak): string {
  if (peak.daysUntil === 0) return "tonight";
  if (peak.daysUntil === 1) return "tomorrow";
  return `${MONTHS[peak.month - 1]} ${peak.day}`;
}

/**
 * One line for the next peak. `clouds` is the day's average cloud cover
 * (0–100) when the peak is inside the forecast, otherwise null.
 */
export function meteorLine(
  year: number,
  month: number,
  day: number,
  utcOffsetSeconds: number,
  clouds: number | null,
): string {
  const peak = nextShower(year, month, day);
  const noon = utcDay(peak.year, peak.month, peak.day) + 12 * 3_600_000 - utcOffsetSeconds * 1000;
  const bright = moonPhase(noon).illumination >= BRIGHT_MOON;
  const parts = [`${peak.name} peak ${showerDateLabel(peak)}`];
  if (bright) parts.push("bright moon");
  if (clouds != null && clouds >= 70) parts.push("mostly cloudy");
  else if (clouds != null && clouds <= 40) parts.push("mostly clear");
  return parts.join(" · ");
}

/**
 * Average cloud cover on a calendar date, or null when that date is not in
 * the hourly series. Times are location-local ISO strings.
 */
export function cloudsOnDate(
  times: readonly string[],
  clouds: readonly number[],
  year: number,
  month: number,
  day: number,
): number | null {
  const key = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const values: number[] = [];
  for (let i = 0; i < times.length; i += 1) {
    if (times[i]?.startsWith(key) && typeof clouds[i] === "number") values.push(clouds[i]);
  }
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
