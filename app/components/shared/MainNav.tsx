import { hasRole, type AuthUser } from "~/core/domain/user";
import { CALENDAR_SUBSCRIBE_PATH, OVERVIEW_PATH, SETTINGS_PATH } from "~/lib/web/paths";

import { A2JIcon } from "./a2j/A2JIcon";
import { KernIcon } from "./kern/KernIcon";
import { SideNav, type SideNavItem } from "./SideNav";

export type MainNavPage = "overview" | "calendar" | "settings";

type MainNavProps = {
  // The page the user is on.
  current: MainNavPage;
  // The settings only exist for judges, and for admins, who may do whatever a judge does.
  user: AuthUser;
};

// The sidebar of the signed-in pages.
export function MainNav({ current, user }: Readonly<MainNavProps>) {
  const items: SideNavItem[] = [
    {
      label: "Übersicht",
      icon: <KernIcon name="home" size="large" />,
      to: OVERVIEW_PATH,
      current: current === "overview",
    },
    {
      label: "Kalender abonnieren",
      icon: <A2JIcon name="calendar-add" size="large" />,
      to: CALENDAR_SUBSCRIBE_PATH,
      current: current === "calendar",
    },
  ];
  if (hasRole(user, "richter")) {
    items.push({
      label: "Einstellungen",
      icon: <A2JIcon name="settings" size="large" />,
      to: SETTINGS_PATH,
      current: current === "settings",
    });
  }
  return <SideNav label="Bereiche" items={items} />;
}
