import { useEffect, useState, type KeyboardEvent } from "react";

import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormInput } from "~/components/shared/kern/KernFormInput";
import { KernHeading } from "~/components/shared/kern/KernHeading";
import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";

import {
  addWindows,
  berlinToday,
  formatDate,
  formatTime,
  nextWorkingDay,
  normalizeTime,
  parseDateList,
  parseEnd,
  parseTime,
  parseTimeRange,
  summarizeAdd,
  weekdayShort,
  type WindowText,
} from "./create-termin.entry";
import { MonthGrid } from "./create-termin.month-grid";
import { MAX_SLOTS, messages } from "./create-termin.schema";

export const ADD_DATE_ID = "add-date";
const ADD_HINT_ID = "add-hint";
const CALENDAR_ID = "add-calendar";

const focus = (id: string) => document.getElementById(id)?.focus();

type AddErrors = { date?: string; start?: string; end?: string };

// Looks like a finished time, so the cursor can move on to the end time.
const completeTime = /^(\d{1,2}:\d{2}|\d{4})$/;

// Adds one window per date from a single time range: type or pick the dates, set the times once.
// The times stay for the next round, and the date field offers the next working day.
export function AddWindows({
  existing,
  onAdd,
}: Readonly<{ existing: WindowText[]; onAdd: (windows: WindowText[]) => void }>) {
  const [dateText, setDateText] = useState("");
  const [dates, setDates] = useState<string[]>([]);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [errors, setErrors] = useState<AddErrors>({});
  const [notice, setNotice] = useState("");
  const [month, setMonth] = useState<string | null>(null);
  const [refocus, setRefocus] = useState(0);
  const [advance, setAdvance] = useState(0);

  // Used to draw the calendar; the actions below look at the day again when they run.
  const [shownToday] = useState(berlinToday);
  const atLimit = existing.length >= MAX_SLOTS;

  useEffect(() => {
    if (!refocus) return;
    const input = document.getElementById(ADD_DATE_ID) as HTMLInputElement | null;
    input?.focus();
    input?.select();
  }, [refocus]);

  // Moving on to the end time waits until the start time is in place; focus leaving the field
  // tidies it, and that must see what was just typed.
  useEffect(() => {
    if (advance) focus("add-end");
  }, [advance]);

  // Turns what is typed in the date field into chips. Returns null if some of it is unreadable,
  // which stays in the field.
  function commitDates(today = berlinToday()): string[] | null {
    const { dates: typed, invalid } = parseDateList(dateText, today);
    const merged = [...new Set([...dates, ...typed])].sort();
    setDates(merged);
    setDateText(invalid.join(", "));
    setErrors((current) => ({ ...current, date: invalid.length ? messages.date : undefined }));
    return invalid.length ? null : merged;
  }

  function add() {
    const today = berlinToday();
    const merged = commitDates(today);
    if (!merged) return focus(ADD_DATE_ID);

    // A range such as "9-11" in the start field fills in both times.
    const range = parseTimeRange(start);
    const startMinutes = range ? range.start : parseTime(start);
    const endMinutes = range ? range.end : parseEnd(end, startMinutes);
    const next: AddErrors = {};
    if (merged.length === 0) next.date = messages.noDates;
    if (startMinutes === null) next.start = messages.start;
    if (endMinutes === null) next.end = messages.end;
    else if (startMinutes !== null && endMinutes <= startMinutes) next.end = messages.range;
    if (next.date || next.start || next.end) {
      setErrors(next);
      focus(next.date ? ADD_DATE_ID : next.start ? "add-start" : "add-end");
      return;
    }

    const result = addWindows(existing, merged, { start: startMinutes!, end: endMinutes! }, today);
    onAdd(result.added);
    setNotice(summarizeAdd(result));
    setErrors({});
    setStart(formatTime(startMinutes!));
    setEnd(formatTime(endMinutes!));
    setDates([]);
    setDateText(result.added.length ? formatDate(nextWorkingDay(merged.at(-1)!)) : "");
    setRefocus((count) => count + 1);
  }

  const onDateKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === ",") {
      event.preventDefault();
      commitDates();
    } else if (event.key === "Enter") {
      // Enter must not submit the whole form.
      event.preventDefault();
      if (dateText.trim()) commitDates();
      else add();
    }
  };
  const onTimeKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    add();
  };

  const changeStart = (value: string) => {
    setStart(value);
    setErrors((current) => ({ ...current, start: undefined }));
    if (completeTime.test(value.trim())) setAdvance((count) => count + 1);
  };
  const tidyStart = () => {
    const range = parseTimeRange(start);
    if (range) {
      setStart(formatTime(range.start));
      setEnd(formatTime(range.end));
    } else setStart(normalizeTime(start));
  };
  const tidyEnd = () => {
    const minutes = parseEnd(end, parseTime(start));
    if (minutes !== null) setEnd(formatTime(minutes));
  };

  const toggleDay = (day: string) => {
    setDates((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort(),
    );
    setErrors((current) => ({ ...current, date: undefined }));
  };

  const dateDescription = [errors.date && `${ADD_DATE_ID}-error`, ADD_HINT_ID]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-labelledby="add-windows-title" className="create-termin__add-area">
      <KernHeading size="medium" level={3} id="add-windows-title">
        Zeitfenster hinzufügen
      </KernHeading>

      <div className="create-termin__add-fields">
        <KernFormInput
          id={ADD_DATE_ID}
          label="Datum"
          wrapperClassName="create-termin__field create-termin__field--date"
          placeholder="TT.MM.JJJJ"
          autoComplete="off"
          value={dateText}
          error={errors.date}
          aria-describedby={dateDescription}
          onChange={(event) => {
            setDateText(event.target.value);
            setErrors((current) => ({ ...current, date: undefined }));
          }}
          onKeyDown={onDateKeyDown}
        />
        <KernFormInput
          id="add-start"
          label="Beginn"
          wrapperClassName="create-termin__field create-termin__field--time"
          placeholder="HH:MM"
          autoComplete="off"
          value={start}
          error={errors.start}
          onChange={(event) => changeStart(event.target.value)}
          onBlur={tidyStart}
          onKeyDown={onTimeKeyDown}
        />
        <KernFormInput
          id="add-end"
          label="Ende"
          wrapperClassName="create-termin__field create-termin__field--time"
          placeholder="HH:MM"
          autoComplete="off"
          value={end}
          error={errors.end}
          onChange={(event) => {
            setEnd(event.target.value);
            setErrors((current) => ({ ...current, end: undefined }));
          }}
          onBlur={tidyEnd}
          onKeyDown={onTimeKeyDown}
        />
      </div>

      <p className="kern-hint" id={ADD_HINT_ID}>
        Mehrere Daten mit Komma trennen, zum Beispiel 27.10., morgen oder Di. Zeiten wie 9, 9:30
        oder 9-11; als Ende auch +2h.
      </p>

      {dates.length > 0 && (
        <ul className="create-termin__chips" aria-label="Ausgewählte Daten">
          {dates.map((day) => (
            <li className="create-termin__chip" key={day}>
              <span>{`${weekdayShort(day)} ${formatDate(day)}`}</span>
              <button
                type="button"
                className="create-termin__chip-remove"
                aria-label={`${formatDate(day)} entfernen`}
                onClick={() => toggleDay(day)}
              >
                <KernIcon name="close" size="small" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {month !== null && (
        <MonthGrid
          id={CALENDAR_ID}
          month={month}
          today={shownToday}
          selected={new Set(dates)}
          onToggle={toggleDay}
          onMonthChange={setMonth}
        />
      )}

      <div className="create-termin__add-actions">
        <KernButton
          type="button"
          style="tertiary"
          aria-expanded={month !== null}
          aria-controls={month === null ? undefined : CALENDAR_ID}
          onClick={() => setMonth(month === null ? (dates[0] ?? shownToday).slice(0, 7) : null)}
        >
          <KernIcon name="calendar-today" />
          <KernLabel>{month === null ? "Kalender öffnen" : "Kalender schließen"}</KernLabel>
        </KernButton>
        <KernButton type="button" style="secondary" disabled={atLimit} onClick={add}>
          <KernIcon name="add" />
          <KernLabel>Zeitfenster hinzufügen</KernLabel>
        </KernButton>
      </div>
      {atLimit && (
        <p className="kern-hint">{`Sie können höchstens ${MAX_SLOTS} Zeitfenster angeben.`}</p>
      )}
      <output className="kern-hint create-termin__notice">{notice}</output>
    </section>
  );
}
