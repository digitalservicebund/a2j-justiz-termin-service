import { KernButton } from "~/components/shared/kern/KernButton";
import { KernIcon } from "~/components/shared/kern/KernIcon";

const weekdayHeads = [
  ["Mo", "Montag"],
  ["Di", "Dienstag"],
  ["Mi", "Mittwoch"],
  ["Do", "Donnerstag"],
  ["Fr", "Freitag"],
  ["Sa", "Samstag"],
  ["So", "Sonntag"],
] as const;

const monthTitle = new Intl.DateTimeFormat("de-DE", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const dayLabel = new Intl.DateTimeFormat("de-DE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// A month is "YYYY-MM"; a day is "YYYY-MM-DD".
function shiftMonth(month: string, delta: number): string {
  const [year, number] = month.split("-").map(Number) as [number, number];
  const shifted = new Date(Date.UTC(year, number - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

// Weeks start on Monday; days before the 1st and after the last day are null.
function weeksOf(month: string): Array<Array<string | null>> {
  const [year, number] = month.split("-").map(Number) as [number, number];
  const leading = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, number, 0)).getUTCDate();
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: length }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

// Days are toggle buttons in the normal tab order, so it works with keyboard and screen readers
// without a grid widget's arrow-key handling. Days before today cannot be picked.
export function MonthGrid({
  id,
  month,
  today,
  selected,
  onToggle,
  onMonthChange,
}: Readonly<{
  id: string;
  month: string;
  today: string;
  selected: ReadonlySet<string>;
  onToggle: (day: string) => void;
  onMonthChange: (month: string) => void;
}>) {
  const title = monthTitle.format(new Date(`${month}-01T00:00:00Z`));
  return (
    <div className="create-termin__calendar" id={id}>
      <div className="create-termin__calendar-head">
        <KernButton
          type="button"
          style="tertiary"
          aria-label="Vorheriger Monat"
          disabled={month <= today.slice(0, 7)}
          onClick={() => onMonthChange(shiftMonth(month, -1))}
        >
          <KernIcon name="chevron-left" />
        </KernButton>
        <strong aria-live="polite">{title}</strong>
        <KernButton
          type="button"
          style="tertiary"
          aria-label="Nächster Monat"
          onClick={() => onMonthChange(shiftMonth(month, 1))}
        >
          <KernIcon name="chevron-right" />
        </KernButton>
      </div>
      <table className="create-termin__month" aria-label={title}>
        <thead>
          <tr>
            {weekdayHeads.map(([short, long]) => (
              <th scope="col" key={short} abbr={long}>
                {short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeksOf(month).map((week) => (
            <tr key={week.find(Boolean) ?? month}>
              {week.map((day, position) => (
                <td key={day ?? `empty-${position}`}>
                  {day && (
                    <button
                      type="button"
                      className="create-termin__day"
                      aria-pressed={selected.has(day)}
                      aria-current={day === today ? "date" : undefined}
                      aria-label={dayLabel.format(new Date(`${day}T00:00:00Z`))}
                      disabled={day < today}
                      onClick={() => onToggle(day)}
                    >
                      {Number(day.slice(8))}
                    </button>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
