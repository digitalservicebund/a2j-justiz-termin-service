// Where the steps of creating a Terminumfrage live. "neu" stands for a time slot that does not exist yet.
export const NEW_SLOT = "neu";

export const draftHref = (id: string) => `/overview/new?entwurf=${encodeURIComponent(id)}`;

// A new slot can start as a copy of an existing one.
export const slotHref = (id: string, slotId: string, copyOf?: string) =>
  `/overview/${encodeURIComponent(id)}/zeitfenster/${encodeURIComponent(slotId)}${
    copyOf ? `?kopie=${encodeURIComponent(copyOf)}` : ""
  }`;
