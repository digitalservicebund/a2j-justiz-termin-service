import type { LoaderFunction } from "react-router";

export const loader: LoaderFunction = async () => {
  return Response.json({ status: "ok" });
};
