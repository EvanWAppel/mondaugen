import { describe, expect, it } from "vitest";
import {
  formatClock,
  formatSpan,
  isoTimeToMinutes,
  localNowMinutes,
  sunProgress,
  sunStatus,
} from "./sun";

describe("isoTimeToMinutes", () => {
  it("parses local timestamps", () => {
    expect(isoTimeToMinutes("2026-09-26T06:52")).toBe(6 * 60 + 52);
    expect(isoTimeToMinutes("2026-09-26T19:14")).toBe(19 * 60 + 14);
  });
  it("returns null for missing/malformed input", () => {
    expect(isoTimeToMinutes(null)).toBeNull();
    expect(isoTimeToMinutes("2026-09-26")).toBeNull();
  });
});

describe("localNowMinutes", () => {
  it("applies the location's UTC offset", () => {
    // 12:00 UTC, offset -5h → 07:00 local.
    const noonUtc = Date.UTC(2026, 8, 26, 12, 0, 0);
    expect(localNowMinutes(-5 * 3600, noonUtc)).toBe(7 * 60);
  });
});

describe("sunProgress", () => {
  const sunrise = 6 * 60; // 06:00
  const sunset = 18 * 60; // 18:00

  it("is 0.5 at solar midpoint", () => {
    const p = sunProgress(sunrise, sunset, 12 * 60);
    expect(p?.progress).toBeCloseTo(0.5, 5);
    expect(p?.isDaytime).toBe(true);
  });
  it("clamps and flags night before sunrise / after sunset", () => {
    expect(sunProgress(sunrise, sunset, 3 * 60)).toEqual({
      progress: 0,
      isDaytime: false,
    });
    expect(sunProgress(sunrise, sunset, 22 * 60)).toEqual({
      progress: 1,
      isDaytime: false,
    });
  });
  it("returns null when times are unknown or inverted", () => {
    expect(sunProgress(null, sunset, 720)).toBeNull();
    expect(sunProgress(sunset, sunrise, 720)).toBeNull();
  });
});

describe("sunStatus", () => {
  const sunrise = 6 * 60;
  const sunset = 18 * 60;

  it("counts down to sunset during the day", () => {
    expect(sunStatus(sunrise, sunset, 14 * 60 + 48)).toEqual({
      nighttime: false,
      text: "Sunset in 3h 12m",
    });
  });

  it("counts down to sunrise before dawn and after dusk", () => {
    expect(sunStatus(sunrise, sunset, 4 * 60 + 15)).toEqual({
      nighttime: true,
      text: "Sunrise in 1h 45m",
    });
    expect(sunStatus(sunrise, sunset, 22 * 60)).toEqual({
      nighttime: true,
      text: "Sunrise in 8h",
    });
  });
});

describe("formatSpan", () => {
  it("drops a zero hours or minutes part", () => {
    expect(formatSpan(45)).toBe("45m");
    expect(formatSpan(120)).toBe("2h");
    expect(formatSpan(192)).toBe("3h 12m");
  });
});

describe("formatClock", () => {
  it("formats 12-hour clock", () => {
    expect(formatClock(6 * 60 + 52)).toBe("6:52 AM");
    expect(formatClock(19 * 60 + 14)).toBe("7:14 PM");
    expect(formatClock(0)).toBe("12:00 AM");
    expect(formatClock(null)).toBe("—");
  });
});
