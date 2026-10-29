import type { AnchorHTMLAttributes } from "react";

type LinkSize = "default" | "small";

export type KernLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  size?: LinkSize;
};

// A link styled as a KERN link. Pass a KernIcon as child, before or after the text.
export function KernLink({
  size = "default",
  className,
  children,
  ...anchorProps
}: Readonly<KernLinkProps>) {
  const classes = ["kern-link", size === "small" && "kern-link--small", className]
    .filter(Boolean)
    .join(" ");

  return (
    <a className={classes} {...anchorProps}>
      {children}
    </a>
  );
}
