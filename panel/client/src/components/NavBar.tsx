import React from "react";

export function RoleBadge({ role }: { role: string }) {
  return (
    <span className={`role-badge ${role === "admin" ? "role-admin" : "role-user"}`}>
      {role}
    </span>
  );
}

export function NavBar() {
  return null; // Shell now uses Sidebar + TopBar
}
