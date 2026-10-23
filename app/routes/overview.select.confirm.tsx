import { data, redirect, useLoaderData } from "react-router";

import { confirmAppointment, getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { KernBody } from "~/components/shared/kern/KernBody";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { getDb } from "~/database/database";

import { ReviewPage } from "./create-termin.review";
import {
  readValues,
  selectBreadcrumbs,
  selectionSearch,
  validateSelection,
} from "./overview.select.schema";
import { formatInstant } from "./overview.status";

import "./overview.select.css";

type Params = { params: { appointmentId?: string } };

const notFound = () => data("Not found", { status: 404 });

const detailUrl = (id: string) => `/overview/${encodeURIComponent(id)}`;

export async function loader({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw notFound();
  if (appointment.status !== "open") throw redirect(detailUrl(id));

  // Without a valid choice there is nothing to review, so the judge picks again.
  const values = readValues(new URL(request.url).searchParams);
  const result = validateSelection(values, appointment.slots);
  if (!result.success) throw redirect(`${detailUrl(id)}/select?${selectionSearch(values)}`);

  return {
    user,
    values,
    aktenzeichen: appointment.aktenzeichen,
    termin: formatInstant(result.window.start),
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const form = await request.formData();
  const intent = form.get("intent");
  const values = readValues(form);

  if (intent === "back") return redirect(`${detailUrl(id)}/select?${selectionSearch(values)}`);
  if (intent !== "confirm") throw data("Bad request", { status: 400 });

  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw notFound();
  const result = validateSelection(values, appointment.slots);
  if (!result.success) return redirect(`${detailUrl(id)}/select?${selectionSearch(values)}`);
  if (!(await confirmAppointment(getDb(), user.id, id, result.window))) {
    // Someone else confirmed it in the meantime; the detail page shows what happened.
    return redirect(detailUrl(id));
  }
  return redirect(`${detailUrl(id)}/selected`);
}

export default function OverviewSelectConfirm() {
  const { user, values, aktenzeichen, termin } = useLoaderData<typeof loader>();
  return (
    <AppShell user={user} breadcrumbs={selectBreadcrumbs}>
      <ReviewPage
        wide
        sections={[
          {
            id: "verhandlungsdaten",
            title: "Verhandlungsdaten",
            editable: false,
            children: (
              <KernDescriptionList>
                <KernDescriptionListItem label="Aktenzeichen">
                  {aktenzeichen}
                </KernDescriptionListItem>
              </KernDescriptionList>
            ),
          },
          {
            id: "termin",
            title: "Ausgewählter Termin",
            children: <KernBody bold>{termin}</KernBody>,
          },
        ]}
        submit={{ label: "Termin bestätigen", intent: "confirm" }}
      >
        <input type="hidden" name="fenster" value={values.slot} />
        <input type="hidden" name="stunde" value={values.hour} />
        <input type="hidden" name="minute" value={values.minute} />
      </ReviewPage>
    </AppShell>
  );
}
