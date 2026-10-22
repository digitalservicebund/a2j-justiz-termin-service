import { AppNav } from "~/components/shared/AppNav";
import type { AuthUser } from "~/core/domain/user";

import "./SchedulingShared.css";

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
