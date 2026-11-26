type NamedParticipant = { name: string; email: string | null; safeId: string | null };

// The name the judge gave a participant, or null. Where the judge gave none, the stored name falls
// back to the e-mail address or the SAFE-ID, which are no name to address someone by.
export const givenName = ({ name, email, safeId }: NamedParticipant): string | null =>
  name === email || name === safeId ? null : name;
