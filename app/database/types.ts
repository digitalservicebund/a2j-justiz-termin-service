import type { Generated } from "kysely";

import type { UserRole } from "../core/domain/user.ts";

// "draft": user is still working on it
// "open": waiting for other participants to respond
// "confirmed": a given time_slot has been chosen
// "cancelled": no time_slot was possible for all participants
export type AppointmentStatus = "draft" | "open" | "confirmed" | "cancelled";
type ResponseStatus = "yes" | "no" | "maybe";
type LinkType = "individual" | "universal";

type AppointmentsTable = {
  id: Generated<string>;
  user_id: string; // Foreign key referencing better-auth "user.id"
  aktenzeichen: string;
  status: AppointmentStatus;
  universal_token: string | null;
  confirmed_slot_id: string | null;
  // The confirmed window lies within the confirmed slot and may be shorter than it.
  confirmed_start_time: Date | string | null;
  confirmed_end_time: Date | string | null;
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
  name: string;
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
  appointment: AppointmentsTable;
  time_slot: TimeSlotsTable;
  participant: ParticipantsTable;
  participant_response: ParticipantResponsesTable;
};
