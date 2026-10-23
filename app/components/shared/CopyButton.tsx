import { useState } from "react";

import { KernButton } from "./kern/KernButton";
import { KernIcon } from "./kern/KernIcon";
import { KernLabel } from "./kern/KernLabel";

export type CopyButtonProps = {
  text: string;
  label: string;
  copiedLabel: string;
  // Read out by screen readers once the text is on the clipboard.
  announcement: string;
  className?: string;
};

export function CopyButton({
  text,
  label,
  copiedLabel,
  announcement,
  className,
}: Readonly<CopyButtonProps>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <KernButton type="button" style="secondary" className={className} onClick={copy}>
        <KernIcon name={copied ? "check" : "content-copy"} size={className ? "small" : "default"} />
        <KernLabel>{copied ? copiedLabel : label}</KernLabel>
      </KernButton>
      <output className="kern-sr-only">{copied ? announcement : ""}</output>
    </>
  );
}
