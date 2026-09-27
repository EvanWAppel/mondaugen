import { beforeEach, describe, expect, it } from "vitest";
import { readStored } from "./storage";

beforeEach(() => localStorage.clear());

describe("readStored", () => {
  it("prefers the mondaugen key when both are set", () => {
    localStorage.setItem("mondaugen:favorites", "new");
    localStorage.setItem("weather:favorites", "old");
    expect(readStored("mondaugen:favorites")).toBe("new");
    expect(localStorage.getItem("weather:favorites")).toBe("old");
  });

  it("copies a legacy weather key forward once", () => {
    localStorage.setItem("weather:temperature-unit", "celsius");
    expect(readStored("mondaugen:temperature-unit")).toBe("celsius");
    expect(localStorage.getItem("mondaugen:temperature-unit")).toBe("celsius");
    expect(localStorage.getItem("weather:temperature-unit")).toBeNull();
  });

  it("returns null when nothing is stored", () => {
    expect(readStored("mondaugen:active-location")).toBeNull();
  });
});
