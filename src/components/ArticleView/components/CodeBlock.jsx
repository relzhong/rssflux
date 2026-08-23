import { codeToHtml } from "shiki";
import { useEffect, useRef, useState } from "react";
import { Button, Tooltip } from "@heroui/react";
import { Check, Copy } from "lucide-react";
import { settingsState } from "@/stores/settingsStore.js";
import { useStore } from "@nanostores/react";
import { cn } from "@/lib/utils.js";
import { themeState } from "@/stores/themeStore.js";
import { useTranslation } from "react-i18next";
import { useInView } from "framer-motion";

export default function CodeBlock({ code, language }) {
  const { t } = useTranslation();
  const [html, setHtml] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const { showLineNumbers, forceDarkCodeTheme } = useStore(settingsState);
  const { darkTheme } = useStore(themeState);
  const codeRef = useRef(null);
  const isInView = useInView(codeRef, { once: true });

  useEffect(() => {
    async function highlight() {
      const highlighted = await codeToHtml(code, {
        lang: language || "text",
        themes: {
          light: "catppuccin-latte",
          dark: "github-dark",
        },
      });
      setHtml(highlighted);
    }

    if (isInView) {
      highlight();
    }
  }, [code, language, isInView]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      console.error("复制失败:", err);
    }
  };

  return (
    <div
      className={cn(
        forceDarkCodeTheme ? `${darkTheme} force-dark-code-theme` : "",
        "code-block relative group",
        showLineNumbers ? "line-numbers" : "",
      )}
      ref={codeRef}
    >
      <span
        className={cn(
          "text-xs absolute right-2 top-1 text-muted opacity-100 group-hover:opacity-0 transition-opacity",
          language === "text" ? "hidden" : "",
        )}
      >
        {language}
      </span>
      <Tooltip size="sm" delay={0}>
        <Button
          className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity"
          size="sm"
          isDisabled={isCopied}
          variant="ghost"
          isIconOnly
          onPress={handleCopy}
        >
          {isCopied ? (
            <Check className="size-4 text-muted" />
          ) : (
            <Copy className="size-4 text-muted" />
          )}
        </Button>
        <Tooltip.Content>{t("common.copy")}</Tooltip.Content>
      </Tooltip>
      {isInView && (
        <div
          className="animate-in fade-in duration-300"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
