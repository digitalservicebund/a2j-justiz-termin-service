import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome.tsx"),
  route("home", "routes/home.tsx"),
  route("overview", "routes/overview.tsx"),
  route("overview/new", "routes/create-termin.tsx"),
  route("overview/:appointmentId", "routes/overview.detail.tsx"),
  route("overview/:appointmentId/select", "routes/overview.select.tsx"),
  route("overview/:appointmentId/select/confirm", "routes/overview.select.confirm.tsx"),
  route("overview/:appointmentId/selected", "routes/overview.selected.tsx"),
  route("overview/:appointmentId/confirm", "routes/create-termin.confirm.tsx"),
  route("overview/:appointmentId/created", "routes/create-termin.created.tsx"),
  route("admin/users", "routes/admin-users.tsx"),
  route("api/auth/*", "routes/auth.ts"),

  route("health", "routes/health.ts"),
  route("health/database", "routes/database-health.ts"),
  route("health/smtp", "routes/smtp-health.ts"),
  route("api/calendars/:calendarId/feed.ics", "routes/calendar.ts"),
] satisfies RouteConfig;
