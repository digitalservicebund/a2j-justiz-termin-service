import type { AppointmentSummary } from "~/adapters/appointments/appointments.server";
import type { KernBadgeType } from "~/components/shared/kern/KernBadge";

const dateFormat = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Berlin",
});

const timeFormat = new Intl.DateTimeFormat("de-DE", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Berlin",
});

export const formatInstant = (instant: Date) =>
  `${dateFormat.format(instant)} um ${timeFormat.format(instant)}`;

export type StatusBadge = { type: KernBadgeType; text: string };

export function describeStatus(
  { status, confirmedSlot }: Pick<AppointmentSummary, "status" | "confirmedSlot">,
  now: Date = new Date(),
): StatusBadge {
  switch (status) {
    case "draft":
      return { type: "custom-grey", text: "Entwurf" };
    case "open":
      return { type: "info", text: "Offen für Rückmeldungen" };
    case "cancelled":
      return { type: "danger", text: "Kein Zeitfenster passt" };
    case "confirmed": {
      // A confirmed appointment always has its slot; the fallback only guards against bad data.
      if (!confirmedSlot) return { type: "success", text: "Termin ist bestätigt" };
      // Once it is over, the appointment is history and no longer worth a highlight.
      if (confirmedSlot.end < now) {
        return { type: "custom-grey", text: formatInstant(confirmedSlot.start) };
      }
      return { type: "success", text: `Termin ist ${formatInstant(confirmedSlot.start)}` };
    }
  }
}
