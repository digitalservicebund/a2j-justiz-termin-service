import { surveyPath, surveySearch, type SurveyValues } from "./schema";

// Where an offered window sits on the survey page.
export const offerAnchor = (offerKey: string) => `zeitfenster-${offerKey}`;

// The survey with a draft answer, scrolled to the offered window the guest was working on.
export const draftPath = (token: string, values: SurveyValues, offerKey?: string) =>
  `${surveyPath(token)}?${surveySearch(values)}${offerKey ? `#${offerAnchor(offerKey)}` : ""}`;

// The page to add a smaller window within an offered one, or to change one. It carries the draft,
// so nothing is lost on the way there and back.
export function smallerWindowPath(
  token: string,
  values: SurveyValues,
  offerKey: string,
  windowKey?: string,
) {
  const search = new URLSearchParams(surveySearch(values));
  search.set("angebot", offerKey);
  if (windowKey) search.set("fenster", windowKey);
  return `${surveyPath(token, "/zeitfenster")}?${search}`;
}
