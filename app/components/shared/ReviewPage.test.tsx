import { renderToString } from "react-dom/server";
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type StaticHandlerContext,
} from "react-router";
import { describe, expect, it } from "vitest";

import { ReviewPage } from "./ReviewPage";

describe("ReviewPage", () => {
  it("leaves the sections as plain <details> and no bulk buttons without JavaScript", async () => {
    const routes = [
      {
        path: "/",
        Component: () => (
          <ReviewPage
            sections={[{ id: "a", title: "A", children: "x" }]}
            submit={{ label: "Los", intent: "go" }}
          />
        ),
      },
    ];
    const context = (await createStaticHandler(routes).query(
      new Request("http://localhost/"),
    )) as StaticHandlerContext;
    const html = renderToString(
      <StaticRouterProvider router={createStaticRouter(routes, context)} context={context} />,
    );

    expect(html).toContain("<details");
    expect(html).not.toContain("Alle einblenden");
  });
});
