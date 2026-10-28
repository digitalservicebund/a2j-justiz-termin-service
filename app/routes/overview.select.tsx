import { data, Form, redirect, useActionData, useLoaderData, useNavigation } from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { getAvailability } from "~/adapters/appointments/survey.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { FlowPage } from "~/components/shared/FlowPage";
import { KernButton } from "~/components/shared/kern/KernButton";
import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";
import { KernFieldset } from "~/components/shared/kern/KernFieldset";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLinkButton } from "~/components/shared/kern/KernLinkButton";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernRowHeader,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { getDb } from "~/database/database";

import {
  describeSlot,
  describeTimes,
  formatDay,
  readValues,
  selectBreadcrumbs,
  selectionSearch,
  validateSelection,
} from "./overview.select.schema";

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
  const { user, id, appointment } = await loadOpenAppointment(request, { params });
  const { guests } = await getAvailability(getDb(), id);
  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    windows: appointment.slots.map(describeSlot),
    columns: appointment.slots.map((slot) => ({
      day: formatDay(slot.start),
      times: describeTimes(slot),
    })),
    guests,
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
  const {
    user,
    aktenzeichen,
    windows,
    columns,
    guests,
    values: saved,
  } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  const pending = useNavigation().state !== "idle";
  // What the user just submitted wins over the earlier choice.
  const values = result?.values ?? saved;
  const errors = result?.errors ?? {};

  return (
    <AppShell user={user} breadcrumbs={selectBreadcrumbs}>
      <FlowPage width="wide">
        <div className="overview-select__layout">
          <KernDescriptionList column className="overview-select__facts">
            <KernDescriptionListItem label="Aktenzeichen">{aktenzeichen}</KernDescriptionListItem>
          </KernDescriptionList>

          <Form method="post" className="overview-select__form" noValidate>
            <KernHeading size="large" level={1}>
              Wählen Sie ein Datum und eine Startzeit aus
            </KernHeading>

            <Availability columns={columns} guests={guests} />

            <KernFieldset
              id="fenster"
              legend="Zeitfenster"
              className="overview-select__fieldset"
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
              className="overview-select__fieldset"
              error={errors.start}
            >
              <div className="overview-select__time">
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
              </div>
            </KernFieldset>

            <div className="overview-select__actions">
              <KernLinkButton style="secondary" to="/overview">
                Abbrechen
              </KernLinkButton>
              <KernButton type="submit" disabled={pending}>
                Weiter
              </KernButton>
            </div>
          </Form>
        </div>
      </FlowPage>
    </AppShell>
  );
}

const answerLabels = { yes: "Verfügbar", no: "Nicht verfügbar", none: "Keine Antwort" } as const;

type AvailabilityProps = {
  columns: Array<{ day: string; times: string }>;
  guests: Array<{ id: string; name: string; answers: Array<"yes" | "no" | null> }>;
};

// Guests in rows and windows in columns, so the judge sees at a glance which window suits most.
function Availability({ columns, guests }: Readonly<AvailabilityProps>) {
  return (
    <section aria-labelledby="verfuegbarkeiten" className="overview-select__availability">
      <KernHeading size="medium" level={2} id="verfuegbarkeiten">
        Verfügbarkeiten der Verfahrensbeteiligten
      </KernHeading>
      {guests.length === 0 ? (
        <p>Es hat noch niemand geantwortet.</p>
      ) : (
        <div className="overview-select__scroll">
          <KernTable caption="Verfügbarkeiten je Zeitfenster" hideCaption>
            <KernTableHead>
              <KernRow>
                <KernColumn>Name</KernColumn>
                {columns.map(({ day, times }) => (
                  <KernColumn key={`${day} ${times}`} variant="action">
                    {day}
                    <br />
                    {times}
                  </KernColumn>
                ))}
              </KernRow>
            </KernTableHead>
            <KernTableBody>
              {guests.map(({ id, name, answers }) => (
                <KernRow key={id}>
                  <KernRowHeader>{name}</KernRowHeader>
                  {answers.map((answer, index) => {
                    const kind = answer ?? "none";
                    return (
                      <KernCell
                        key={`${columns[index]?.day} ${columns[index]?.times}`}
                        variant="action"
                        className={`overview-select__answer overview-select__answer--${kind}`}
                      >
                        {answer === "yes" && <KernIcon name="success" />}
                        {answer === "no" && <KernIcon name="close" />}
                        {answer === null && <span aria-hidden="true">–</span>}
                        <span className="kern-sr-only">{answerLabels[kind]}</span>
                      </KernCell>
                    );
                  })}
                </KernRow>
              ))}
              <KernRow>
                <KernRowHeader>Zusagen</KernRowHeader>
                {columns.map(({ day, times }, index) => (
                  <KernCell key={`${day} ${times}`} variant="action">
                    {guests.filter(({ answers }) => answers[index] === "yes").length} von{" "}
                    {guests.length}
                  </KernCell>
                ))}
              </KernRow>
            </KernTableBody>
          </KernTable>
        </div>
      )}
    </section>
  );
}
