import "./layout.css";

// The spacing steps of KERN's helper classes (kern-gap-*, kern-m-*, kern-p-*). They stop at
// "xl"; larger spaces have no helper and stay in a component's own CSS.
export type Space = "none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type Justify = "start" | "center" | "end" | "between";

export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

export const gapClasses = (gap?: Space, gapX?: Space, gapY?: Space) => [
  gap && `kern-gap-${gap}`,
  gapX && `kern-gap-x-${gapX}`,
  gapY && `kern-gap-y-${gapY}`,
];

// Lists and fieldsets come with bullets, margins, padding and a border of the browser's own.
export const resetClasses = (element: string) =>
  element === "ul" || element === "ol" || element === "fieldset"
    ? ["kern-m-none kern-p-none", "layout-reset"]
    : [];
