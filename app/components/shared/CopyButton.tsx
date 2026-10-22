import { useState } from "react";

import { Button } from "./Button";
import { Icon } from "./Icon";

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
      <Button type="button" style="secondary" className={className} onClick={copy}>
        <Icon name={copied ? "check" : "content-copy"} size={className ? "small" : "default"} />
        <span className="kern-label">{copied ? copiedLabel : label}</span>
      </Button>
      <output className="kern-sr-only">{copied ? announcement : ""}</output>
    </>
  );
}
