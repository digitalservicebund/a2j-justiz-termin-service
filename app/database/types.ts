import type { Generated } from "kysely";

import type { UserRole } from "../core/domain/user.ts";

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
  emailVerified: Generated<boolean>;
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
};
