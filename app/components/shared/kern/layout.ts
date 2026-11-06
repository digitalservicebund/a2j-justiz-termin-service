import "./layout.css";

// The spacing steps of KERN's helper classes (kern-gap-*, kern-m-*, kern-p-*). They stop at
// "xl"; larger spaces have no helper and stay in a component's own CSS.
export type Space = "none" | "xxs" | "xs" | "sm" | "md" | "lg" | "xl";

export type Align = "start" | "center" | "end" | "stretch" | "baseline";
export type Justify = "start" | "center" | "end" | "between";

export function classNames(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(" ");
}

// Lists and fieldsets come with bullets, margins, padding and a border of the browser's own.
const resetClasses = (element: string) =>
  element === "ul" || element === "ol" || element === "fieldset"
    ? "kern-m-none kern-p-none layout-reset"
    : "";

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
