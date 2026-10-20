import type { Generated } from "kysely";

import type { UserRole } from "../core/domain/user.ts";

export type AppointmentStatus = "draft" | "open" | "confirmed" | "cancelled";
export type ResponseStatus = "yes" | "no" | "maybe";
export type LinkType = "individual" | "universal";

export interface AppointmentsTable {
  id: Generated<string>;
  judge_id: string; // Foreign key referencing better-auth "user.id"
  title: string;
  description: string | null;
  court_room: string | null;
  status: AppointmentStatus;
  universal_token: string | null;
  confirmed_slot_id: string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface TimeSlotsTable {
  id: Generated<string>;
  appointment_id: string;
  start_time: Date | string;
  end_time: Date | string | null;
  created_at: Generated<Date>;
}

export interface ParticipantsTable {
  id: Generated<string>;
  appointment_id: string;
  name: string;
  email: string | null;
  role: string | null;
  type: LinkType;
  token: string | null;
  last_accessed_at: Date | string | null;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

export interface ParticipantResponsesTable {
  id: Generated<string>;
  participant_id: string;
  slot_id: string;
  status: ResponseStatus;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}

type Timestamps = {
  createdAt: Generated<Date>;
  updatedAt: Date;
};

type DefaultTimestamps = {
  createdAt: Generated<Date>;
  updatedAt: Generated<Date>;
};

export type UserTable = DefaultTimestamps & {
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
  appointments: AppointmentsTable;
  time_slots: TimeSlotsTable;
  participants: ParticipantsTable;
  participant_responses: ParticipantResponsesTable;
};
