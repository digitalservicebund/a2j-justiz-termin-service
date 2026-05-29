import { z } from "zod";

export const UserRoleSchema = z.enum(["RICHTER", "KLAEGER", "BEKLAGTER"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: UserRoleSchema,
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export interface AuthService {
  getUserByRole(role: UserRole): AuthUser | null;
  getUserById(id: string): AuthUser | null;
}
