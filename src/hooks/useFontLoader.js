import { useEffect } from "react";
import { useStore } from "@nanostores/react";
import { settingsState } from "@/stores/settingsStore";
import { loadFont, getFontFamilyValue } from "@/lib/fontLoader";

/**
 * Hook: 按需加载用户选择的字体
 * 当 fontFamily 设置变化时，动态加载对应的字体
 */
export function useFontLoader() {
  const { fontFamily } = useStore(settingsState);

  useEffect(() => {
    // 加载当前选择的字体
    if (fontFamily) {
      loadFont(fontFamily).catch(() => {
        // 静默失败，使用 fallback 字体
      });
    }
  }, [fontFamily]);

  // 返回完整的 font-family CSS 值
  return getFontFamilyValue(fontFamily);
}

export default useFontLoader;
