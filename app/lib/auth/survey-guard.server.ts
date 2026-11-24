import { findSurvey } from "../../adapters/appointments/survey.server.ts";
import { getDb } from "../../database/database.ts";
import { notFound } from "../web/responses.ts";

// The survey a guest's link points to. Only an open survey can be answered, and unknown links look
// the same as closed ones.
export async function requireSurvey(params: { token?: string }) {
  const token = params.token ?? "";
  const survey = await findSurvey(getDb(), token);
  if (!survey) throw notFound();
  return { token, survey };
}
