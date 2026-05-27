import type { AuthService, AuthUser, UserRole } from "~/core/domain/user";

export class InMemoryAuthService implements AuthService {
  private readonly users: AuthUser[] = [
    { id: "richter-1",   name: "Richter",   role: "RICHTER"   },
    { id: "klaeger-1",   name: "Klaeger",   role: "KLAEGER"   },
    { id: "beklagter-1", name: "Beklagter", role: "BEKLAGTER" },
  ];

  getUserByRole(role: UserRole): AuthUser | null {
    return this.users.find((u) => u.role === role) ?? null;
  }

  getUserById(id: string): AuthUser | null {
    return this.users.find((u) => u.id === id) ?? null;
  }
}
