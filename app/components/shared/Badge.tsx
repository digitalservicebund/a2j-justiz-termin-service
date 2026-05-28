export type BadgeType = "success" | "info" | "warning" | "danger" | "neutral";

export function Badge({
  type,
  label,
}: Readonly<{ type: BadgeType; label: string }>) {
  const badgeColour = {
    success: "bg-green-50 text-green-700 inset-ring-green-600/20",
    warning: "bg-yellow-50 text-yellow-800 inset-ring-yellow-600/20",
    danger: "bg-red-50 text-red-700 inset-ring-red-600/10",
    info: "bg-blue-50 text-blue-700 inset-ring-blue-700/10",
    neutral: "bg-gray-50 text-gray-600 inset-ring-gray-500/10",
  }[type];

  return (
    <span
      className={`p-kern-space-x-small inline-flex items-center rounded-md text-xs font-medium inset-ring ${badgeColour}`}
    >
      {label}
    </span>
  );
}
