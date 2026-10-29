import FiraSansMedium from "@kern-ux/native/dist/fonts/fira-sans/FiraSans-Medium.woff2?url";
import FiraSansRegular from "@kern-ux/native/dist/fonts/fira-sans/FiraSans-Regular.woff2?url";
import FiraSansSemiBold from "@kern-ux/native/dist/fonts/fira-sans/FiraSans-SemiBold.woff2?url";
import type { ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import { AppShell } from "~/components/shared/AppShell";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { BASE_PATH } from "~/lib/base-path";

import type { Route } from "./+types/root";

import "./app.css";
import "./root.css";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: `${BASE_PATH}/favicon.ico`, sizes: "48x48" },
  { rel: "icon", href: `${BASE_PATH}/favicon.svg`, type: "image/svg+xml" },
  { rel: "apple-touch-icon", href: `${BASE_PATH}/apple-touch-icon.png` },
  { rel: "manifest", href: `${BASE_PATH}/site.webmanifest` },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20,400,0,0&icon_names=lock,lock_open",
  },
  {
    rel: "preload",
    href: FiraSansRegular,
    as: "font",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: FiraSansMedium,
    as: "font",
    crossOrigin: "anonymous",
  },
  {
    rel: "preload",
    href: FiraSansSemiBold,
    as: "font",
    crossOrigin: "anonymous",
  },
];

export function Layout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <title>Justitz Termin Service</title>
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let title = "Oops!";

  let message = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Error 404" : "Error";
    message =
      error.status === 404 ? "The requested page could not be found." : error.statusText || message;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    message = error.message;
    stack = error.stack;
  }

  return (
    <AppShell>
      <KernAlert type="error" title={title} message={message} />
      {stack && (
        <pre className="app-error-stack">
          <code>{stack}</code>
        </pre>
      )}
    </AppShell>
  );
}
