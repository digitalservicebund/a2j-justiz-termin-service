import { useState } from "react";

import { Button } from "./Button";
import { Icon } from "./Icon";

export function CopyLinkButton({ url, className }: Readonly<{ url: string; className?: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  return (
    <>
      <Button type="button" style="secondary" className={className} onClick={copy}>
        <Icon name={copied ? "check" : "content-copy"} size={className ? "small" : "default"} />
        <span className="kern-label">
          {copied ? "Link kopiert" : "Link zur Terminumfrage kopieren"}
        </span>
      </Button>
      <output className="kern-sr-only">
        {copied ? "Der Link zur Terminumfrage wurde kopiert." : ""}
      </output>
    </>
  );
}
