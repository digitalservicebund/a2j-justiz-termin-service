import { InMemoryAuthService } from "./adapters/inMemory/inMemoryAuthService";
import { InMemoryStore } from "./adapters/inMemory/inMemoryStore";
import type { AuthService } from "./core/domain/user";
import type { AppointmentQueries } from "./core/services/schedulingQuery";
import { SchedulingQuery } from "./core/services/schedulingQuery";
import { SchedulingService } from "./core/services/schedulingService";

const store = new InMemoryStore();
const service = new SchedulingService(store);
service.seedCase("verfahren-1", "Case A-2026 - Appointment coordination");

export const schedulingService = service;
export const schedulingQuery: AppointmentQueries = new SchedulingQuery(store);
export const authService: AuthService = new InMemoryAuthService();
export const DEFAULT_CASE_ID = "verfahren-1";
