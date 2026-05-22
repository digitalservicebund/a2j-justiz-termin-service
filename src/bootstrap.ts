import { InMemoryStore } from "./infrastructure/db/inMemoryStore";
import { SchedulingService } from "./domain/schedulingService";
import { SchedulingQuery } from "./application/schedulingQuery";
import type { AppointmentQueries } from "./application/schedulingQuery";
import { InMemoryAuthService } from "./infrastructure/auth/inMemoryAuthService";
import type { AuthService } from "./domain/user";

const store = new InMemoryStore();
const service = new SchedulingService(store);
service.seedCase("verfahren-1", "Case A-2026 - Appointment coordination");

export const schedulingService = service;
export const schedulingQuery: AppointmentQueries = new SchedulingQuery(store);
export const authService: AuthService = new InMemoryAuthService();
export const DEFAULT_CASE_ID = "verfahren-1";
