import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("home", "routes/home.tsx"),
  route("overview", "routes/overview.tsx"),
  route("overview/new", "routes/create-termin.tsx"),
  route("admin/users", "routes/admin-users.tsx"),
  route("api/auth/*", "routes/auth.ts"),

  route("health", "routes/health.ts"),
  route("health/database", "routes/database-health.ts"),
  route("health/smtp", "routes/smtp-health.ts"),
  route("api/calendars/:calendarId/feed.ics", "routes/calendar.ts"),
] satisfies RouteConfig;
