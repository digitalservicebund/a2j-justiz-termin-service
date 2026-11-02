export type TimeRange = { start: Date; end: Date };

type TimeColumns = { start_time: Date | string; end_time: Date | string | null };

// end_time is nullable in the schema to leave room for open-ended slots, but the form always sets
// it. A slot without an end is read as having no length.
export function rowToRange({ start_time, end_time }: TimeColumns): TimeRange {
  return { start: new Date(start_time), end: new Date(end_time ?? start_time) };
}

type ConfirmedColumns = {
  confirmed_start_time: Date | string | null;
  confirmed_end_time: Date | string | null;
};

// The window the judge chose within a slot, which may be shorter than the slot. Appointments that
// are not confirmed have none.
export function confirmedWindow({
  confirmed_start_time,
  confirmed_end_time,
}: ConfirmedColumns): TimeRange | null {
  if (confirmed_start_time === null || confirmed_end_time === null) return null;
  return { start: new Date(confirmed_start_time), end: new Date(confirmed_end_time) };
}
