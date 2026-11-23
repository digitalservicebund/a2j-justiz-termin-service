import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/welcome/welcome.tsx"),
  route("overview", "routes/overview/overview.tsx"),
  route("kalender-abonnieren", "routes/calendar/subscribe.tsx"),
  route("overview/new", "routes/draft/draft.tsx"),
  route("overview/:appointmentId", "routes/overview/detail.tsx"),
  route("overview/:appointmentId/select", "routes/overview/select.tsx"),
  route("overview/:appointmentId/select/confirm", "routes/overview/select.confirm.tsx"),
  route("overview/:appointmentId/selected", "routes/overview/selected.tsx"),
  route("overview/:appointmentId/zeitfenster/:slotId", "routes/draft/slot.tsx"),
  route(
    "overview/:appointmentId/verfahrensbeteiligte/:participantId",
    "routes/draft/participant.tsx",
  ),
  route("overview/:appointmentId/confirm", "routes/draft/confirm.tsx"),
  route("overview/:appointmentId/created", "routes/draft/created.tsx"),
  route("umfrage/:token", "routes/survey/survey.tsx"),
  route("umfrage/:token/zeitfenster", "routes/survey/window.tsx"),
  route("umfrage/:token/zusammenfassung", "routes/survey/confirm.tsx"),
  route("umfrage/:token/naechste-schritte", "routes/survey/result.tsx"),
  route("admin/users", "routes/admin/users.tsx"),
  route("admin/domains", "routes/admin/domains.tsx"),
  route("api/auth/*", "routes/auth.ts"),

  route("health", "routes/health/health.ts"),
  route("health/database", "routes/health/database.ts"),
  route("health/smtp", "routes/health/smtp.ts"),
  route("health/rabbitmq", "routes/health/rabbitmq.ts"),
  route("api/calendars/:token/feed.ics", "routes/calendar/feed.ts"),
] satisfies RouteConfig;
