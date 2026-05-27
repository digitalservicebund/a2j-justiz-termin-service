import { Form } from "react-router";
import type { AuthUser } from "~/core/domain/user";

export function AppNav({ user }: Readonly<{ user: AuthUser }>) {
  return (
    <nav className="flex items-center justify-between gap-4">
      <span className="kern-body">{user.name}</span>
      <Form action="/logout" method="post">
        <button className="kern-btn kern-btn--tertiary" type="submit">
          <span className="kern-label">Logout</span>
        </button>
      </Form>
    </nav>
  );
}
