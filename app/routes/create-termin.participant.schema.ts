import { z } from "zod";

import type { ParticipantInput } from "~/adapters/appointments/participants.server";

export const MAX_PARTICIPANTS = 20;
const MAX_EMAIL_LENGTH = 254;
const MAX_NAME_LENGTH = 100;

export const participantMessages = {
  emailRequired: "Geben Sie eine E-Mail-Adresse an.",
  emailInvalid: "Geben Sie eine gültige E-Mail-Adresse an.",
  emailTooLong: `Die E-Mail-Adresse darf höchstens ${MAX_EMAIL_LENGTH} Zeichen lang sein.`,
  nameTooLong: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`,
  tooManyParticipants: `Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`,
};

export type ParticipantFields = { email: string; name: string };
export type ParticipantErrors = { email?: string; name?: string };

export const emptyParticipant: ParticipantFields = { email: "", name: "" };

export function parseParticipantForm(form: FormData): ParticipantFields {
  const read = (field: keyof ParticipantFields) => {
    const value = form.get(field);
    return typeof value === "string" ? value : "";
  };
  return { email: read("email"), name: read("name") };
}

// A person needs an e-mail address or, without one, a name. Several people may share an address or
// a name, so nothing is compared with the others. Addresses are stored in lower case.
export function validateParticipant(
  fields: ParticipantFields,
): { success: true; value: ParticipantInput } | { success: false; errors: ParticipantErrors } {
  const email = fields.email.trim().toLowerCase();
  const name = fields.name.trim();
  const errors: ParticipantErrors = {};

  if (email === "" && name === "") errors.email = participantMessages.emailRequired;
  else if (email.length > MAX_EMAIL_LENGTH) errors.email = participantMessages.emailTooLong;
  else if (email !== "" && !z.email().safeParse(email).success) {
    errors.email = participantMessages.emailInvalid;
  }
  if (name.length > MAX_NAME_LENGTH) errors.name = participantMessages.nameTooLong;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return { success: true, value: { email: email || null, name: name || null } };
}
