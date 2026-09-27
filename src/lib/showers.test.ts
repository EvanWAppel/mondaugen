import { describe, expect, it } from "vitest";
import { cloudsOnDate, meteorLine, nextShower } from "./showers";

describe("nextShower", () => {
  it("picks the Perseids once the Delta Aquariids have peaked", () => {
    const peak = nextShower(2026, 8, 1);
    expect(peak.name).toBe("Perseids");
    expect(peak).toMatchObject({ month: 8, day: 12, daysUntil: 11 });
  });

  it("says the peak is tonight on the peak date", () => {
    expect(nextShower(2026, 8, 12).daysUntil).toBe(0);
    expect(nextShower(2026, 8, 12).name).toBe("Perseids");
  });

  it("wraps to next year's Quadrantids after the Ursids", () => {
    const peak = nextShower(2026, 12, 28);
    expect(peak.name).toBe("Quadrantids");
    expect(peak.year).toBe(2027);
    expect(peak.month).toBe(1);
    expect(peak.day).toBe(4);
  });
});

describe("meteorLine", () => {
  it("names the peak without a cloud or moon claim when neither applies", () => {
    const line = meteorLine(2026, 8, 1, 0, null);
    expect(line.startsWith("Perseids peak Aug 12")).toBe(true);
  });

  it("adds a cloud note only from a supplied average", () => {
    expect(meteorLine(2026, 8, 12, 0, 80)).toContain("mostly cloudy");
    expect(meteorLine(2026, 8, 12, 0, 20)).toContain("mostly clear");
    expect(meteorLine(2026, 8, 12, 0, 55)).not.toContain("cloudy");
    expect(meteorLine(2026, 8, 12, 0, 55)).not.toContain("clear");
  });
});

describe("cloudsOnDate", () => {
  it("averages the matching day and ignores other days", () => {
    expect(
      cloudsOnDate(
        ["2026-08-12T00:00", "2026-08-12T01:00", "2026-08-13T00:00"],
        [80, 40, 0],
        2026,
        8,
        12,
      ),
    ).toBe(60);
    expect(cloudsOnDate(["2026-08-13T00:00"], [10], 2026, 8, 12)).toBeNull();
  });
});
