import { isRouteErrorResponse, useRouteError } from "react-router";

import { DEFAULT_CASE_ID, schedulingQuery } from "~/bootstrap";
import Alert from "~/components/shared/Alert";
import { AppNav } from "~/components/shared/AppNav";
import type { AuthUser } from "~/core/domain/user";

import "./SchedulingShared.css";

export function loadOverview() {
  return schedulingQuery.getOverview(DEFAULT_CASE_ID);
}

export function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);

  return `${start.toLocaleTimeString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })} - ${end.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function RouteErrorBoundary({ title }: Readonly<{ title: string }>) {
  const error = useRouteError();
  let message = "An unexpected error occurred.";

  if (isRouteErrorResponse(error)) {
    message = error.statusText;
  } else if (error instanceof Error) {
    message = error.message;
  }

  return (
    <Shell title={title}>
      <Alert type="error" title="Error" message={message} />
    </Shell>
  );
}

export function Shell({
  title,
  user,
  children,
}: Readonly<{
  title: string;
  user?: AuthUser;
  children: React.ReactNode;
}>) {
  return (
    <div className="app-shell">
      <header className="app-shell__header">
        <div className="app-shell__header-inner">
          <div className="app-shell__brand">
            <h1 className="kern-heading-large app-shell__title">Justitz Termin Service</h1>
            <p className="kern-heading-small app-shell__subtitle">Court Appointment service</p>
          </div>
          <AppNav user={user} />
        </div>
      </header>
      <main className="app-shell__main">
        <h1 className="kern-heading-medium">{title}</h1>
        {children}
      </main>
    </div>
  );
}
