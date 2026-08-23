import { useEffect, useRef, useState, useMemo } from "react";
import { useStore } from "@nanostores/react";
import {
  aiSummaries,
  clearSummary,
  fetchSummaryIfAvailable,
  requestSummaryGeneration,
} from "@/stores/aiStore.js";
import { Button, CloseButton, Spinner } from "@heroui/react";
import { Sparkles, Bot } from "lucide-react";
import { useTranslation } from "react-i18next";
import BorderBeam from "border-beam";
import { currentThemeMode } from "@/stores/themeStore.js";
import { marked } from "marked";
import parse from "html-react-parser";

const TICK_MS = 16; // ~60fps
const CHARS_STREAMING = 5; // 流式输出中每帧显示字符数
const CHARS_CATCHUP = 24; // 输出结束后快速追赶

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function AISummary({ articleId }) {
  const { t } = useTranslation();
  const $aiSummaries = useStore(aiSummaries);
  const $currentThemeMode = useStore(currentThemeMode);
  const state = $aiSummaries[articleId];

  const [displayedText, setDisplayedText] = useState("");
  const stateRef = useRef(state);

  // 自动从 BFF 获取已存在的摘要 (如 Windmill 或之前生成的)
  useEffect(() => {
    if (articleId) {
      fetchSummaryIfAvailable(articleId);
    }
  }, [articleId]);

  // 始终保持 ref 最新
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // 切换文章、或重新触发总结时重置显示
  useEffect(() => {
    setDisplayedText("");
  }, [articleId]);

  useEffect(() => {
    if (state?.loading && state?.summary === "") {
      setDisplayedText("");
    }
  }, [state?.loading, state?.summary]);

  // 逐字追赶定时器
  useEffect(() => {
    const timer = setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const full = s.summary || "";
      setDisplayedText((prev) => {
        if (prev.length >= full.length) return prev;
        const step = s.loading ? CHARS_STREAMING : CHARS_CATCHUP;
        return full.slice(0, prev.length + step);
      });
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [articleId]);

  // 将当前文本解析为渲染友好的 Markdown HTML
  const parsedHtml = useMemo(() => {
    if (!displayedText) return null;
    try {
      return marked.parse(displayedText);
    } catch {
      return null;
    }
  }, [displayedText]);

  // 未生成且未在加载时，显示文章内快捷触发按钮
  if (!state || (!state.summary && !state.loading && !state.error)) {
    return (
      <div className="flex items-center my-3">
        <Button
          size="sm"
          variant="tertiary"
          onPress={() => requestSummaryGeneration(articleId)}
          className="gap-1.5 text-xs text-muted hover:text-accent font-medium rounded-xl px-3 py-1.5 border border-dashed border-foreground/15 hover:border-accent/40 bg-surface dark:bg-overlay hover:bg-accent/5 transition-colors cursor-pointer shadow-sm"
        >
          <Sparkles className="size-3.5 text-accent" />
          <span>{t("articleView.aiSummarize") || "Generate AI TL;DR"}</span>
        </Button>
      </div>
    );
  }

  const isTyping =
    state.loading || displayedText.length < (state.summary?.length ?? 0);
  const isWaiting = state.loading && !state.summary;

  return (
    <BorderBeam
      active={isWaiting || isTyping}
      size="line"
      theme={$currentThemeMode}
    >
      <div className="ai-summary p-5 sm:p-6 bg-surface dark:bg-overlay rounded-2xl mb-6 border border-foreground/10 shadow-custom-sm">
        {/* 卡片顶部标题栏 */}
        <div className="flex gap-2 h-8 items-center mb-1">
          <div className="flex items-center gap-1.5 h-auto">
            <Sparkles className="size-4.5 text-accent shrink-0" />
            <span className="text-sm font-bold text-accent tracking-wide">
              {t("articleView.aiSummary") || "AI 总结"}
            </span>
          </div>
          {state.model && (
            <span className="text-[11px] font-mono text-muted bg-default/40 px-2.5 py-0.5 rounded-full flex items-center gap-1 ml-1.5 border border-foreground/10">
              <Bot className="size-3.5 text-muted/80" />
              {state.model}
            </span>
          )}
          {!isTyping && (
            <CloseButton
              onPress={() => clearSummary(articleId)}
              className="ml-auto"
            />
          )}
        </div>

        {/* 生成等待中 */}
        {isWaiting && (
          <div className="flex items-center gap-2 text-sm text-muted py-3">
            <Spinner size="sm" color="current" />
            <span>{t("articleView.aiSummaryGenerating") || "正在生成总结..."}</span>
          </div>
        )}

        {/* 错误提示 */}
        {state.error && <p className="text-sm text-danger py-2">{state.error}</p>}

        {/* 总结正文 Markdown 渲染 */}
        {displayedText && (
          <div className="ai-summary-body pt-2 text-sm text-foreground">
            {parsedHtml ? (
              <div className="prose dark:prose-invert prose-sm max-w-none text-foreground leading-relaxed prose-headings:text-foreground prose-headings:font-bold prose-headings:text-sm prose-headings:mt-4 prose-headings:mb-2 prose-p:my-2 prose-p:text-foreground/90 prose-p:leading-relaxed prose-ul:my-2 prose-ul:pl-4 prose-li:my-1 prose-li:text-foreground/90 prose-strong:text-foreground prose-strong:font-bold">
                {parse(parsedHtml)}
              </div>
            ) : (
              <div className="whitespace-pre-line leading-relaxed text-foreground/90">
                {displayedText}
              </div>
            )}
            {isTyping && (
              <span className="inline-block w-0.5 h-4 bg-accent ml-0.5 animate-pulse align-middle" />
            )}
          </div>
        )}
      </div>
    </BorderBeam>
  );
}
