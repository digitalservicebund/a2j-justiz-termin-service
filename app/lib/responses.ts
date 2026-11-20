import { data } from "react-router";

// The error responses that loaders and actions throw. The error boundary shows the not-found page
// for a 404.
export const notFound = () => data("Not found", { status: 404 });

export const badRequest = () => data("Bad request", { status: 400 });
