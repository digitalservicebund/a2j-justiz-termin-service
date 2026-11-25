import type { Generated } from "kysely";

import type { InvitationStatus } from "../core/domain/invitation.ts";
import type { UserRole } from "../core/domain/user.ts";

// "draft": user is still working on it
// "open": waiting for other participants to respond
// "confirmed": a given time_slot has been chosen
// "cancelled": no time_slot was possible for all participants
export type AppointmentStatus = "draft" | "open" | "confirmed" | "cancelled";
// "yes": available in the windows of the response, which lie within the slot
// "no": not available at any time in the slot
type ResponseStatus = "yes" | "no";
type LinkType = "individual" | "universal";

type AppointmentsTable = {
  id: Generated<string>;
  user_id: string; // Foreign key referencing better-auth "user.id"
  aktenzeichen: string;
  status: AppointmentStatus;
  universal_token: string | null;
  // The shortest a proposed time slot may be. Empty until the judge enters it.
  min_duration_minutes: number | null;
  confirmed_slot_id: string | null;
  // The confirmed window lies within the confirmed slot and may be shorter than it.
  confirmed_start_time: Date | string | null;
  confirmed_end_time: Date | string | null;
  // Raised every time a calendar file is issued for the appointment.
  calendar_sequence: Generated<number>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

type TimeSlotsTable = {
  id: Generated<string>;
  appointment_id: string;
  start_time: Date | string;
  end_time: Date | string | null;
  created_at: Generated<Date>;
};

type ParticipantsTable = {
  id: Generated<string>;
  appointment_id: string;
  // A person has at least one of a name, an e-mail address and a SAFE-ID. Select participantName to
  // read "the name".
  name: string | null;
  email: string | null;
  safe_id: string | null;
  type: LinkType;
  token: string | null;
  last_accessed_at: Date | string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

type ParticipantResponsesTable = {
  id: Generated<string>;
  participant_id: string;
  slot_id: string;
  status: ResponseStatus;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

type ParticipantResponseWindowsTable = {
  id: Generated<string>;
  response_id: string;
  start_time: Date | string;
  end_time: Date | string;
  created_at: Generated<Date>;
};

// "email": mailed by the app
// "erv": sent through the electronic legal transport to the SAFE-ID
// "manual": the judge invited the person outside the app and recorded it
export type InvitationChannel = "email" | "erv" | "manual";

type ParticipantInvitationsTable = {
  id: Generated<string>;
  participant_id: string;
  channel: InvitationChannel;
  // Only an ERV invitation is pending until the reply of the Basisdienst: ERV Versand arrives.
  status: Generated<InvitationStatus>;
  // Ties an ERV invitation to the reply. Null for the other channels.
  correlation_id: string | null;
  // The problem type of the reply of an ERV invitation that was not delivered.
  failure: string | null;
  created_at: Generated<Date>;
};

// A regular court day of a judge. The times are Berlin wall-clock times without a date, which
// Postgres returns as "HH:MM:SS". Read them with fromSqlTime().
type SitzungstagTable = {
  id: Generated<string>;
  user_id: string;
  // ISO weekday, 1 (Monday) to 5 (Friday).
  weekday: number;
  start_time: string;
  end_time: string;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
};

type Timestamps = {
  createdAt: Generated<Date>;
  updatedAt: Date;
};

type DefaultTimestamps = {
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

type UserTable = DefaultTimestamps & {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  roles: UserRole[];
  // The secret in the URL of the user's calendar feed. The database generates it.
  calendar_token: Generated<string>;
};

export type Database = {
  user: UserTable;
  session: Timestamps & {
    id: string;
    userId: string;
    token: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
  };
  account: Timestamps & {
    id: string;
    userId: string;
    accountId: string;
    providerId: string;
    accessToken: string | null;
    refreshToken: string | null;
    idToken: string | null;
    accessTokenExpiresAt: Date | null;
    refreshTokenExpiresAt: Date | null;
    scope: string | null;
    password: string | null;
  };
  verification: DefaultTimestamps & {
    id: string;
    identifier: string;
    value: string;
    expiresAt: Date;
  };
  allowed_domain: {
    domain: string;
    created_at: Generated<Date>;
  };
  appointment: AppointmentsTable;
  time_slot: TimeSlotsTable;
  participant: ParticipantsTable;
  participant_response: ParticipantResponsesTable;
  participant_response_window: ParticipantResponseWindowsTable;
  participant_invitation: ParticipantInvitationsTable;
  sitzungstag: SitzungstagTable;
};
