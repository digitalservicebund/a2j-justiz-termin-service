import { useLoaderData } from "react-router";
import { authService, DEFAULT_CASE_ID, schedulingQuery, schedulingService } from "@/bootstrap";
import type { Decision } from "@/domain/verfahren";
import { requireRole } from "@/infrastructure/session/session";
import { RouteErrorBoundary } from "~/components/shared/schedulingShared";
import { PartyScreen } from "~/components/shared/partyScreen";

export async function loader({ request }: { request: Request }) {
  const user = await requireRole(request, authService, "KLAEGER");
  const overview = schedulingQuery.getOverview(DEFAULT_CASE_ID);
  return { user, overview };
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const decisionMap: Record<string, Decision> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string" && (value === "ACCEPT" || value === "REJECT")) {
      decisionMap[key] = value;
    }
  }

  try {
    schedulingService.partySubmitDecisions(DEFAULT_CASE_ID, "KLAEGER", decisionMap);
    return null;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error during submission." };
  }
}

export function meta() {
  return [{ title: "Klaeger - Court Appointment Scheduling" }];
}

export default function KlaegerRoute() {
  const { user, overview } = useLoaderData<typeof loader>();
  return <PartyScreen role="KLAEGER" overview={overview} user={user} />;
}

export function ErrorBoundary() {
  return <RouteErrorBoundary title="Klaeger - Response" />;
}
