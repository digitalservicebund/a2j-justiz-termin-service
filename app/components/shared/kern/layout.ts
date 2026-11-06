import "./layout.css";

// The spacing steps of KERN's helper classes (kern-gap-*, kern-m-*, kern-p-*). They stop at
// "xl"; larger spaces have no helper and stay in a component's own CSS.
export type Space = "none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

// KERN's breakpoints in px, the min-width of the kern-col-<breakpoint>-* classes. Plain CSS cannot
// read them in a media query, so a rule there repeats the number; layout.test.ts checks that every
// min-width in the app's CSS is one of these.
export const breakpoints = { sm: 576, md: 768, lg: 992, xl: 1200, xxl: 1600 } as const;

export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type Justify = "start" | "center" | "end" | "between";

export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

// Lists and fieldsets come with bullets, margins, padding and a border of the browser's own.
export const resetClassName = "kern-m-none kern-p-none layout-reset";

const resetClasses = (element: string) =>
  element === "ul" || element === "ol" || element === "fieldset" ? resetClassName : "";

// Safari and VoiceOver stop announcing a list once `list-style: none` is set on it. An explicit role
// keeps it a list. A caller can still pass its own `role`, which comes later in the props.
export function listRole(element: string): { role?: "list" } {
  return element === "ul" || element === "ol" ? { role: "list" } : {};
}

export type StackOptions = {
  gap?: Space;
  align?: Align;
};

// The classes of KernStack, for an element that is not a KernStack (a router Form, a KernBody).
export function stackClassName({ gap, align }: StackOptions = {}, element = "div"): string {
  return classNames(
    "kern-flex kern-flex-col",
    gap && `kern-gap-${gap}`,
    align && `kern-align-items-${align}`,
    resetClasses(element),
  );
}

export type ClusterOptions = {
  gap?: Space;
  gapX?: Space;
  gapY?: Space;
  align?: Align;
  justify?: Justify;
  // Children that do not fit move to the next line. Turn it off to keep them in one row.
  wrap?: boolean;
  // A cluster that is part of a line of text instead of a block.
  inline?: boolean;
};

// The classes of KernCluster, for an element that is not a KernCluster.
export function clusterClassName(
  { gap, gapX, gapY, align, justify, wrap = true, inline = false }: ClusterOptions = {},
  element = "div",
): string {
  return classNames(
    inline ? "kern-inline-flex" : "kern-flex",
    wrap && "kern-flex-wrap",
    gap && `kern-gap-${gap}`,
    gapX && `kern-gap-x-${gapX}`,
    gapY && `kern-gap-y-${gapY}`,
    align && `kern-align-items-${align}`,
    justify && `kern-justify-content-${justify}`,
    resetClasses(element),
  );
}
