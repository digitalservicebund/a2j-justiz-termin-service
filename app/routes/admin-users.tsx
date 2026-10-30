import { data, Form, Link, useActionData, useLoaderData, useNavigation } from "react-router";
import { z } from "zod";

import { requireAdmin } from "~/adapters/session/session";
import {
  deleteUser,
  insertUser,
  listUsers,
  updateUser,
  UpdateUserSchema,
  UserManagementError,
} from "~/adapters/users/users.server";
import { AppShell } from "~/components/shared/AppShell";
import { KernAlert } from "~/components/shared/kern/KernAlert";
import { KernBody } from "~/components/shared/kern/KernBody";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { NewUserSchema, type AuthUser, type UserRole } from "~/core/domain/user";
import { getDb } from "~/database/database";

import "./admin-users.css";

const roles: Array<{ value: UserRole; label: string }> = [
  { value: "admin", label: "Administratorrechte" },
  { value: "richter", label: "Richter" },
  { value: "klaeger", label: "Kläger" },
  { value: "beklagter", label: "Beklagter" },
];

export async function loader({ request }: { request: Request }) {
  const user = await requireAdmin(request);
  return { user, users: await listUsers() };
}

export async function action({ request }: { request: Request }) {
  const actor = await requireAdmin(request);
  const form = await request.formData();
  const raw = { ...Object.fromEntries(form), roles: form.getAll("roles") };
  const intent = form.get("intent");
  const schema =
    intent === "create"
      ? NewUserSchema
      : intent === "update"
        ? UpdateUserSchema
        : intent === "delete"
          ? z.object({ id: z.string().min(1) })
          : null;
  if (!schema || !schema.safeParse(raw).success) {
    return data({ error: "Bitte prüfen Sie Name, E‑Mail-Adresse und Rolle." }, { status: 400 });
  }
  try {
    const db = getDb();
    if (intent === "create") {
      await insertUser(db, NewUserSchema.parse(raw));
    } else if (intent === "update") {
      await updateUser(db, actor.id, UpdateUserSchema.parse(raw));
    } else {
      await deleteUser(db, actor.id, z.object({ id: z.string() }).parse(raw).id);
    }
    return data({ success: "Die Benutzerliste wurde aktualisiert." });
  } catch (error) {
    if (error instanceof UserManagementError) {
      return data({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

function UserFields({
  user,
  ownAccount = false,
}: Readonly<{ user?: AuthUser; ownAccount?: boolean }>) {
  const prefix = user?.id ?? "new";
  return (
    <>
      <KernFormInput
        id={`${prefix}-name`}
        label="Name"
        name="name"
        defaultValue={user?.name}
        maxLength={200}
        required
      />
      {!user && (
        <KernFormInput
          id={`${prefix}-email`}
          label="E‑Mail-Adresse"
          name="email"
          type="email"
          required
        />
      )}
      <KernFieldset id={`${prefix}-roles`} legend="Rollen">
        {roles.map(({ value, label }) => (
          <KernFormCheck
            key={value}
            id={`${prefix}-${value}`}
            type="checkbox"
            label={label}
            name="roles"
            value={value}
            defaultChecked={user?.roles.includes(value) ?? value === "richter"}
            disabled={ownAccount && value === "admin"}
          />
        ))}
        {ownAccount && <input type="hidden" name="roles" value="admin" />}
      </KernFieldset>
    </>
  );
}

export default function AdminUsersRoute() {
  const { user, users } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  return (
    <AppShell breadcrumbs={[{ label: "Benutzerverwaltung", href: "#" }]} user={user}>
      <KernBody>
        Hinterlegte E‑Mail-Adressen und Adressen{" "}
        <Link className="kern-link" to="/admin/domains">
          freigegebener Domains
        </Link>{" "}
        können sich anmelden. Änderungen beenden bestehende Sitzungen des betroffenen Benutzers.
        E‑Mail-Adressen können nicht geändert werden: Löschen Sie den Benutzer und legen Sie ihn neu
        an.
      </KernBody>
      {result && "error" in result && (
        <KernAlert type="error" title="Änderung nicht möglich" message={result.error} />
      )}
      {result && "success" in result && (
        <KernAlert type="success" title="Gespeichert" message={result.success} />
      )}
      <section aria-labelledby="new-user-title" className="admin-users__section">
        <KernHeading size="small" level={2} id="new-user-title">
          Benutzer hinzufügen
        </KernHeading>
        <Form method="post" className="admin-users__form">
          <input type="hidden" name="intent" value="create" />
          <UserFields />
          <KernButton type="submit" disabled={pending}>
            Hinzufügen
          </KernButton>
        </Form>
      </section>
      {users.map((entry) => (
        <section
          key={entry.id}
          aria-labelledby={`${entry.id}-title`}
          className="admin-users__section"
        >
          <KernHeading size="small" level={2} id={`${entry.id}-title`}>
            {entry.email}
          </KernHeading>
          <Form method="post" className="admin-users__form">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={entry.id} />
            <UserFields
              key={`${entry.name}-${entry.roles.join("-")}`}
              user={entry}
              ownAccount={entry.id === user.id}
            />
            <KernButton type="submit" disabled={pending}>
              Speichern
            </KernButton>
          </Form>
          {entry.id !== user.id && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={entry.id} />
              <KernButton type="submit" style="secondary" disabled={pending}>
                Benutzer löschen
              </KernButton>
            </Form>
          )}
        </section>
      ))}
    </AppShell>
  );
}
