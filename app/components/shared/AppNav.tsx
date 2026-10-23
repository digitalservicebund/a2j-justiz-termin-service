import { Form, Link } from "react-router";

import { KernButton } from "~/components/shared/kern/KernButton";
import type { AuthUser } from "~/core/domain/user";

export function AppNav({ user }: Readonly<{ user?: AuthUser }>) {
  return (
    <nav aria-label="Benutzerkonto">
      {user ? (
        <>
          <p className="kern-body">
            {user.name} ({user.roles.join(", ")})
          </p>
          <Link className="kern-link" to="/home">
            Übersicht
          </Link>
          {user.roles.includes("admin") && (
            <Link className="kern-link" to="/admin/users">
              Benutzerverwaltung
            </Link>
          )}
          <Form method="post" action="/?index">
            <input type="hidden" name="intent" value="logout" />
            <KernButton type="submit" style="secondary">
              Abmelden
            </KernButton>
          </Form>
        </>
      ) : (
        <Link className="kern-link" to="/">
          Anmelden
        </Link>
      )}
    </nav>
  );
}
