import type { AppointmentSummary } from "~/adapters/appointments/appointments.server";
import type { KernBadgeType } from "~/components/shared/kern/KernBadge";
import { formatInstant } from "~/core/domain/time/format";

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
