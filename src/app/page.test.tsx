import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the app brand", () => {
    render(<Home />);
    expect(
      screen.getByRole("link", { name: /Mondaugen home/i }),
    ).toBeInTheDocument();
  });
});
