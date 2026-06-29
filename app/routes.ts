import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("login", "routes/login.tsx"),
  route("logout", "routes/logout.tsx"),
  route("richter", "routes/richter.tsx"),
  route("klaeger", "routes/klaeger.tsx"),
  route("beklagter", "routes/beklagter.tsx"),
] satisfies RouteConfig;
