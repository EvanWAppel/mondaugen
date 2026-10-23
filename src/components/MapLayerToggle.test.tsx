import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MapLayerToggle from "./MapLayerToggle";

describe("MapLayerToggle", () => {
  it("is a labelled radio group with Radar, Both and Wind", () => {
    render(<MapLayerToggle mode="radar" onChange={vi.fn()} />);
    const group = screen.getByRole("radiogroup", { name: "Map layer" });
    expect(group).toBeInTheDocument();
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.textContent)).toEqual(["Radar", "Both", "Wind"]);
  });

  it.each(["radar", "both", "wind"] as const)(
    "marks only %s as checked",
    (mode) => {
      render(<MapLayerToggle mode={mode} onChange={vi.fn()} />);
      const labels = { radar: "Radar", both: "Both", wind: "Wind" };
      for (const [value, label] of Object.entries(labels)) {
        expect(screen.getByRole("radio", { name: label })).toHaveAttribute(
          "aria-checked",
          String(value === mode),
        );
      }
    },
  );

  it("calls onChange with the chosen layer", () => {
    const onChange = vi.fn();
    render(<MapLayerToggle mode="radar" onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: "Wind" }));
    expect(onChange).toHaveBeenCalledWith("wind");
    fireEvent.click(screen.getByRole("radio", { name: "Both" }));
    expect(onChange).toHaveBeenLastCalledWith("both");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("does not change selection on its own (controlled)", () => {
    render(<MapLayerToggle mode="radar" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Wind" }));
    expect(screen.getByRole("radio", { name: "Radar" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
