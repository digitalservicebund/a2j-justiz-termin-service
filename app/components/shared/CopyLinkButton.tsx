import { CopyButton } from "./CopyButton";

export function CopyLinkButton({ url, className }: Readonly<{ url: string; className?: string }>) {
  return (
    <CopyButton
      text={url}
      label="Link zur Terminumfrage kopieren"
      copiedLabel="Link kopiert"
      announcement="Der Link zur Terminumfrage wurde kopiert."
      className={className}
    />
  );
}
