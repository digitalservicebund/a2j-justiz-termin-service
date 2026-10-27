import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";

import { KernButton } from "~/components/shared/kern/KernButton";
import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";
import { KernIcon } from "~/components/shared/kern/KernIcon";

import {
  addDays,
  dragRange,
  formatDate,
  formatTime,
  GRID_END,
  GRID_START,
  mondayOf,
  parseDate,
  parseTime,
  SLOT_MINUTES,
  weekdayShort,
  type WindowRow,
} from "./create-termin.entry";

const SLOT_COUNT = (GRID_END - GRID_START) / SLOT_MINUTES;
// Used while the grid has no height to measure from, as in tests.
const FALLBACK_SLOT_PX = 14;
const HOURS = Array.from({ length: (GRID_END - GRID_START) / 60 }, (_, i) => GRID_START / 60 + i);

type Drag = { iso: string; anchor: number; current: number; top: number; slotPx: number };

const slotsFrom = (minutes: number) => (minutes - GRID_START) / SLOT_MINUTES;

const position = (start: number, end: number) => ({
  top: `calc(${slotsFrom(start)} * var(--week-slot))`,
  height: `calc(${(end - start) / SLOT_MINUTES} * var(--week-slot))`,
});

// What is on a day, as minutes; windows that cannot be read are not drawn.
function windowsOn(windows: WindowRow[], today: string, iso: string) {
  return windows.flatMap((window) => {
    const start = parseTime(window.start);
    const end = parseTime(window.end);
    const valid = parseDate(window.date, today) === iso && start !== null && end !== null;
    return valid && end > start ? [{ id: window.id, start, end }] : [];
  });
}

