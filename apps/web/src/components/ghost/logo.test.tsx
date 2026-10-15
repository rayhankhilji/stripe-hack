import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("T-F11-AC7: lockup on a forest panel has accessible name Ghost and inherits currentColor", () => {
    render(
      <div className="bg-forest text-petal">
        <Logo variant="lockup" />
      </div>,
    );
    const svg = screen.getByRole("img", { name: "Ghost" });
    expect(svg.getAttribute("fill")).toBe("currentColor");
    for (const path of svg.querySelectorAll("path")) {
      expect(path.getAttribute("fill")).toBeNull();
    }
  });

  it("sets the rendered height from size and keeps the viewBox aspect ratio", () => {
    render(<Logo variant="symbol" size={40} title="Ghost home" />);
    const svg = screen.getByRole("img", { name: "Ghost home" });
    expect(svg.getAttribute("height")).toBe("40");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.querySelectorAll("path")).toHaveLength(2);
  });

  it("renders the wordmark as a single outlined path with no live text", () => {
    render(<Logo variant="wordmark" />);
    const svg = screen.getByRole("img", { name: "Ghost" });
    expect(svg.querySelector("text")).toBeNull();
    expect(svg.querySelectorAll("path")).toHaveLength(1);
  });
});
