import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { useHydrated } from "~/lib/use-hydrated";

function Probe() {
  return <p>{useHydrated() ? "hydrated" : "server"}</p>;
}

describe("useHydrated", () => {
  it("is false when rendered on the server", () => {
    expect(renderToString(<Probe />)).toContain("server");
  });

  it("is true in the browser", () => {
    render(<Probe />);
    expect(screen.getByText("hydrated")).toBeInTheDocument();
  });
});
