import { CALENDAR_SUBSCRIBE_PATH, OVERVIEW_PATH } from "~/lib/paths";

import { A2JIcon } from "./a2j/A2JIcon";
import { KernIcon } from "./kern/KernIcon";
import { SideNav } from "./SideNav";

type MainNavProps = {
  // The page the user is on.
  current: "overview" | "calendar";
};

// The sidebar of the signed-in pages. Items without a destination do not navigate yet.
export function MainNav({ current }: Readonly<MainNavProps>) {
  return (
    <SideNav
      label="Bereiche"
      items={[
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
        { label: "Einstellungen", icon: <A2JIcon name="settings" size="large" /> },
      ]}
    />
  );
}
