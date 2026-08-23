import { useEffect, useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils.js";
import { useTranslation } from "react-i18next";

export default function ArticleTOC({ scrollContainerRef, contentContainerRef, articleId }) {
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
    if (!contentContainerRef?.current) return;
    const container = contentContainerRef.current;
    const elements = Array.from(container.querySelectorAll("h1, h2, h3, h4"));

    if (elements.length < 2) {
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

  useEffect(() => {
    const timer = setTimeout(() => {
      extractHeadings();
    }, 150);
    return () => clearTimeout(timer);
  }, [articleId, extractHeadings]);

  // 2. 监听滚动并计算总体进度及各章节进度
  const handleScroll = useCallback(() => {
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl || headings.length === 0) return;

    const scrollTop = scrollEl.scrollTop;
    const scrollHeight = scrollEl.scrollHeight;
    const clientHeight = scrollEl.clientHeight;

    const maxScroll = Math.max(1, scrollHeight - clientHeight);
    const progress = Math.min(100, Math.max(0, Math.round((scrollTop / maxScroll) * 100)));
    setOverallProgress(progress);

    // 计算每个章节的绝对偏移
    const offsets = headings.map((h) => {
      const rect = h.el.getBoundingClientRect();
      const containerRect = scrollEl.getBoundingClientRect();
      return rect.top - containerRect.top + scrollTop;
    });

    const newSectionProgress = {};
    let currentActive = headings[0].id;

    for (let i = 0; i < headings.length; i++) {
      const start = offsets[i] - 100;
      const end = i < headings.length - 1 ? offsets[i + 1] - 100 : scrollHeight;
      const id = headings[i].id;

      if (scrollTop < start) {
        newSectionProgress[id] = 0;
      } else if (scrollTop >= end) {
        newSectionProgress[id] = 100;
        currentActive = id;
      } else {
        const span = Math.max(1, end - start);
        const p = Math.min(100, Math.max(0, Math.round(((scrollTop - start) / span) * 100)));
        newSectionProgress[id] = p;
        currentActive = id;
      }
    }

    setSectionProgresses(newSectionProgress);
    setActiveId(currentActive);
  }, [scrollContainerRef, headings]);

  useEffect(() => {
    const scrollEl = scrollContainerRef?.current;
    if (!scrollEl) return;

    scrollEl.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      scrollEl.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef, handleScroll]);

  // 3. 防抖 Hover 处理（解决鼠标移向弹出面板时丢失 hover 的问题）
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
    }, 280); // 280ms 宽容延迟，防止鼠标移动穿过缝隙时闪退
  };

  // 4. 点击跳转锚点
  const scrollToHeading = (id) => {
    const el = document.getElementById(id);
    const scrollEl = scrollContainerRef?.current;
    if (el && scrollEl) {
      const containerRect = scrollEl.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const targetScrollTop = scrollEl.scrollTop + (elRect.top - containerRect.top) - 20;

      scrollEl.scrollTo({
        top: Math.max(0, targetScrollTop),
        behavior: "smooth",
      });
      setActiveId(id);
      setIsPinned(false);
      setIsHovered(false);
    }
  };

  if (headings.length < 2) {
    return null;
  }

  // 骨架条左对齐宽度定义（图 3 风格）
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
        // 贴合文章正文右侧，并与右侧滚动条保持安全间距（避免遮挡滚动条）
        "right-7 md:right-9 lg:right-10 top-32"
      )}
    >
      {/* 1. 右侧极简骨架线（无臃肿白底卡片，图 3 清爽风格） */}
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
                {/* 当前活动章节指示点（图 3 特色） */}
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

      {/* 2. 悬浮展开的完整大纲面板（无缝连接，支持自由悬停操作） */}
      {showPopover && (
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "absolute right-full top-0 mr-2.5 w-76 max-h-[72vh] flex flex-col",
            "bg-background/95 dark:bg-overlay/95 backdrop-blur-2xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden",
            "animate-in fade-in-50 zoom-in-95 duration-150 z-50",
            // 透明桥接垫片，保证从 Minimap 移动到 Popover 鼠标绝不脱离
            "before:absolute before:-right-3 before:top-0 before:w-4 before:h-full before:content-['']"
          )}
        >
          {/* 大纲标题栏（正确使用 i18n 本地化） */}
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
