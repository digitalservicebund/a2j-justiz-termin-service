import { data, Form, useActionData, useLoaderData, useNavigation } from "react-router";

import { requireAdmin } from "~/adapters/session/session";
import {
  AllowedDomainError,
  deleteAllowedDomain,
  insertAllowedDomain,
  listAllowedDomains,
} from "~/adapters/users/allowed-domains.server";
import { AppShell } from "~/components/shared/AppShell";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { AllowedDomainSchema } from "~/core/domain/allowed-domain";
import { getDb } from "~/database/database";

import "./admin-users.css";

export async function loader({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  return { user, domains: await listAllowedDomains(getDb()) };
}

export async function action({ request }: { request: Request }) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const domain = AllowedDomainSchema.safeParse(form.get("domain"));
  if ((intent !== "create" && intent !== "delete") || !domain.success) {
    return data({ error: "Bitte geben Sie eine gültige Domain ein, z. B. example.com." }, 400);
  }
  try {
    if (intent === "create") {
      await insertAllowedDomain(getDb(), domain.data);
    } else {
      await deleteAllowedDomain(getDb(), domain.data);
    }
    return data({ success: "Die Liste der freigegebenen Domains wurde aktualisiert." });
  } catch (error) {
    if (error instanceof AllowedDomainError) {
      return data({ error: error.message }, 400);
    }
    throw error;
  }
}

export default function AdminDomainsRoute() {
  const { user, domains } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  return (
    <AppShell breadcrumbs={[{ label: "Freigegebene Domains", href: "#" }]} user={user}>
      <KernBody>
        Wer sich mit einer E‑Mail-Adresse dieser Domains anmeldet, erhält automatisch ein Konto mit
        der Rolle Richter. Subdomains müssen einzeln freigegeben werden. Das Entfernen einer Domain
        löscht keine bestehenden Konten.
      </KernBody>
      {result && "error" in result && (
        <KernAlert type="error" title="Änderung nicht möglich" message={result.error} />
      )}
      {result && "success" in result && (
        <KernAlert type="success" title="Gespeichert" message={result.success} />
      )}
      <section aria-labelledby="new-domain-title" className="admin-users__section">
        <KernHeading size="small" level={2} id="new-domain-title">
          Domain hinzufügen
        </KernHeading>
        <Form method="post" className="admin-users__form">
          <input type="hidden" name="intent" value="create" />
          <KernFormInput id="new-domain" label="Domain" name="domain" required />
          <KernButton type="submit" disabled={pending}>
            Hinzufügen
          </KernButton>
        </Form>
      </section>
      {domains.map(({ domain }) => (
        <section key={domain} aria-label={domain} className="admin-users__section">
          <KernHeading size="small" level={2}>
            {domain}
          </KernHeading>
          <Form method="post">
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="domain" value={domain} />
            <KernButton type="submit" style="secondary" disabled={pending}>
              Domain entfernen
            </KernButton>
          </Form>
        </section>
      ))}
    </AppShell>
  );
}
