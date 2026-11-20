import type { AppointmentStatus } from "~/database/types";

// Workflow order of the statuses, which is also the order of the status filter.
export const statusOrder: AppointmentStatus[] = ["draft", "open", "confirmed", "cancelled"];

export const statusFilterLabels: Record<AppointmentStatus, string> = {
  draft: "Entwurf",
  open: "Offen für Rückmeldungen",
  confirmed: "Termin bestätigt",
  cancelled: "Kein Zeitfenster passt",
};

export type SortKey = "status" | "aktenzeichen";
export type StatusFilter = AppointmentStatus | "none";
export type OverviewQuery = { sort: SortKey; filter: StatusFilter };

export const sortLabels: Record<SortKey, string> = {
  status: "Status",
  aktenzeichen: "Aktenzeichen",
};

// Unknown or missing values fall back to the defaults, so a hand-edited URL never breaks the page.
export function parseOverviewQuery(params: URLSearchParams): OverviewQuery {
  const sort = params.get("sort");
  const filter = params.get("filter");
  return {
    sort: sort === "aktenzeichen" ? "aktenzeichen" : "status",
    filter: statusOrder.find((status) => status === filter) ?? "none",
  };
}

// Filters, then sorts. The sort is stable, so entries keep their incoming order (newest first)
// within the same status.
export function applyOverviewQuery<T extends { aktenzeichen: string; status: AppointmentStatus }>(
  entries: T[],
  { sort, filter }: OverviewQuery,
): T[] {
  const filtered = filter === "none" ? entries : entries.filter(({ status }) => status === filter);
  if (sort === "aktenzeichen") {
    return [...filtered].sort((a, b) =>
      a.aktenzeichen.localeCompare(b.aktenzeichen, "de", { numeric: true }),
    );
  }
  return [...filtered].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
  );
}
