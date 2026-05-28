export type BadgeType = "success" | "info" | "warning" | "danger";

export function Badge({
  type,
  label,
  icon,
}: Readonly<{ type: BadgeType; label: string; icon?: string }>) {
  return (
    <span className={`kern-badge kern-badge--${type}`}>
      {icon && (
        <span
          className={`kern-icon kern-icon--${icon} kern-icon--small`}
          aria-hidden="true"
        />
      )}
      <span className="kern-label">{label}</span>
    </span>
  );
}
