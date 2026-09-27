import { describe, expect, it } from "vitest";
import { nextEclipse, planetLine, visiblePlanets } from "./sky";

describe("nextEclipse", () => {
  it("finds the 8 April 2024 total solar eclipse from Dallas", () => {
    // Dallas was on the path of totality. Offset is CDT (UTC−5).
    const fact = nextEclipse(32.7767, -96.797, Date.UTC(2024, 3, 1), -5 * 3600);
    expect(fact?.kind).toBe("total solar");
    expect(fact?.when).toBe("Apr 8, 2024");
  });
});

describe("visiblePlanets", () => {
  it("names the bright planets up over New York on the night of 15 Dec 2024", () => {
    // 20:00 EST to 06:00 EST: 01:00–11:00 UTC.
    const planets = visiblePlanets(
      40.71,
      -74.01,
      Date.UTC(2024, 11, 15, 1, 0),
      Date.UTC(2024, 11, 15, 11, 0),
    );
    expect(planets.map((planet) => `${planet.name}:${planet.direction}`)).toEqual([
      "Jupiter:southeast",
      "Mars:southwest",
    ]);
    expect(planets[0].magnitude).toBeLessThan(planets[1].magnitude);
    expect(planetLine(planets)).toBe("Jupiter in the southeast · Mars in the southwest");
  });

  it("says so when nothing bright is up", () => {
    expect(planetLine([])).toBe("No bright planets up tonight");
  });
});
