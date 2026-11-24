import { getAuth } from "~/lib/auth/auth.server";

export function loader({ request }: { request: Request }) {
  return getAuth().handler(request);
}

export function action({ request }: { request: Request }) {
  return getAuth().handler(request);
}
