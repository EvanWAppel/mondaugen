import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkyFacts from "./SkyFacts";
import type { SkyInput } from "@/lib/sky";

const skyLines = vi.hoisted(() => vi.fn());

vi.mock("@/lib/sky", () => ({ skyLines }));

// The component lazy-imports the sky library; give it headroom under a loaded parallel run.
const ASYNC = { timeout: 5000 };

const input: SkyInput = {
  latitude: 40.7,
  longitude: -74,
  utcOffsetSeconds: -4 * 3600,
  nowMs: Date.UTC(2026, 9, 22, 22),
  sunriseIso: "2026-10-22T07:12",
  sunsetIso: "2026-10-22T18:05",
  nextSunriseIso: "2026-10-23T07:13",
  hourlyTime: [],
  hourlyCloud: [],
};

describe("SkyFacts", () => {
  beforeEach(() => {
    skyLines.mockReset();
  });

  it("renders the three sky lines once the library loads", async () => {
    skyLines.mockReturnValue(["Meteors: a", "Planets: b", "Eclipse: c"]);
    render(<SkyFacts {...input} />);
    const list = await screen.findByRole("list", { name: "Tonight's sky" }, ASYNC);
    expect(list.querySelectorAll("li")).toHaveLength(3);
    expect(screen.getByText("Planets: b")).toBeInTheDocument();
    expect(skyLines).toHaveBeenCalledWith(input);
  });

  it("shows a readable message when the sky computation fails (FR-16)", async () => {
    skyLines.mockImplementation(() => {
      throw new Error("ephemeris exploded");
    });
    render(<SkyFacts {...input} />);
    expect(await screen.findByText("Sky facts unavailable.", {}, ASYNC)).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tonight's sky" })).not.toBeInTheDocument();
  });

  it("does not throw into the surrounding forecast when it fails", async () => {
    skyLines.mockImplementation(() => {
      throw new Error("ephemeris exploded");
    });
    render(
      <section aria-label="Forecast">
        <p>10-day forecast</p>
        <SkyFacts {...input} />
      </section>,
    );
    await screen.findByText("Sky facts unavailable.", {}, ASYNC);
    expect(screen.getByRole("region", { name: "Forecast" })).toBeInTheDocument();
    expect(screen.getByText("10-day forecast")).toBeInTheDocument();
  });
});
