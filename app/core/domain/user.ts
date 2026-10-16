import { z } from "zod";

export const UserRoleSchema = z.enum(["admin", "richter", "klaeger", "beklagter"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const AuthUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  roles: z
    .array(UserRoleSchema)
    .min(1)
    .refine((roles) => new Set(roles).size === roles.length, {
      message: "Rollen dürfen nicht mehrfach vergeben werden.",
    }),
});
export type AuthUser = z.infer<typeof AuthUserSchema>;

export function hasRole(user: AuthUser, role: UserRole): boolean {
  return user.roles.includes("admin") || user.roles.includes(role);
}

export const NewUserSchema = AuthUserSchema.omit({ id: true }).extend({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
