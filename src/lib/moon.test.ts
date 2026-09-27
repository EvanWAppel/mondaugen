import { describe, expect, it } from "vitest";
import { moonLitPath, moonPhase } from "./moon";

const SYNODIC_MS = 29.530588853 * 24 * 60 * 60 * 1000;
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14, 0);

describe("moonPhase", () => {
  it("is a new moon at the reference epoch", () => {
    const moon = moonPhase(NEW_MOON);
    expect(moon.name).toBe("New moon");
    expect(moon.illumination).toBeCloseTo(0, 5);
  });

  it("is full half a synodic month later", () => {
    const moon = moonPhase(NEW_MOON + SYNODIC_MS / 2);
    expect(moon.name).toBe("Full moon");
    expect(moon.illumination).toBeCloseTo(1, 5);
  });

  it("is first quarter a quarter month after new", () => {
    const moon = moonPhase(NEW_MOON + SYNODIC_MS / 4);
    expect(moon.name).toBe("First quarter");
    expect(moon.illumination).toBeCloseTo(0.5, 5);
  });

  it("names the crescent on either side of full", () => {
    expect(moonPhase(NEW_MOON + SYNODIC_MS * 0.1).name).toBe("Waxing crescent");
    expect(moonPhase(NEW_MOON + SYNODIC_MS * 0.85).name).toBe("Waning crescent");
  });
});

describe("moonLitPath", () => {
  it("draws a full disc at full moon and an empty sliver at new moon", () => {
    const full = moonLitPath(0.5);
    const fresh = moonLitPath(0);
    expect(full).toContain("0 0 1");
    expect(full).toContain("0 0 0");
    expect(fresh.match(/0 0 1/g)?.length).toBe(2);
  });

  it("flips the lit limb in the southern hemisphere", () => {
    expect(moonLitPath(0.1, false)).not.toBe(moonLitPath(0.1, true));
  });
});
