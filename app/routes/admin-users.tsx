import { data, Form, useActionData, useLoaderData, useNavigation } from "react-router";
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
import Alert from "~/components/shared/Alert";
import { Button } from "~/components/shared/Button";
import { Shell } from "~/components/shared/SchedulingShared";
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
    return data({ error: "Bitte prüfen Sie Name, E-Mail-Adresse und Rolle." }, { status: 400 });
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
      <div className="kern-form-input">
        <label className="kern-label" htmlFor={`${prefix}-name`}>
          Name
        </label>
        <input
          className="kern-form-input__input"
          id={`${prefix}-name`}
          name="name"
          defaultValue={user?.name}
          maxLength={200}
          required
        />
      </div>
      {!user && (
        <div className="kern-form-input">
          <label className="kern-label" htmlFor={`${prefix}-email`}>
            E-Mail-Adresse
          </label>
          <input
            className="kern-form-input__input"
            id={`${prefix}-email`}
            name="email"
            type="email"
            required
          />
        </div>
      )}
      <fieldset>
        <legend className="kern-label">Rollen</legend>
        {roles.map(({ value, label }) => (
          <div className="kern-form-check" key={value}>
            <input
              className="kern-form-check__checkbox"
              id={`${prefix}-${value}`}
              name="roles"
              type="checkbox"
              value={value}
              defaultChecked={user?.roles.includes(value) ?? value === "richter"}
              disabled={ownAccount && value === "admin"}
            />
            <label className="kern-label" htmlFor={`${prefix}-${value}`}>
              {label}
            </label>
          </div>
        ))}
        {ownAccount && <input type="hidden" name="roles" value="admin" />}
      </fieldset>
    </>
  );
}

export default function AdminUsersRoute() {
  const { user, users } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  return (
    <Shell title="Benutzerverwaltung" user={user}>
      <p className="kern-body">
        Nur hinterlegte E-Mail-Adressen können sich anmelden. Änderungen beenden bestehende
        Sitzungen des betroffenen Benutzers. E-Mail-Adressen können nicht geändert werden: Löschen
        Sie den Benutzer und legen Sie ihn neu an.
      </p>
      {result && "error" in result && (
        <Alert type="error" title="Änderung nicht möglich" message={result.error} />
      )}
      {result && "success" in result && (
        <Alert type="success" title="Gespeichert" message={result.success} />
      )}
      <section aria-labelledby="new-user-title" className="admin-users__section">
        <h2 className="kern-heading-small" id="new-user-title">
          Benutzer hinzufügen
        </h2>
        <Form method="post" className="admin-users__form">
          <input type="hidden" name="intent" value="create" />
          <UserFields />
          <Button type="submit" disabled={pending}>
            Hinzufügen
          </Button>
        </Form>
      </section>
      {users.map((entry) => (
        <section
          key={entry.id}
          aria-labelledby={`${entry.id}-title`}
          className="admin-users__section"
        >
          <h2 className="kern-heading-small" id={`${entry.id}-title`}>
            {entry.email}
          </h2>
          <Form method="post" className="admin-users__form">
            <input type="hidden" name="intent" value="update" />
            <input type="hidden" name="id" value={entry.id} />
            <UserFields
              key={`${entry.name}-${entry.roles.join("-")}`}
              user={entry}
              ownAccount={entry.id === user.id}
            />
            <Button type="submit" disabled={pending}>
              Speichern
            </Button>
          </Form>
          {entry.id !== user.id && (
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input type="hidden" name="id" value={entry.id} />
              <Button type="submit" style="secondary" disabled={pending}>
                Benutzer löschen
              </Button>
            </Form>
          )}
        </section>
      ))}
    </Shell>
  );
}
