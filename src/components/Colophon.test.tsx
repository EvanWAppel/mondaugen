import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Colophon from "./Colophon";

function openDialog() {
  render(<Colophon />);
  fireEvent.click(screen.getByRole("button", { name: /How it.s built/ }));
  return screen.getByRole("dialog", { name: "How it's built" });
}

describe("Colophon", () => {
  it("is closed until the button is pressed", () => {
    render(<Colophon />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("credits every data source with an external link (NFR-4)", () => {
    const dialog = openDialog();
    const sources: [RegExp, string][] = [
      [/Open-Meteo/, "https://open-meteo.com/"],
      [/RainViewer/, "https://www.rainviewer.com/"],
      [/NASA GIBS/, "https://www.earthdata.nasa.gov/gibs"],
      [/OpenStreetMap/, "https://maplibre.org/"],
    ];
    for (const [name, href] of sources) {
      const link = within(dialog).getByRole("link", { name });
      expect(link).toHaveAttribute("href", href);
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    }
  });

  it("closes from the close button", () => {
    const dialog = openDialog();
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
