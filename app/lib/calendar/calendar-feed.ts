import type { FeedAppointment } from "../../core/domain/availability.ts";
import { BASE_PATH } from "../web/base-path.ts";
import { PRODUCT_NAME } from "../web/page-meta.ts";
import { appointmentUrl } from "../web/paths.ts";
import { createTerminEvents, toCalendarSlot, wrapCalendar } from "./termin-calendar.ts";

// The path of the feed, below the origin. The token is the only secret in it.
export const calendarFeedPath = (token: string) =>
  `${BASE_PATH}/api/calendars/${encodeURIComponent(token)}/feed.ics`;

// The judge's calendar: open appointments with a tentative event per slot, where a slot is
// cancelled once the answers leave nothing of it, and confirmed appointments with one confirmed event for the chosen
// window. Events keep the UIDs of the mails, so a calendar that holds both shows each event once.
export function createCalendarFeed(
  appointments: FeedAppointment[],
  baseUrl: string,
  now: Date = new Date(),
): string {
  const events = appointments.flatMap(({ id, aktenzeichen, calendarSequence, confirmed, slots }) =>
    createTerminEvents({
      aktenzeichen,
      terminUrl: appointmentUrl(baseUrl, id),
      // Read, not raised: only mails take a new number.
      sequence: calendarSequence,
      now,
      synchronizedAt: now,
      slots: slots.map((slot) =>
        confirmed
          ? { id: slot.id, start: confirmed.start, end: confirmed.end, confirmed: true }
          : toCalendarSlot(slot),
      ),
    }),
  );

  return wrapCalendar(events, [
    `NAME:${PRODUCT_NAME}`,
    `X-WR-CALNAME:${PRODUCT_NAME}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
    "X-PUBLISHED-TTL:PT5M",
  ]);
}
