import { z } from "zod";

import type { ParticipantInput } from "~/adapters/appointments/participants.server";

export const MAX_PARTICIPANTS = 20;
const MAX_EMAIL_LENGTH = 254;
const MAX_SAFE_ID_LENGTH = 255;
const MAX_NAME_LENGTH = 100;

export const participantMessages = {
  emailRequired: "Geben Sie eine E-Mail-Adresse oder eine SAFE-ID an.",
  emailInvalid: "Geben Sie eine gültige E-Mail-Adresse an.",
  emailTooLong: `Die E-Mail-Adresse darf höchstens ${MAX_EMAIL_LENGTH} Zeichen lang sein.`,
  safeIdTooLong: `Die SAFE-ID darf höchstens ${MAX_SAFE_ID_LENGTH} Zeichen lang sein.`,
  nameTooLong: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.`,
  tooManyParticipants: `Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`,
};

export type ParticipantFields = { email: string; safeId: string; name: string };
export type ParticipantErrors = { email?: string; safeId?: string; name?: string };

export const emptyParticipant: ParticipantFields = { email: "", safeId: "", name: "" };

export function parseParticipantForm(form: FormData): ParticipantFields {
  const read = (field: keyof ParticipantFields) => {
    const value = form.get(field);
    return typeof value === "string" ? value : "";
  };
  return { email: read("email"), safeId: read("safeId"), name: read("name") };
}

// A person needs an e-mail address, a SAFE-ID or, without either, a name. Several people may share
// an address, a SAFE-ID or a name, so nothing is compared with the others. Addresses are stored in
// lower case. A SAFE-ID is kept as entered, apart from surrounding spaces: its format is not checked.
export function validateParticipant(
  fields: ParticipantFields,
): { success: true; value: ParticipantInput } | { success: false; errors: ParticipantErrors } {
  const email = fields.email.trim().toLowerCase();
  const safeId = fields.safeId.trim();
  const name = fields.name.trim();
  const errors: ParticipantErrors = {};

  if (email === "" && safeId === "" && name === "")
    errors.email = participantMessages.emailRequired;
  else if (email.length > MAX_EMAIL_LENGTH) errors.email = participantMessages.emailTooLong;
  else if (email !== "" && !z.email().safeParse(email).success) {
    errors.email = participantMessages.emailInvalid;
  }
  if (safeId.length > MAX_SAFE_ID_LENGTH) errors.safeId = participantMessages.safeIdTooLong;
  if (name.length > MAX_NAME_LENGTH) errors.name = participantMessages.nameTooLong;

  if (Object.keys(errors).length > 0) return { success: false, errors };
  return {
    success: true,
    value: { email: email || null, safeId: safeId || null, name: name || null },
  };
}
