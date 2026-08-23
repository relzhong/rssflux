import minifluxAPI from "@/api/miniflux";
import { unsubscribeModalOpen, currentFeedId } from "@/stores/modalStore.js";
import { useStore } from "@nanostores/react";
import { useNavigate, useParams } from "react-router-dom";
import { feeds } from "@/stores/feedsStore";
import CustomAlertDialog from "@/components/ui/CustomAlertDialog.jsx";
import { useTranslation } from "react-i18next";
import {
  deleteArticlesByFeedId,
  deleteFeed,
  deleteFeedIcon,
} from "@/db/storage";
import { starredCounts, unreadCounts } from "@/stores/feedsStore";

export default function UnsubscribeModal() {
  const { t } = useTranslation();
  const $feeds = useStore(feeds);
  const { feedId: routeFeedId } = useParams();
  const $unsubscribeModalOpen = useStore(unsubscribeModalOpen);
  const $currentFeedId = useStore(currentFeedId);
  // 优先使用 store 中的 feedId，如果没有则使用路由参数中的 feedId
  const feedId = $currentFeedId || routeFeedId;
  const navigate = useNavigate();

  const feedTitle = feedId
    ? $feeds.find((f) => f.id === parseInt(feedId))?.title
    : "";

  const onClose = () => {
    unsubscribeModalOpen.set(false);
    currentFeedId.set(null); // 清除 store 中的 feedId
  };

  const handleUnsubscribe = async () => {
    if (!feedId) return;
    try {
      const feedIdInt = parseInt(feedId);
      // 从服务器删除订阅源
      await minifluxAPI.deleteFeed(feedId);
      // 从本地数据库删除相关数据
      await Promise.all([
        deleteArticlesByFeedId(feedIdInt),
        deleteFeed(feedIdInt),
        deleteFeedIcon(feedIdInt),
      ]);
      // 更新本地状态
      feeds.set($feeds.filter((feed) => feed.id !== feedIdInt));
      unreadCounts.set({
        ...unreadCounts.get(),
        [feedIdInt]: 0,
      });
      starredCounts.set({
        ...starredCounts.get(),
        [feedIdInt]: 0,
      });

      // onClose(); // 关闭模态框并清除 feedId
      navigate("/"); // 取消订阅后返回首页
    } catch (error) {
      console.error("取消订阅失败:", error);
    }
  };

  return (
    <CustomAlertDialog
      title={t("articleList.unsubscribe")}
      content={`${t("articleList.unsubscribeDescription")}「${feedTitle}」`}
      isOpen={$unsubscribeModalOpen}
      onConfirm={handleUnsubscribe}
      onClose={onClose}
      confirmText={t("common.confirm")}
      cancelText={t("common.cancel")}
    />
  );
}
