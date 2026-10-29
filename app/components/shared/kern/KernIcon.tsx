import "./KernIcon.css";

// "add-box", "checklist-rtl" and "event" are not standard KERN icons; they are implemented in JTS
// (see KernIcon.css).
export type KernIconName =
  | "home"
  | "arrow-up"
  | "arrow-down"
  | "arrow-forward"
  | "arrow-back"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "open-in-new"
  | "download"
  | "logout"
  | "checklist"
  | "mail"
  | "edit"
  | "sign-language"
  | "easy-language"
  | "autorenew"
  | "add"
  | "add-box"
  | "checklist-rtl"
  | "event"
  | "close"
  | "delete"
  | "search"
  | "question-mark"
  | "more-vert"
  | "content-copy"
  | "visibility"
  | "visibility-off"
  | "check"
  | "drive-folder-upload"
  | "chevron-left"
  | "chevron-right"
  | "keyboard-double-arrow-left"
  | "keyboard-double-arrow-right"
  | "language"
  | "dehaze"
  | "account-circle"
  | "calendar-today";

type IconSize = "small" | "default" | "large" | "x-large";

export type IconProps = {
  name: KernIconName;
  size?: IconSize;
};

export function KernIcon({ name, size = "default" }: Readonly<IconProps>) {
  return (
    <span className={`kern-icon kern-icon--${name} kern-icon--${size}`} aria-hidden="true"></span>
  );
}
