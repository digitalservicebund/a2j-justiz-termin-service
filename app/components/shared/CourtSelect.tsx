import type { CourtGroup } from "~/core/domain/court/court";

import { KernFormSelect } from "./kern/KernFormSelect";

// The dropdown of the courts a judge can pick, grouped by Bundesland. The loader passes the groups,
// so the code list stays on the server. It works without JavaScript; the browser's type-ahead
// finds a court by its first letters.
export function CourtSelect({
  id,
  name,
  label,
  groups,
  defaultValue,
  emptyLabel,
  error,
  hint,
}: Readonly<{
  id: string;
  name: string;
  label: string;
  groups: readonly CourtGroup[];
  // The code of the court that is selected at first. Null selects the empty option.
  defaultValue: string | null;
  // The text of the option that stands for no court.
  emptyLabel: string;
  error?: string;
  hint?: string;
}>) {
  return (
    <KernFormSelect
      id={id}
      name={name}
      label={label}
      error={error}
      hint={hint}
      defaultValue={defaultValue ?? ""}
      // Remounts when a rejected submit brings back what was picked.
      key={defaultValue ?? ""}
    >
      <option value="">{emptyLabel}</option>
      {groups.map(({ label: groupLabel, courts }) => (
        <optgroup key={groupLabel} label={groupLabel}>
          {courts.map(({ code, name: courtName }) => (
            <option key={code} value={code}>
              {courtName}
            </option>
          ))}
        </optgroup>
      ))}
    </KernFormSelect>
  );
}
