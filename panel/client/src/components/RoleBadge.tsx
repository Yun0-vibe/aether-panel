export function RoleBadge({ role }: { role: string }) {
  return <span className={`role-badge role-${role}`}>{role}</span>;
}
