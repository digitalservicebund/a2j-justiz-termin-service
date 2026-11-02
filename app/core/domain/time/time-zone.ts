// Every appointment happens in Germany, so all dates and times are read and shown in Berlin time,
// whatever the time zone of the server or the browser is.
export const TIME_ZONE = "Europe/Berlin";

// sv-SE writes a date as YYYY-MM-DD, which sorts and compares correctly as a string.
const dayFormat = new Intl.DateTimeFormat("sv-SE", { timeZone: TIME_ZONE });

// The Berlin calendar day an instant falls on, as "YYYY-MM-DD". Shortly after midnight in Berlin
// the UTC day is still the day before, so this is the only way to ask "which day is this?".
export const berlinDay = (instant: Date): string => dayFormat.format(instant);
