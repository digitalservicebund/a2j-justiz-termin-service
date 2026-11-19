import { createRequestHandler } from "@react-router/express";
import "react-router";

export const app = createRequestHandler({
  build: () => import("virtual:react-router/server-build"),
});
