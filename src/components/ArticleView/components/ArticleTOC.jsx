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
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef(null);

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
    // 文章切换后稍加延迟确保 DOM 渲染完成
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

    // 计算每个章节的绝对高度与当前进度
    const offsets = headings.map((h) => {
      const rect = h.el.getBoundingClientRect();
      const containerRect = scrollEl.getBoundingClientRect();
      return rect.top - containerRect.top + scrollTop;
    });

    const newSectionProgress = {};
    let currentActive = headings[0].id;

    for (let i = 0; i < headings.length; i++) {
      const start = offsets[i] - 80;
      const end = i < headings.length - 1 ? offsets[i + 1] - 80 : scrollHeight;
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

  // 3. 点击跳转锚点
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
    }
  };

  if (headings.length < 2) {
    return null;
  }

  // 骨架条宽度定义
  const getBarWidthClass = (level) => {
    switch (level) {
      case 1:
        return "w-11"; // H1 最宽
      case 2:
        return "w-9 ml-1"; // H2
      case 3:
        return "w-6 ml-2.5"; // H3
      default:
        return "w-4 ml-4"; // H4+
    }
  };

  return (
    <div
      className="article-toc-container fixed right-4 top-36 z-40 select-none group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 1. 右侧 Minimap 骨架小横条 + 底部进度条 */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex flex-col items-start gap-1.5 p-2 rounded-2xl bg-background/50 hover:bg-background/85 backdrop-blur-md border border-foreground/10 shadow-sm transition-all duration-200 cursor-pointer"
      >
        <div className="flex flex-col gap-1.5 py-1">
          {headings.map((item) => {
            const p = sectionProgresses[item.id] ?? 0;
            const isFinished = p >= 100;
            const isInProgress = p > 0 && p < 100;
            const widthClass = getBarWidthClass(item.level);

            return (
              <div
                key={item.id}
                title={item.text}
                className={cn(
                  "relative h-[3.5px] rounded-full overflow-hidden transition-all duration-150 bg-foreground/15",
                  widthClass,
                  activeId === item.id && "scale-y-125"
                )}
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-150",
                    isFinished && "bg-foreground/50 w-full",
                    isInProgress && "bg-accent",
                    p === 0 && "w-0"
                  )}
                  style={isInProgress ? { width: `${p}%` } : undefined}
                />
              </div>
            );
          })}
        </div>

        {/* 底部阅读进度百分比与圆形进度图标 */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-muted/80 pt-1 border-t border-foreground/10 w-full justify-center">
          <svg className="size-3 -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="9"
              className="stroke-foreground/20"
              strokeWidth="3"
              fill="none"
            />
            <circle
              cx="12"
              cy="12"
              r="9"
              className="stroke-accent transition-all duration-150"
              strokeWidth="3"
              strokeDasharray={56.54}
              strokeDashoffset={56.54 - (56.54 * overallProgress) / 100}
              strokeLinecap="round"
              fill="none"
            />
          </svg>
          <span>{overallProgress}%</span>
        </div>
      </div>

      {/* 2. 悬浮展开的完整大纲卡片 (Hover / Click Popover) */}
      {(isHovered || isOpen) && (
        <div
          ref={popoverRef}
          className="absolute right-full top-0 mr-3 w-80 max-h-[75vh] flex flex-col bg-background/95 dark:bg-overlay/95 backdrop-blur-2xl border border-foreground/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* 大纲标题栏 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-foreground/10 text-xs font-semibold text-muted tracking-wider uppercase">
            <span>{t("articleView.toc") || "Outline"}</span>
            <span className="font-mono text-accent font-bold">{overallProgress}%</span>
          </div>

          {/* 大纲列表 */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 scrollbar-thin">
            {headings.map((item) => {
              const isActive = activeId === item.id;
              const indentClass =
                item.level === 1
                  ? "pl-2"
                  : item.level === 2
                  ? "pl-4"
                  : item.level === 3
                  ? "pl-7"
                  : "pl-9";

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToHeading(item.id);
                  }}
                  className={cn(
                    "flex items-center justify-between text-left py-1.5 pr-2.5 rounded-xl transition-all duration-150 text-xs group/item cursor-pointer",
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
                      "text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0 transition-colors",
                      isActive
                        ? "text-accent bg-accent/15 font-semibold"
                        : "text-muted/60 bg-default/40 group-hover/item:text-muted"
                    )}
                  >
                    H{item.level}
                  </span>
                </button>
              );
            })}
          </div>

          {/* 底部提示 */}
          <div className="px-4 py-2 bg-default/20 border-t border-foreground/5 text-[11px] text-muted flex items-center justify-between">
            <span>{headings.length} {t("articleView.sections") || "sections"}</span>
            <span className="text-[10px] opacity-70">Click to jump</span>
          </div>
        </div>
      )}
    </div>
  );
}
