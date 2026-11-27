// The names and texts of the forms where a judge picks a court. Kept apart from the code list, so
// pages can use them without loading it into the browser.

export const COURT_FIELD = "courtCode";
// The checkbox that also saves the picked court as the judge's default.
export const SAVE_AS_DEFAULT_FIELD = "saveAsDefault";

export const courtMessages = {
  required: "Wählen Sie ein Gericht aus.",
  invalid: "Wählen Sie ein Gericht aus der Liste aus.",
};
