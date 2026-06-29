export function TextBody({
  type,
  body = "",
}: Readonly<{
  type?: "large" | "small" | "bold" | "muted";
  body: string;
}>) {
  const sizeModifier = type ? `kern-body--${type}` : "";
  return <p className={`kern-body ${sizeModifier}`}>{body}</p>;
}
