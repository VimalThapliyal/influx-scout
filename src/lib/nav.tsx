import type { ComponentType } from "react";

export interface NavIconProps {
  active: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<NavIconProps>;
}

export const appNav: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/channels", label: "Library", icon: LibraryIcon },
  { href: "/campaigns", label: "Campaigns", icon: ListIcon },
  { href: "/analytics", label: "Campaign insights", icon: ChartIcon },
];

export const mobilePrimaryNav = [
  appNav.find((n) => n.href === "/dashboard")!,
  appNav.find((n) => n.href === "/channels")!,
  appNav.find((n) => n.href === "/campaigns")!,
];

export const mobileMoreNav: NavItem[] = [
  appNav.find((n) => n.href === "/analytics")!,
  { href: "/import", label: "Import", icon: ImportIcon },
  { href: "/admin", label: "Admin ops", icon: AdminIcon },
];

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMoreNavActive(pathname: string): boolean {
  return (
    mobileMoreNav.some((item) => isNavActive(pathname, item.href)) ||
    pathname === "/subscribe" ||
    pathname === "/login" ||
    pathname === "/admin" ||
    pathname.startsWith("/admin/")
  );
}

function ImportIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function HomeIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}


function LibraryIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ListIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function ChartIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function AdminIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

export function adminNavItem(): NavItem {
  return { href: "/admin", label: "Admin ops", icon: AdminIcon };
}

export function sidebarNavItems(options?: { includeAdmin?: boolean }): NavItem[] {
  const base = appNav.map((item) => {
    if (item.href === "/channels") {
      return { ...item, label: "Your database" };
    }
    return item;
  });
  if (options?.includeAdmin) {
    return [...base, adminNavItem()];
  }
  return base;
}

export function MoreIcon({ active }: NavIconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#E8A33D" : "currentColor"} strokeWidth="2" aria-hidden>
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
