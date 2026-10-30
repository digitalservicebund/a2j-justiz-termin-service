import "./A2JIcon.css";

// Icons from the Figma design that KERN does not have. Like KernIcon, but for A2J's own icons.
export type A2JIconName =
  | "add-box"
  | "calendar-add"
  | "checklist-rtl"
  | "event"
  | "remove-circle"
  | "settings";

type IconSize = "small" | "default" | "large" | "x-large";

export type A2JIconProps = {
  name: A2JIconName;
  size?: IconSize;
};

export function A2JIcon({ name, size = "default" }: Readonly<A2JIconProps>) {
  return (
    <span
      className={`kern-icon kern-icon--${size} a2j-icon a2j-icon--${name}`}
      aria-hidden="true"
    ></span>
  );
}
