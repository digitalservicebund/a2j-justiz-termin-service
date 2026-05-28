import { isRouteErrorResponse, useRouteError } from "react-router";
import { DEFAULT_CASE_ID, schedulingQuery } from "~/bootstrap";
import { AppNav } from "~/components/shared/AppNav";
import type { AuthUser } from "~/core/domain/user";

export async function loadOverview() {
  return schedulingQuery.getOverview(DEFAULT_CASE_ID);
}

export function formatSlotRange(
  startsAtIso: string,
  endsAtIso: string,
): string {
  const start = new Date(startsAtIso);
  const end = new Date(endsAtIso);

  return `${start.toLocaleString("de-DE")} - ${end.toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export function InlineError({ message }: Readonly<{ message: string }>) {
  return (
    <div className="kern-alert kern-alert--danger" role="alert">
      <div className="kern-alert__header">
        <span className="kern-icon kern-icon--danger" aria-hidden="true" />
        <span className="kern-title">Error</span>
      </div>
      <div className="kern-alert__body">
        <p className="kern-body">{message}</p>
      </div>
    </div>
  );
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
      <InlineError message={message} />
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
    <div className="min-h-screen bg-slate-50">
      <header className="p-kern-space-default bg-kern-orange-050 sticky top-0 z-10 shadow-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="kern-heading-large">Justitz Termin Service</h1>
            <p className="kern-heading-small">Court Appointment service</p>
          </div>
          <AppNav user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10">
        <h1 className="kern-heading-medium">{title}</h1>
        {children}
      </main>
    </div>
  );
}
