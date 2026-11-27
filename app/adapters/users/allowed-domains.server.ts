import type { Kysely } from "kysely";

import { AllowedDomainSchema, emailDomain } from "../../core/domain/allowed-domain.ts";
import type { Database } from "../../database/types.ts";
import { logAudit } from "../../lib/infra/logging.ts";

export class AllowedDomainError extends Error {}

export function listAllowedDomains(db: Kysely<Database>) {
  return db.selectFrom("allowed_domain").select("domain").orderBy("domain").execute();
}

export async function insertAllowedDomain(db: Kysely<Database>, actorId: string, input: string) {
  const domain = AllowedDomainSchema.parse(input);
  const result = await db
    .insertInto("allowed_domain")
    .values({ domain })
    .onConflict((conflict) => conflict.column("domain").doNothing())
    .returning("domain")
    .executeTakeFirst();
  if (!result) throw new AllowedDomainError("Diese Domain ist bereits freigegeben.");
  logAudit("allowed-domain.added", { actorId, domain: result.domain });
  return result;
}

export async function deleteAllowedDomain(db: Kysely<Database>, actorId: string, input: string) {
  const domain = AllowedDomainSchema.parse(input);
  const result = await db
    .deleteFrom("allowed_domain")
    .where("domain", "=", domain)
    .returning("domain")
    .executeTakeFirst();
  if (!result) throw new AllowedDomainError("Domain nicht gefunden.");
  logAudit("allowed-domain.removed", { actorId, domain });
}

export async function isEmailDomainAllowed(db: Kysely<Database>, email: string) {
  const row = await db
    .selectFrom("allowed_domain")
    .select("domain")
    .where("domain", "=", emailDomain(email))
    .executeTakeFirst();
  return row !== undefined;
}
