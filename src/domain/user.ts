export type UserRole = "RICHTER" | "KLAEGER" | "BEKLAGTER";

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthService {
  getUserByRole(role: UserRole): AuthUser | null;
  getUserById(id: string): AuthUser | null;
}
