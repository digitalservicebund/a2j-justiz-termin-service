export function TextLabel({
  size,
  label = "",
}: Readonly<{
  size?: "large" | "small";
  label: string;
}>) {
  const sizeModifier = size ? `kern-label--${size}` : "";
  return <p className={`kern-label ${sizeModifier}`}>{label}</p>;
}
