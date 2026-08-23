import { Button, Dropdown, Label } from "@heroui/react";
import { CirclePlus, FolderPlus, Rss, Upload } from "lucide-react";
import { addCategoryModalOpen, addFeedModalOpen } from "@/stores/modalStore";
import { useSidebar } from "@/components/ui/sidebar.jsx";
import { useRef } from "react";
import minifluxAPI from "@/api/miniflux";
import { toast } from "sonner";
import { forceSync } from "@/stores/syncStore";
import { useTranslation } from "react-i18next";

export default function AddFeedButton() {
  const { t } = useTranslation();
  const { isMobile, setOpenMobile } = useSidebar();
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      await minifluxAPI.importOPML(file);
      await forceSync(); // 重新加载订阅源列表以更新UI
      await minifluxAPI.refreshAllFeeds(); // 触发所有订阅源的刷新
      toast.success(t("common.success"));
    } catch (error) {
      console.error("OPML导入失败:", error);
      toast.error(t("common.error"));
    } finally {
      // 清空文件输入框,以便重复选择同一文件
      e.target.value = "";
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".opml,.xml"
        onChange={handleFileChange}
        className="hidden"
      />

      <Dropdown>
        <Button size="sm" variant="ghost" isIconOnly>
          <CirclePlus className="size-4 text-muted" />
        </Button>
        <Dropdown.Popover>
          <Dropdown.Menu
            onAction={(key) => {
              if (key === "newFeed") {
                addFeedModalOpen.set(true);
                isMobile && setOpenMobile(false);
              }
              if (key === "importOPML") {
                fileInputRef.current?.click();
                isMobile && setOpenMobile(false);
              }
              if (key === "newCategory") {
                addCategoryModalOpen.set(true);
                isMobile && setOpenMobile(false);
              }
            }}
          >
            <Dropdown.Item id="newFeed" textValue={t("sidebar.addFeed")}>
              <Rss className="size-4 text-muted" />
              <Label>{t("sidebar.addFeed")}</Label>
            </Dropdown.Item>
            <Dropdown.Item id="importOPML" textValue={t("sidebar.importOPML")}>
              <Upload className="size-4 text-muted" />
              <Label>{t("sidebar.importOPML")}</Label>
            </Dropdown.Item>
            <Dropdown.Item
              id="newCategory"
              textValue={t("sidebar.addCategory")}
            >
              <FolderPlus className="size-4 text-muted" />
              <Label>{t("sidebar.addCategory")}</Label>
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown>
    </>
  );
}
