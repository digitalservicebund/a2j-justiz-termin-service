import { isPickableCourt } from "../../core/domain/court/court.ts";
import { courtMessages, SAVE_AS_DEFAULT_FIELD } from "./court-form.ts";

export type CourtField = { code: string | null; problem?: undefined } | { problem: string };

// Reads the court picked in a form. The empty option means no court, which is a problem only when
// one is required. Only courts of the dropdown are accepted.
export function parseCourtField(
  value: FormDataEntryValue | null,
  { required }: { required: boolean },
): CourtField {
  const code = typeof value === "string" ? value.trim() : "";
  if (code === "") return required ? { problem: courtMessages.required } : { code: null };
  if (!isPickableCourt(code)) return { problem: courtMessages.invalid };
  return { code };
}

export const wantsSaveAsDefault = (formData: FormData) =>
  formData.get(SAVE_AS_DEFAULT_FIELD) === "on";
