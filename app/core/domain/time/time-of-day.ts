// A Berlin wall-clock time without a date, as minutes since midnight: 09:30 is 570. It names no
// instant until a date is added, so it has no offset and holds in summer and winter alike.
export type TimeOfDay = number;

const toNumber = (value: string) => (/^\d{1,2}$/.test(value) ? Number(value) : null);

// Reads an hour and a minute as typed into a form. Null unless both are numbers of a real clock
// time, 0 to 23 and 0 to 59.
export function parseTimeOfDay(hour: string, minute: string): TimeOfDay | null {
  const h = toNumber(hour);
  const m = toNumber(minute);
  if (h === null || m === null || h > 23 || m > 59) return null;
  return h * 60 + m;
}

export const hourOf = (time: TimeOfDay) => Math.floor(time / 60);
export const minuteOf = (time: TimeOfDay) => time % 60;

const twoDigits = (value: number) => String(value).padStart(2, "0");

// "09:30", as Postgres takes a time column. Also what format.ts shows.
export const toSqlTime = (time: TimeOfDay) =>
  `${twoDigits(hourOf(time))}:${twoDigits(minuteOf(time))}`;

// Postgres returns a time column as "09:30:00". Seconds are never stored, so they are ignored.
export function fromSqlTime(value: string): TimeOfDay {
  const match = /^(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/.exec(value);
  if (!match) throw new Error(`Not a time of day: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}
