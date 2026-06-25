import { useFetcher } from "react-router";
import type { AuthUser, UserRole } from "~/core/domain/user";

const ROLES: Array<{ value: UserRole; label: string }> = [
  { value: "RICHTER", label: "Richter" },
  { value: "KLAEGER", label: "Kläger" },
  { value: "BEKLAGTER", label: "Beklagter" },
];

export function AppNav({ user }: Readonly<{ user?: AuthUser }>) {
  const fetcher = useFetcher();

  return (
    <nav>
      <div className="kern-form-input">
        <label className="kern-label" htmlFor="select">
          Role
        </label>
        <div className="kern-form-input__select-wrapper">
          <select
            id="role-select"
            value={user?.role ?? ""}
            onChange={(e) =>
              fetcher.submit(
                { role: e.target.value },
                { method: "post", action: "/login" },
              )
            }
            className="kern-form-input__select"
          >
            {!user && (
              <option value="" disabled>
                Select a role…
              </option>
            )}
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </nav>
  );
}
