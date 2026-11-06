import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  breakpoints,
  classNames,
  clusterClassName,
  stackClassName,
} from "~/components/shared/kern/layout";

describe("classNames", () => {
  it("joins the names and skips the empty ones", () => {
    expect(classNames("a", false, undefined, null, "", "b")).toBe("a b");
  });
});

describe("stackClassName", () => {
  it("is a column without gap or alignment by default", () => {
    expect(stackClassName()).toBe("kern-flex kern-flex-col");
  });

  it("maps the options to KERN's helper classes", () => {
    expect(stackClassName({ gap: "xl", align: "end" })).toBe(
      "kern-flex kern-flex-col kern-gap-xl kern-align-items-end",
    );
  });

  it("resets lists and fieldsets", () => {
    for (const element of ["ul", "ol", "fieldset"]) {
      expect(stackClassName({}, element)).toContain("layout-reset");
    }
    expect(stackClassName({}, "div")).not.toContain("layout-reset");
  });
});

describe("clusterClassName", () => {
  it("is a wrapping row by default", () => {
    expect(clusterClassName()).toBe("kern-flex kern-flex-wrap");
  });

  it("does not wrap on request", () => {
    expect(clusterClassName({ wrap: false })).toBe("kern-flex");
  });

  it("can sit in a line of text", () => {
    expect(clusterClassName({ inline: true, wrap: false })).toBe("kern-inline-flex");
  });

  it("maps every option to KERN's helper classes", () => {
    expect(
      clusterClassName({
        gap: "sm",
        gapX: "xl",
        gapY: "none",
        align: "baseline",
        justify: "between",
      }),
    ).toBe(
      "kern-flex kern-flex-wrap kern-gap-sm kern-gap-x-xl kern-gap-y-none kern-align-items-baseline kern-justify-content-between",
    );
  });

  it("resets lists and fieldsets", () => {
    expect(clusterClassName({}, "ul")).toContain("kern-m-none kern-p-none layout-reset");
  });
});

describe("breakpoints", () => {
  const appDirectory = join(process.cwd(), "app");
  const sheets = readdirSync(appDirectory, { recursive: true, encoding: "utf8" })
    .filter((file) => file.endsWith(".css"))
    .map((file) => [file, readFileSync(join(appDirectory, file), "utf8")] as const);

  it("covers every min-width media query in the app's own CSS", () => {
    const known = new Set<number>(Object.values(breakpoints));
    const used = sheets.flatMap(([file, css]) =>
      [...css.matchAll(/min-width:\s*(\d+)px/g)].map((match) => ({
        file,
        width: Number(match[1]),
      })),
    );

    expect(used.length).toBeGreaterThan(0);
    expect(used.filter(({ width }) => !known.has(width))).toEqual([]);
  });
});
