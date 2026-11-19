import { expect } from "vitest";

import type { PageWidth } from "~/components/shared/DefaultPage";

// The breakpoint columns each page width takes, spelled out so that a change to the spans in
// DefaultPage.tsx fails a test instead of passing unnoticed.
export const pageWidthClasses: Record<PageWidth, string[]> = {
  narrow: ["kern-col-md-11", "kern-col-lg-9", "kern-col-xl-7", "kern-col-xxl-6"],
  content: ["kern-col-lg-10", "kern-col-xl-8", "kern-col-xxl-7"],
  default: ["kern-col-lg-11", "kern-col-xl-9", "kern-col-xxl-8"],
  wide: [],
};

const breakpointColumn = /^kern-col-(sm|md|lg|xl|xxl)-\d+$/;

// The column of a page section, the one that holds the content.
export function pageSectionColumn(root: ParentNode): HTMLElement {
  const column = root.querySelector<HTMLElement>(".page-section > .kern-row > .kern-grid-col");
  expect(column).not.toBeNull();
  return column!;
}

// Asserts the breakpoint columns of an element, and no others.
export function expectBreakpointColumns(element: Element, expected: string[]) {
  const actual = [...element.classList].filter((name) => breakpointColumn.test(name));
  expect(actual.sort()).toEqual([...expected].sort());
  expect(element).toHaveClass("kern-col-12");
}
