import type { ComponentType } from "react";
import { BarChart3, Home, ListChecks, MoreHorizontal, ShieldCheck, Upload, Users, type LucideIcon } from "lucide-react";

export interface NavIconProps {
  active: boolean;
}

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<NavIconProps>;
}

/** Lucide icon at the product's nav size: 16px, 1.75 stroke. */
function navIcon(Icon: LucideIcon): ComponentType<NavIconProps> {
  const NavIcon = ({ active }: NavIconProps) => (
    <Icon size={16} strokeWidth={1.75} aria-hidden className={active ? "text-fg" : "text-muted"} />
  );
  NavIcon.displayName = `NavIcon(${Icon.displayName ?? "icon"})`;
  return NavIcon;
}

const HomeIcon = navIcon(Home);
const LibraryIcon = navIcon(Users);
const ListIcon = navIcon(ListChecks);
const ChartIcon = navIcon(BarChart3);
const ImportIcon = navIcon(Upload);
const AdminIcon = navIcon(ShieldCheck);
export const MoreIcon = navIcon(MoreHorizontal);

export const appNav: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: HomeIcon },
  { href: "/channels", label: "Creators", icon: LibraryIcon },
  { href: "/campaigns", label: "Campaigns", icon: ListIcon },
  { href: "/analytics", label: "Insights", icon: ChartIcon },
];

export const mobilePrimaryNav = [
  appNav.find((n) => n.href === "/dashboard")!,
  appNav.find((n) => n.href === "/channels")!,
  appNav.find((n) => n.href === "/campaigns")!,
];

export const mobileMoreNav: NavItem[] = [
  appNav.find((n) => n.href === "/analytics")!,
  { href: "/import", label: "Import", icon: ImportIcon },
  { href: "/admin", label: "Admin", icon: AdminIcon },
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

export function adminNavItem(): NavItem {
  return { href: "/admin", label: "Admin", icon: AdminIcon };
}

export function sidebarNavItems(options?: { includeAdmin?: boolean }): NavItem[] {
  return options?.includeAdmin ? [...appNav, adminNavItem()] : appNav;
}
