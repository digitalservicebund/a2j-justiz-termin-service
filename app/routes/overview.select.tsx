import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernGrid, KernGridCol } from "~/components/shared/kern/KernGrid";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import { resetClassName, stackClassName } from "~/components/shared/kern/layout";
import { formatRangeLong } from "~/core/domain/time/format";
import { getDb } from "~/database/database";

import { readValues, selectBreadcrumbs, selectionSearch } from "./overview.select.schema";
import { validateSelection } from "./overview.select.validate.server";

import "./overview.select.css";

type Params = { params: { appointmentId?: string } };

const notFound = () => data("Not found", { status: 404 });

// Only an open appointment has proposed windows to choose from.
async function loadOpenAppointment(request: Request, { params }: Params) {
  const user = await requireRole(request, "richter");
  const id = params.appointmentId ?? "";
  const appointment = await getAppointment(getDb(), user.id, id);
  if (!appointment) throw notFound();
  if (appointment.status !== "open") throw redirect(`/overview/${encodeURIComponent(id)}`);
  return { user, id, appointment };
}

export async function loader({ request, params }: { request: Request } & Params) {
  const { user, appointment } = await loadOpenAppointment(request, { params });
  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    windows: appointment.slots.map(formatRangeLong),
    // Going back from the review brings the earlier choice along.
    values: readValues(new URL(request.url).searchParams),
  };
}

export async function action({ request, params }: { request: Request } & Params) {
  const { id, appointment } = await loadOpenAppointment(request, { params });
  const values = readValues(await request.formData());

  const result = validateSelection(values, appointment.slots);
  if (!result.success) return data({ values, errors: result.errors }, { status: 400 });
  return redirect(`/overview/${encodeURIComponent(id)}/select/confirm?${selectionSearch(values)}`);
}

export default function OverviewSelect() {
  const { user, aktenzeichen, windows, values: saved } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the user just submitted wins over the earlier choice.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};

  return (
    <AppShell user={user} breadcrumbs={selectBreadcrumbs}>
      <FlowPage width="wide">
        {/* The Aktenzeichen takes a column of its own next to the form on wide screens. */}
        <KernGrid align="start" gapY="xl">
          <KernGridCol lg={5}>
            <KernDescriptionList column>
              <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
            </KernDescriptionList>
          </KernGridCol>

          <KernGridCol lg={7}>
            <Form method="post" className={stackClassName({ gap: "xl" }, "form")} noValidate>
              <KernHeading size="large" level={1}>
                Wählen Sie ein Datum und eine Startzeit aus
              </KernHeading>

              <KernFieldset
                id="fenster"
                legend="Zeitfenster"
                className={`overview-select__fieldset ${resetClassName}`}
                error={errors.slot}
              >
                {windows.map((label, index) => (
                  <KernFormCheck
                    key={label}
                    id={`fenster-${index}`}
                    type="radio"
                    label={label}
                    name="fenster"
                    value={String(index)}
                    defaultChecked={values.slot === String(index)}
                    invalid={Boolean(errors.slot)}
                  />
                ))}
              </KernFieldset>

              <KernFieldset
                id="startzeit"
                legend="Startzeit"
                className={`overview-select__fieldset ${resetClassName}`}
                error={errors.start}
              >
                <KernCluster wrap={false} gap="sm" align="end">
                  <KernFormInput
                    id="stunde"
                    label="Stunde"
                    compactLabel
                    width={2}
                    invalid={Boolean(errors.start)}
                    name="stunde"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    defaultValue={values.hour}
                  />
                  <span className="overview-select__colon" aria-hidden="true">
                    :
                  </span>
                  <KernFormInput
                    id="minute"
                    label="Minute"
                    compactLabel
                    width={2}
                    invalid={Boolean(errors.start)}
                    name="minute"
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={2}
                    defaultValue={values.minute}
                  />
                </KernCluster>
              </KernFieldset>

              <KernCluster gap="md" className="kern-pt-md">
                <KernLinkButton style="secondary" to="/overview">
                  Abbrechen
                </KernLinkButton>
                <KernButton type="submit" disabled={pending}>
                  Weiter
                </KernButton>
              </KernCluster>
            </Form>
          </KernGridCol>
        </KernGrid>
      </FlowPage>
    </AppShell>
  );
}
