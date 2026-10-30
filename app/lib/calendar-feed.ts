import type { FeedAppointment } from "../adapters/appointments/calendar-feed.server.ts";
import { BASE_PATH } from "./base-path.ts";
import {
  availableNames,
  createTerminEvents,
  isCancelled,
  wrapCalendar,
} from "./email/termin-calendar.ts";

export const CALENDAR_FEED_NAME = "Verhandlungstermin-Finder";

// The path of the feed, below the origin. The token is the only secret in it.
export const calendarFeedPath = (token: string) =>
  `${BASE_PATH}/api/calendars/${encodeURIComponent(token)}/feed.ics`;

// The judge's calendar: open appointments with a tentative event per slot, where a slot someone
// cannot attend is cancelled, and confirmed appointments with one confirmed event for the chosen
// window. Events keep the UIDs of the mails, so a calendar that holds both shows each event once.
export function createCalendarFeed(
  appointments: FeedAppointment[],
  baseUrl: string,
  now: Date = new Date(),
): string {
  const events = appointments.flatMap(({ id, aktenzeichen, calendarSequence, confirmed, slots }) =>
    createTerminEvents({
      aktenzeichen,
      terminUrl: `${baseUrl}${BASE_PATH}/overview/${encodeURIComponent(id)}`,
      // Read, not raised: only mails take a new number.
      sequence: calendarSequence,
      now,
      synchronizedAt: now,
      slots: slots.map((slot) =>
        confirmed
          ? { id: slot.id, start: confirmed.start, end: confirmed.end, confirmed: true }
          : {
              id: slot.id,
              start: slot.start,
              end: slot.end,
              cancelled: isCancelled(slot),
              availableNames: availableNames(slot),
            },
      ),
    }),
  );

  return wrapCalendar(events, [
    `NAME:${CALENDAR_FEED_NAME}`,
    `X-WR-CALNAME:${CALENDAR_FEED_NAME}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
    "X-PUBLISHED-TTL:PT5M",
  ]);
}
