import { CopyLinkButton } from "./CopyLinkButton";
import { KernLabel } from "./kern/KernLabel";

import "./SurveyLinkField.css";

// The link contains a full UUID and is long, so it wraps inside a read-only textarea instead of
// overflowing. A textarea can be focused, so copying by hand works by keyboard and without JavaScript.
export function SurveyLinkField({ id, url }: Readonly<{ id: string; url: string }>) {
  const hintId = `${id}-hint`;
  return (
    <div className="survey-link-field">
      <KernLabel htmlFor={id}>Link zur Terminumfrage</KernLabel>
      <textarea
        id={id}
        className="kern-form-input__input survey-link-field__input"
        readOnly
        rows={3}
        spellCheck={false}
        autoComplete="off"
        aria-describedby={hintId}
        value={url}
      />
      <p className="kern-hint" id={hintId}>
        Klicken Sie in das Feld, markieren Sie alles mit Strg+A und kopieren Sie den Link mit Strg+C
        (Mac: Cmd+A und Cmd+C).
      </p>
      <CopyLinkButton url={url} className="kern-btn--small" />
    </div>
  );
}
