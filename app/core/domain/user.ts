import { z } from "zod";

/**
 * Exported so tests can iterate over every role via `UserRoleSchema.options`.
 * Production code only uses it inside this module, so `knip --production` would
 * report it as unused.
 * @public
 */
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

// Roles of users who sign up themselves through an allowed domain.
export const SELF_SIGNUP_ROLES: UserRole[] = ["richter"];

export function hasRole(user: AuthUser, role: UserRole): boolean {
  return user.roles.includes("admin") || user.roles.includes(role);
}

export const NewUserSchema = AuthUserSchema.omit({ id: true }).extend({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().pipe(z.email()),
});
