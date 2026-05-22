import { isRouteErrorResponse, Link, useRouteError } from "react-router";
import { AppNav } from "~/components/shared/appNav";
import type { AuthUser } from "@/domain/user";
import { DEFAULT_CASE_ID, schedulingQuery } from "@/bootstrap";

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
    <main className="mx-auto max-w-4xl px-6 py-8 space-y-8">
      <header className="space-y-3">
        <h1 className="kern-heading-large">{title}</h1>
        {user ? (
          <AppNav user={user} />
        ) : (
          <Link className="kern-link" to="/login">
            Back to login
          </Link>
        )}
      </header>
      {children}
    </main>
  );
}
