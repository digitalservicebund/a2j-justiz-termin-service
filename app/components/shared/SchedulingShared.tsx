import { isRouteErrorResponse, useRouteError } from "react-router";
import { AppNav } from "~/components/shared/AppNav";
import type { AuthUser } from "~/core/domain/user";
import { DEFAULT_CASE_ID, schedulingQuery } from "~/bootstrap";

export async function loadOverview() {
  return schedulingQuery.getOverview(DEFAULT_CASE_ID);
}

export function formatSlotRange(startsAtIso: string, endsAtIso: string): string {
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
      <header className="sticky top-0 z-10 bg-[#1A3DA5] shadow-md border-b border-white/10">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-base leading-tight tracking-tight">
              Gerichtsterminplanung
            </p>
            <p className="text-white/50 text-xs tracking-widest uppercase mt-0.5">
              Court Appointment Scheduling
            </p>
          </div>
          <AppNav user={user} />
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10 space-y-6">
        <h1 className="kern-heading-large">{title}</h1>
        {children}
      </main>
    </div>
  );
}
