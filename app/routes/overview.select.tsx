import {
  data,
  Form,
  Link,
  redirect,
  useActionData,
  useLoaderData,
  useNavigation,
} from "react-router";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { AppShell } from "~/components/shared/AppShell";
import { Button } from "~/components/shared/Button";
import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { FlowPage } from "~/components/shared/FlowPage";
import { getDb } from "~/database/database";

import {
  describeSlot,
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
  const { user, appointment } = await loadOpenAppointment(request, { params });
  return {
    user,
    aktenzeichen: appointment.aktenzeichen,
    windows: appointment.slots.map(describeSlot),
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
      <FlowPage className="overview-select">
        <div className="overview-select__layout">
          <dl className="kern-description-list kern-description-list--col overview-select__facts">
            <div className="kern-description-list-item">
              <dt className="kern-description-list-item__key">Aktenzeichen</dt>
              <dd className="kern-description-list-item__value">{aktenzeichen}</dd>
            </div>
          </dl>

          <Form method="post" className="overview-select__form" noValidate>
            <h1 className="kern-heading-large">Wählen Sie ein Datum und eine Startzeit aus</h1>

            <fieldset
              className={`kern-fieldset overview-select__fieldset${errors.slot ? " kern-fieldset--error" : ""}`}
              aria-describedby={errors.slot ? "fenster-error" : undefined}
            >
              <legend className="kern-label">Zeitfenster</legend>
              <div className="kern-fieldset__body">
                {windows.map((label, index) => (
                  <div className="kern-form-check" key={label}>
                    <input
                      className={`kern-form-check__radio${errors.slot ? " kern-form-check__radio--error" : ""}`}
                      id={`fenster-${index}`}
                      name="fenster"
                      type="radio"
                      value={String(index)}
                      defaultChecked={values.slot === String(index)}
                    />
                    <label className="kern-label" htmlFor={`fenster-${index}`}>
                      {label}
                    </label>
                  </div>
                ))}
              </div>
              {errors.slot && <ErrorMessage id="fenster-error">{errors.slot}</ErrorMessage>}
            </fieldset>

            <fieldset
              className={`kern-fieldset overview-select__fieldset${errors.start ? " kern-fieldset--error" : ""}`}
              aria-describedby={errors.start ? "startzeit-error" : undefined}
            >
              <legend className="kern-label">Startzeit</legend>
              <div className="kern-fieldset__body">
                <div className="overview-select__time">
                  <div className="kern-form-input">
                    <label
                      className="kern-label kern-label--small kern-label--subtle"
                      htmlFor="stunde"
                    >
                      Stunde
                    </label>
                    <input
                      className={`kern-form-input__input kern-form-input__input--width-2${errors.start ? " kern-form-input__input--error" : ""}`}
                      id="stunde"
                      name="stunde"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      defaultValue={values.hour}
                      aria-invalid={Boolean(errors.start) || undefined}
                    />
                  </div>
                  <span className="overview-select__colon" aria-hidden="true">
                    :
                  </span>
                  <div className="kern-form-input">
                    <label
                      className="kern-label kern-label--small kern-label--subtle"
                      htmlFor="minute"
                    >
                      Minute
                    </label>
                    <input
                      className={`kern-form-input__input kern-form-input__input--width-2${errors.start ? " kern-form-input__input--error" : ""}`}
                      id="minute"
                      name="minute"
                      inputMode="numeric"
                      autoComplete="off"
                      maxLength={2}
                      defaultValue={values.minute}
                      aria-invalid={Boolean(errors.start) || undefined}
                    />
                  </div>
                </div>
              </div>
              {errors.start && <ErrorMessage id="startzeit-error">{errors.start}</ErrorMessage>}
            </fieldset>

            <div className="overview-select__actions">
              <Link className="kern-btn kern-btn--secondary" to="/overview">
                <span className="kern-label">Abbrechen</span>
              </Link>
              <Button type="submit" disabled={pending}>
                Weiter
              </Button>
            </div>
          </Form>
        </div>
      </FlowPage>
    </AppShell>
  );
}