// A week to pick windows in with the mouse: drag over free time to make a window, click a window
// to select it. It is one more way to fill the same list, so it has no keyboard handling of its
// own; the form above does that.
export function WeekView({
  windows,
  today,
  onCreate,
  onRemove,
}: Readonly<{
  windows: WindowRow[];
  today: string;
  onCreate: (iso: string, range: { start: number; end: number }) => void;
  onRemove: (id: number) => void;
}>) {
  const [weekStart, setWeekStart] = useState(() => {
    const monday = mondayOf(today);
    // On a weekend the weekdays that are still ahead are next week's.
    return today > addDays(monday, 4) ? addDays(monday, 7) : monday;
  });
  const [weekend, setWeekend] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDragState] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const setDrag = useCallback((next: Drag | null) => {
    dragRef.current = next;
    setDragState(next);
  }, []);

  const days = Array.from({ length: weekend ? 7 : 5 }, (_, i) => addDays(weekStart, i));

  const dragging = drag !== null;
  useEffect(() => {
    if (!dragging) return;
    const cellAt = (event: globalThis.MouseEvent, current: Drag) => {
      const row = Math.floor((event.clientY - current.top) / current.slotPx);
      return GRID_START + Math.min(Math.max(row, 0), SLOT_COUNT - 1) * SLOT_MINUTES;
    };
    const move = (event: globalThis.MouseEvent) => {
      const current = dragRef.current;
      if (current) setDrag({ ...current, current: cellAt(event, current) });
    };
    const finish = (event: globalThis.MouseEvent) => {
      const current = dragRef.current;
      setDrag(null);
      if (!current) return;
      const end = cellAt(event, current);
      const range = dragRange(current.anchor, end, windowsOn(windows, today, current.iso));
      if (range) onCreate(current.iso, range);
    };
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrag(null);
    };
    globalThis.addEventListener("mousemove", move);
    globalThis.addEventListener("mouseup", finish);
    globalThis.addEventListener("keydown", cancel);
    return () => {
      globalThis.removeEventListener("mousemove", move);
      globalThis.removeEventListener("mouseup", finish);
      globalThis.removeEventListener("keydown", cancel);
    };
  }, [dragging, windows, today, onCreate, setDrag]);

  const startDrag = (event: MouseEvent<HTMLDivElement>, iso: string) => {
    if (event.button !== 0 || iso < today || (event.target as HTMLElement).closest("button")) {
      return;
    }
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const slotPx = rect.height / SLOT_COUNT || FALLBACK_SLOT_PX;
    const row = Math.min(
      Math.max(Math.floor((event.clientY - rect.top) / slotPx), 0),
      SLOT_COUNT - 1,
    );
    const anchor = GRID_START + row * SLOT_MINUTES;
    if (!dragRange(anchor, anchor, windowsOn(windows, today, iso))) return;
    setSelected(null);
    setDrag({ iso, anchor, current: anchor, top: rect.top, slotPx });
  };

  const preview = drag && dragRange(drag.anchor, drag.current, windowsOn(windows, today, drag.iso));
  const last = days.at(-1)!;
  const selectedWindow = windows.find((window) => window.id === selected);

  return (
    <div className="create-termin__week" id="add-week">
      <div className="create-termin__week-bar">
        <KernButton
          type="button"
          style="tertiary"
          aria-label="Vorherige Woche"
          disabled={weekStart <= mondayOf(today)}
          onClick={() => setWeekStart(addDays(weekStart, -7))}
        >
          <KernIcon name="chevron-left" />
        </KernButton>
        <strong aria-live="polite">{`${formatDate(weekStart)} – ${formatDate(last)}`}</strong>
        <KernButton
          type="button"
          style="tertiary"
          aria-label="Nächste Woche"
          onClick={() => setWeekStart(addDays(weekStart, 7))}
        >
          <KernIcon name="chevron-right" />
        </KernButton>
        <KernFormCheck
          id="week-weekend"
          type="checkbox"
          label="Wochenende anzeigen"
          checked={weekend}
          onChange={(event) => setWeekend(event.target.checked)}
        />
        <KernButton
          type="button"
          style="tertiary"
          disabled={!selectedWindow}
          onClick={() => {
            if (!selectedWindow) return;
            onRemove(selectedWindow.id);
            setSelected(null);
          }}
        >
          Ausgewähltes Zeitfenster entfernen
        </KernButton>
      </div>
      <p className="kern-hint">
        Über freie Zeit ziehen, um ein Zeitfenster anzulegen; ein Zeitfenster anklicken, um es
        auszuwählen. Mit der Tastatur geht es im Formular darüber.
      </p>

      <div
        className="create-termin__week-grid"
        style={{ gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` }}
      >
        <span />
        {days.map((iso) => (
          <strong
            className={`create-termin__week-head${iso === today ? " create-termin__week-head--today" : ""}`}
            key={iso}
          >
            {`${weekdayShort(iso)} ${iso.slice(8)}.${iso.slice(5, 7)}.`}
          </strong>
        ))}
        <div className="create-termin__week-hours" aria-hidden="true">
          {HOURS.map((hour) => (
            <span key={hour}>{`${hour}:00`}</span>
          ))}
        </div>
        {days.map((iso) => (
          <div
            role="presentation"
            className={`create-termin__week-day${iso < today ? " create-termin__week-day--past" : ""}`}
            data-date={iso}
            key={iso}
            onMouseDown={(event) => startDrag(event, iso)}
          >
            {windowsOn(windows, today, iso).map(({ id, start, end }) => {
              const times = `${formatTime(start)}–${formatTime(end)}`;
              return (
                <button
                  type="button"
                  className="create-termin__week-window"
                  style={position(Math.max(start, GRID_START), Math.min(end, GRID_END))}
                  aria-pressed={selected === id}
                  aria-label={`Zeitfenster ${weekdayShort(iso)} ${formatDate(iso)}, ${times}`}
                  key={id}
                  onClick={() => setSelected(selected === id ? null : id)}
                  onKeyDown={(event) => {
                    if (event.key !== "Delete" && event.key !== "Backspace") return;
                    event.preventDefault();
                    onRemove(id);
                    setSelected(null);
                  }}
                >
                  {times}
                </button>
              );
            })}
            {preview && drag.iso === iso && (
              <div
                className="create-termin__week-preview"
                style={position(preview.start, preview.end)}
                aria-hidden="true"
              >
                {`${formatTime(preview.start)}–${formatTime(preview.end)}`}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
