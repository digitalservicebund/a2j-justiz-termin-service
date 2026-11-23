// The draft page has to work without JavaScript, so every button is a submit button of one form
// and its value says what the user asked for. A button of a table row also carries the row's id,
// as "<command>:<id>". `intent()` writes that value and `parseIntent()` reads it back, so the
// buttons and the action cannot drift apart.

const FORM_COMMANDS = ["next", "cancel", "add-slot", "add-person"] as const;
const ROW_COMMANDS = [
  "edit-slot",
  "copy-slot",
  "delete-slot",
  "edit-person",
  "delete-person",
] as const;

type FormCommand = (typeof FORM_COMMANDS)[number];
type RowCommand = (typeof ROW_COMMANDS)[number];

export type DraftIntent = { command: FormCommand } | { command: RowCommand; id: string };

// The name of the field that the buttons submit their intent in.
export const INTENT = "intent";

const SEPARATOR = ":";

export function intent(value: DraftIntent): string {
  return "id" in value ? `${value.command}${SEPARATOR}${value.id}` : value.command;
}

const isFormCommand = (value: string): value is FormCommand =>
  (FORM_COMMANDS as readonly string[]).includes(value);
const isRowCommand = (value: string): value is RowCommand =>
  (ROW_COMMANDS as readonly string[]).includes(value);

// Returns undefined for anything a button of the page cannot have sent: an unknown command, a row
// command without an id, or a form command with one.
export function parseIntent(value: FormDataEntryValue | null): DraftIntent | undefined {
  if (typeof value !== "string") return undefined;
  const separator = value.indexOf(SEPARATOR);
  if (separator === -1) return isFormCommand(value) ? { command: value } : undefined;

  const command = value.slice(0, separator);
  const id = value.slice(separator + SEPARATOR.length);
  return isRowCommand(command) && id !== "" ? { command, id } : undefined;
}
