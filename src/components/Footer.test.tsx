import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Footer from "./Footer";

describe("Footer", () => {
  it("shows the product name", () => {
    render(<Footer />);
    expect(screen.getByText("Mondaugen")).toBeInTheDocument();
  });

  it("attributes all three data sources with links", () => {
    render(<Footer />);
    for (const name of ["Open-Meteo", "RainViewer", "OpenStreetMap"]) {
      const link = screen.getByRole("link", { name });
      expect(link).toHaveAttribute("href");
    }
  });
});
