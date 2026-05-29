import { isRouteErrorResponse, useRouteError } from "react-router";
import { DEFAULT_CASE_ID, schedulingQuery } from "~/bootstrap";
import { AppNav } from "~/components/shared/AppNav";
import type { AuthUser } from "~/core/domain/user";
import Alert from "~/components/shared/Alert";

export async function loadOverview() {
  return schedulingQuery.getOverview(DEFAULT_CASE_ID);
}

export function formatSlotRange(
  startsAtIso: string,
  endsAtIso: string,
): string {
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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <header className="bg-kern-orange-050 p-kern-space-default sticky top-0 z-10 shadow-md dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="kern-heading-large">Justitz Termin Service</h1>
            <p className="kern-heading-small dark:text-slate-300">
              Court Appointment service
            </p>
          </div>
          <AppNav user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-10 dark:text-slate-100">
        <h1 className="kern-heading-medium">{title}</h1>
        {children}
      </main>
    </div>
  );
}
