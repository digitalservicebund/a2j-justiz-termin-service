import { useFetcher } from "react-router";
import type { AuthUser, UserRole } from "~/core/domain/user";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "RICHTER", label: "Richter" },
  { value: "KLAEGER", label: "Kläger" },
  { value: "BEKLAGTER", label: "Beklagter" },
];

export function AppNav({ user }: Readonly<{ user?: AuthUser }>) {
  const fetcher = useFetcher();

  return (
    <nav>
      <label className="sr-only" htmlFor="role-select">
        Role
      </label>
      <select
        id="role-select"
        value={user?.role ?? ""}
        onChange={(e) =>
          fetcher.submit({ role: e.target.value }, { method: "post", action: "/login" })
        }
        className="bg-white/10 text-white text-sm font-medium border border-white/20 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/40 transition-colors"
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
    </nav>
  );
}
