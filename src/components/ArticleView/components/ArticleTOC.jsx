import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils.js";
import { useTranslation } from "react-i18next";

// 准确计算元素相对于可滚动容器的静态相对顶部偏移
function getElementOffsetTop(el, container) {
  let top = 0;
  let current = el;
  while (current && current !== container && current !== document.body) {
    top += current.offsetTop || 0;
    current = current.offsetParent;
  }
  return top;
}

export default function ArticleTOC({
  scrollContainerRef,
  contentContainerRef,
  articleId,
  content,
}) {
  const { t } = useTranslation();
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState("");
  const [overallProgress, setOverallProgress] = useState(0);
  const [sectionProgresses, setSectionProgresses] = useState({});
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const hoverTimerRef = useRef(null);
  const containerRef = useRef(null);

  // 1. 扫描正文并提取所有标题
  const extractHeadings = useCallback(() => {
    // 优先从 contentContainerRef 提取，如果没有则在 document 内扫描 article-content
    const container =
      contentContainerRef?.current ||
      document.querySelector(".article-content") ||
      document.querySelector(".article-view-content");

    if (!container) {
      return;
    }

    const elements = Array.from(container.querySelectorAll("h1, h2, h3, h4"));

    if (elements.length === 0) {
      setHeadings([]);
      return;
    }

    const items = elements.map((el, index) => {
      let id = el.id;
      if (!id) {
        id = `article-toc-heading-${index}`;
        el.id = id;
      }
      const level = parseInt(el.tagName.replace(/^H/i, ""), 10) || 2;
      const text = el.innerText?.trim() || `Section ${index + 1}`;
      return {
        id,
        text,
        level,
        el,
      };
    });

    setHeadings(items);
  }, [contentContainerRef]);

  // 2. 深度监听文章变化与 DOM 渲染完成
  useEffect(() => {
    extractHeadings();

    // 延时重试，防止异步渲染和 Framer Motion 动画导致的延迟挂载
    const t1 = setTimeout(extractHeadings, 100);
    const t2 = setTimeout(extractHeadings, 300);
    const t3 = setTimeout(extractHeadings, 600);

    // MutationObserver 监听正文内容插入
    let observer = null;
    const targetNode =
      contentContainerRef?.current ||
      document.querySelector(".article-content") ||
      document.querySelector(".article-view-content");

    if (targetNode) {
      observer = new MutationObserver(() => {
        extractHeadings();
      });
      observer.observe(targetNode, {
        childList: true,
        subtree: true,
      });
    }

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      observer?.disconnect();
    };
  }, [articleId, content, extractHeadings, contentContainerRef]);

  // 3. 监听滚动并准确计算各章节进度与回滚
  const handleScroll = useCallback(() => {
    const scrollEl =
      scrollContainerRef?.current ||
      document.querySelector(".article-scroll-area");
    if (!scrollEl || headings.length === 0) return;

    const scrollTop = scrollEl.scrollTop;
    const scrollHeight = scrollEl.scrollHeight;
    const clientHeight = scrollEl.clientHeight;

    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
    setOverallProgress(progress);

    // 计算每个章节相对 scrollEl 的顶部位置
    const offsets = headings.map((h) => getElementOffsetTop(h.el, scrollEl));

    const newSectionProgress = {};
    let currentActive = headings[0].id;

    for (let i = 0; i < headings.length; i++) {
      const start = Math.max(0, offsets[i] - 120);
      const end = i < headings.length - 1 ? Math.max(start + 1, offsets[i + 1] - 120) : scrollHeight;
      const id = headings[i].id;

      if (scrollTop <= start) {
        // 未滚动到该章节：进度为 0%
        newSectionProgress[id] = 0;
      } else if (scrollTop >= end) {
        // 已读过该章节：进度为 100%
        newSectionProgress[id] = 100;
        currentActive = id;
      } else {
        // 正在阅读该章节：按比例精确填充
        const span = Math.max(1, end - start);
        const p = Math.min(100, Math.max(0, Math.round(((scrollTop - start) / span) * 100)));
        newSectionProgress[id] = p;
        currentActive = id;
      }
    }

    if (scrollTop < Math.max(0, offsets[0] - 120)) {
      currentActive = headings[0].id;
    }

    setSectionProgresses(newSectionProgress);
    setActiveId(currentActive);
  }, [scrollContainerRef, headings]);

  useEffect(() => {
    const scrollEl =
      scrollContainerRef?.current ||
      document.querySelector(".article-scroll-area");
    if (!scrollEl) return;

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef, handleScroll, headings]);

  // 4. 防抖 Hover 处理
  const handleMouseEnter = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 280);
  };

  // 5. 点击跳转锚点
  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    const scrollEl =
      scrollContainerRef?.current ||
      document.querySelector(".article-scroll-area");
    if (el && scrollEl) {
      const targetScrollTop = getElementOffsetTop(el, scrollEl) - 40;

      scrollEl.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
      setActiveId(id);
      setIsPinned(false);
      setIsHovered(false);
    }
  };

  if (headings.length === 0) {
    return null;
  }

  // 骨架条左对齐宽度定义
  const getBarWidthClass = (level) => {
    switch (level) {
      case 1:
        return "w-11"; // H1 44px
      case 2:
        return "w-8"; // H2 32px
      case 3:
        return "w-5"; // H3 20px
      default:
        return "w-3.5"; // H4+ 14px
    }
  };

  const showPopover = isHovered || isPinned;

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={cn(
        "article-toc-container fixed z-40 select-none",
        "right-7 md:right-9 lg:right-10 top-32"
      )}
    >
      {/* 1. 右侧极简骨架线 */}
      <div
        onClick={() => setIsPinned(!isPinned)}
        className={cn(
          "flex flex-col items-start gap-1 py-2 px-1.5 rounded-xl cursor-pointer transition-all duration-200",
          "hover:bg-foreground/5",
          isPinned && "bg-foreground/10 ring-1 ring-accent/30"
        )}
      >
        <div className="flex flex-col items-start gap-1.5 py-1">
          {headings.map((item) => {
            const p = sectionProgresses[item.id] ?? 0;
            const isFinished = p >= 100;
            const isInProgress = p > 0 && p < 100;
            const isActive = activeId === item.id;
            const widthClass = getBarWidthClass(item.level);

            return (
              <div key={item.id} className="flex items-center gap-1">
                {/* 当前活动章节指示点 */}
                <div
                  className={cn(
                    "size-1 rounded-full transition-all duration-150",
                    isActive ? "bg-accent opacity-100 scale-125" : "opacity-0"
                  )}
                />
                <div
                  title={item.text}
                  className={cn(
                    "relative h-[3px] rounded-full overflow-hidden transition-all duration-150 bg-foreground/15",
                    widthClass
                  )}
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-150",
                      isFinished && "bg-foreground/45 w-full",
                      isInProgress && "bg-accent",
                      p === 0 && "w-0"
                    )}
                    style={isInProgress ? { width: `${p}%` } : undefined}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* 底部阅读进度百分比 */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted/70 pt-1 w-full justify-start pl-2">
          <svg className="size-2.5 -rotate-90 shrink-0" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
              className="stroke-foreground/20"
              strokeWidth="3.5"
              fill="none"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              className="stroke-accent transition-all duration-150"
              strokeWidth="3.5"
              strokeDasharray={56.54}
              strokeDashoffset={56.54 - (56.54 * overallProgress) / 100}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span>{overallProgress}%</span>
        </div>
      </div>

      {/* 2. 悬浮展开的完整大纲面板 */}
      {showPopover && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "absolute right-full top-0 mr-2.5 w-76 max-h-[72vh] flex flex-col",
            "bg-background/95 dark:bg-overlay/95 backdrop-blur-2xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden",
            "animate-in fade-in-50 zoom-in-95 duration-150 z-50",
            "before:absolute before:-right-3 before:top-0 before:w-4 before:h-full before:content-['']"
          )}
        >
          {/* 大纲标题栏 */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-foreground/10 text-xs font-semibold text-muted tracking-wider">
            <span>{t("articleView.toc")}</span>
            <span className="font-mono text-accent font-bold">{overallProgress}%</span>
          </div>

          {/* 大纲列表 */}
          <div className="flex-1 overflow-y-auto p-1.5 flex flex-col gap-0.5 scrollbar-thin">
            {headings.map((item) => {
              const isActive = activeId === item.id;
              const indentClass =
                item.level === 1
                  ? "pl-1.5"
                  : item.level === 2
                  ? "pl-3.5"
                  : item.level === 3
                  ? "pl-6"
                  : "pl-8";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToHeading(item.id);
                  }}
                  className={cn(
                    "flex items-center justify-between text-left py-1.5 pr-2 rounded-xl transition-all duration-150 text-xs group/item cursor-pointer",
                    indentClass,
                    isActive
                      ? "text-accent font-medium bg-accent/10"
                      : "text-foreground/75 hover:text-foreground hover:bg-foreground/5"
                  )}
                >
                  <span className="truncate flex-1 pr-2 leading-relaxed">
                    {item.text}
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-mono px-1 py-0.5 rounded shrink-0 transition-colors",
                      isActive
                        ? "text-accent bg-accent/15 font-semibold"
                        : "text-muted/50 bg-default/30 group-hover/item:text-muted"
                    )}
                  >
                    H{item.level}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 底部信息 */}
          <div className="px-3.5 py-1.5 bg-default/20 border-t border-foreground/5 text-[11px] text-muted flex items-center justify-between">
            <span>
              {headings.length} {t("articleView.sections")}
            </span>
            <span className="text-[10px] opacity-70">
              {t("articleView.clickToJump")}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
