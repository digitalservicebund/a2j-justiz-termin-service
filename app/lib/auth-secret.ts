import { requireSecret } from "./secrets.ts";

export function getAuthSecret(): string {
  return requireSecret("better-auth", "BETTER_AUTH_SECRET");
}
