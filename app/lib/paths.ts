import { BASE_PATH } from "./base-path.ts";

// Where the pages of the app live, below BASE_PATH. Every link and redirect to a Terminumfrage or a
// survey is built here, so a URL changes in one place.

const segment = encodeURIComponent;

// Adds a query string. Given one, the "?" is always there, even for an empty search.
const withSearch = (path: string, search?: string) =>
  search === undefined ? path : `${path}?${search}`;

export const OVERVIEW_PATH = "/overview";

// The first page of a new Terminumfrage.
export const NEW_APPOINTMENT_PATH = "/overview/new";

// Stands for a time slot or a person of the proceeding that does not exist yet.
export const NEW_ITEM = "neu";

// The detail page of a published Terminumfrage. All other pages of one sit below it.
export const appointmentPath = (id: string) => `${OVERVIEW_PATH}/${segment(id)}`;

// A draft continues in the form, which reads it by its id.
export const draftPath = (id: string) => `${NEW_APPOINTMENT_PATH}?entwurf=${segment(id)}`;

// A new slot can start as a copy of an existing one.
export const slotPath = (id: string, slotId: string, copyOf?: string) =>
  withSearch(
    `${appointmentPath(id)}/zeitfenster/${segment(slotId)}`,
    copyOf ? `kopie=${segment(copyOf)}` : undefined,
  );

export const participantPath = (id: string, participantId: string) =>
  `${appointmentPath(id)}/verfahrensbeteiligte/${segment(participantId)}`;

// The review of a draft before it is published, and the page after publishing it.
export const confirmDraftPath = (id: string) => `${appointmentPath(id)}/confirm`;
export const createdPath = (id: string) => `${appointmentPath(id)}/created`;

// Choosing the Termin of an open Terminumfrage, reviewing the choice, and the page after it.
export const selectPath = (id: string, search?: string) =>
  withSearch(`${appointmentPath(id)}/select`, search);
export const confirmSelectionPath = (id: string, search: string) =>
  withSearch(`${appointmentPath(id)}/select/confirm`, search);
export const selectedPath = (id: string) => `${appointmentPath(id)}/selected`;

// The survey a guest answers, and its pages.
export const surveyPath = (token: string, search?: string) =>
  withSearch(`/umfrage/${segment(token)}`, search);
export const smallerWindowPagePath = (token: string, search: string) =>
  withSearch(`${surveyPath(token)}/zeitfenster`, search);
export const surveySummaryPath = (token: string, search: string) =>
  withSearch(`${surveyPath(token)}/zusammenfassung`, search);
export const surveyResultPath = (token: string, participantId: string) =>
  `${surveyPath(token)}/naechste-schritte?teilnehmer=${segment(participantId)}`;

// Full URLs, for links that leave the app: copied survey links, e-mails and calendar events.
export const appointmentUrl = (origin: string, id: string) =>
  `${origin}${BASE_PATH}${appointmentPath(id)}`;
export const surveyUrl = (origin: string, token: string) =>
  `${origin}${BASE_PATH}${surveyPath(token)}`;
