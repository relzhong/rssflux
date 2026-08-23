import { Button, Dropdown, Label } from "@heroui/react";
import {
  ChevronsUpDown,
  Cog,
  LogOut,
  CircleUser,
} from "lucide-react";
import { authState } from "@/stores/authStore.js";
import { settingsModalOpen } from "@/stores/modalStore.js";
import {
  logoutModalOpen,
} from "@/stores/modalStore.js";
import { useSidebar } from "@/components/ui/sidebar.jsx";
import { useTranslation } from "react-i18next";

export default function ProfileButton() {
  const { t } = useTranslation();
  const { username } = authState.get();
  const { isMobile, setOpenMobile } = useSidebar();

  return (
    <div className="profile-button standalone:pb-safe flex items-center gap-4">
      <Dropdown>
        <Button size="sm" variant="ghost" className="h-auto py-2 px-3 w-full">
          <div className="flex items-center w-full gap-2">
            <CircleUser className="size-4 text-muted" />
            <div className="flex flex-col items-start flex-1 min-w-0">
              <div className="font-semibold truncate">{username}</div>
            </div>
            <ChevronsUpDown className="size-4 text-muted" />
          </div>
        </Button>

        <Dropdown.Popover placement="top left">
          <Dropdown.Menu
            aria-label="Profile Actions"
            onAction={(key) => {
              if (key === "settings") {
                settingsModalOpen.set(true);
                isMobile && setOpenMobile(false);
              }
              if (key === "logout") {
                logoutModalOpen.set(true);
                isMobile && setOpenMobile(false);
              }
            }}
          >
            <Dropdown.Item id="settings" textValue="settings">
              <Cog className="size-4 text-muted" />
              <Label>{t("sidebar.profile.settings")}</Label>
            </Dropdown.Item>

            <Dropdown.Item id="logout" textValue="logout" variant="danger">
              <LogOut className="size-4 text-danger" />
              <Label>{t("sidebar.profile.logout")}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </div>
  );
}
