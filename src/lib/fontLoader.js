/**
 * Font Loader - 按需加载字体
 * 参考 shadcn/ui 的字体系统设计
 * 字体来源：Google Fonts 官方
 */

// 字体分类配置
export const FONT_CATEGORIES = {
  sans: {
    label: "Sans",
    fonts: [
      {
        name: "Inter",
        value: "Inter",
        url: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Geist",
        value: "Geist",
        url: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Nunito Sans",
        value: "Nunito Sans",
        url: "https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Figtree",
        value: "Figtree",
        url: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "DM Sans",
        value: "DM Sans",
        url: "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Manrope",
        value: "Manrope",
        url: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Outfit",
        value: "Outfit",
        url: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Space Grotesk",
        value: "Space Grotesk",
        url: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Montserrat",
        value: "Montserrat",
        url: "https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Instrument Sans",
        value: "Instrument Sans",
        url: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
    ],
  },
  serif: {
    label: "Serif",
    fonts: [
      {
        name: "Noto Serif",
        value: "Noto Serif",
        url: "https://fonts.googleapis.com/css2?family=Noto+Serif:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Merriweather",
        value: "Merriweather",
        url: "https://fonts.googleapis.com/css2?family=Merriweather:wght@400;500;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Lora",
        value: "Lora",
        url: "https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Playfair Display",
        value: "Playfair Display",
        url: "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "EB Garamond",
        value: "EB Garamond",
        url: "https://fonts.googleapis.com/css2?family=EB+Garamond:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "Instrument Serif",
        value: "Instrument Serif",
        url: "https://fonts.googleapis.com/css2?family=Instrument+Serif:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
    ],
  },
  mono: {
    label: "Mono",
    fonts: [
      {
        name: "Geist Mono",
        value: "Geist Mono",
        url: "https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
      {
        name: "JetBrains Mono",
        value: "JetBrains Mono",
        url: "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap",
        preview: "Aa",
      },
    ],
  },
  chinese: {
    label: "中文字体",
    fonts: [
      {
        name: "Noto Sans SC",
        value: "Noto Sans SC",
        url: "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&display=swap",
        preview: "中文",
      },
      {
        name: "Noto Serif SC",
        value: "Noto Serif SC",
        url: "https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;500;700&display=swap",
        preview: "中文",
      },
      {
        name: "LXGW WenKai",
        value: "LXGW WenKai",
        url: "https://cdn.jsdelivr.net/npm/lxgw-wenkai-webfont@1.7.0/style.css",
        preview: "中文",
      },
    ],
  },
};

// 系统字体（无需加载）
export const SYSTEM_FONTS = [
  { name: "System UI", value: "system-ui", preview: "Aa" },
  { name: "Sans Serif", value: "sans-serif", preview: "Aa" },
  { name: "Serif", value: "serif", preview: "Aa" },
  { name: "Monospace", value: "monospace", preview: "Aa" },
];

// 扁平化所有自定义字体配置（用于快速查找）
const ALL_CUSTOM_FONTS = {};
Object.values(FONT_CATEGORIES).forEach((category) => {
  category.fonts.forEach((font) => {
    ALL_CUSTOM_FONTS[font.value] = font;
  });
});

// 已加载的字体缓存
const loadedFonts = new Set();

// 正在加载的字体 Promise 缓存
const loadingFonts = new Map();

/**
 * 检查字体是否已加载
 */
export function isFontLoaded(fontFamily) {
  return loadedFonts.has(fontFamily);
}

/**
 * 加载单个字体
 */
export function loadFont(fontFamily) {
  // 系统字体无需加载
  if (SYSTEM_FONTS.some((f) => f.value === fontFamily)) {
    return Promise.resolve();
  }

  // 已加载则直接返回
  if (loadedFonts.has(fontFamily)) {
    return Promise.resolve();
  }

  // 正在加载则返回现有的 Promise
  if (loadingFonts.has(fontFamily)) {
    return loadingFonts.get(fontFamily);
  }

  const config = ALL_CUSTOM_FONTS[fontFamily];
  if (!config) {
    console.warn(`Font config not found for: ${fontFamily}`);
    return Promise.resolve();
  }

  // 创建加载 Promise
  const loadPromise = new Promise((resolve, reject) => {
    // 检查是否已经存在该样式表
    const existingLink = document.querySelector(`link[href="${config.url}"]`);
    if (existingLink) {
      loadedFonts.add(fontFamily);
      loadingFonts.delete(fontFamily);
      resolve();
      return;
    }

    // 使用 preload 优先加载
    const preloadLink = document.createElement("link");
    preloadLink.rel = "preload";
    preloadLink.as = "style";
    preloadLink.href = config.url;
    preloadLink.crossOrigin = "anonymous";

    preloadLink.onload = () => {
      // Preload 完成后，切换为 stylesheet
      const styleLink = document.createElement("link");
      styleLink.rel = "stylesheet";
      styleLink.href = config.url;
      styleLink.crossOrigin = "anonymous";

      styleLink.onload = () => {
        loadedFonts.add(fontFamily);
        loadingFonts.delete(fontFamily);
        console.log(`Font loaded: ${config.name}`);
        resolve();
      };

      styleLink.onerror = () => {
        loadingFonts.delete(fontFamily);
        console.error(`Failed to load font: ${config.name}`);
        reject(new Error(`Failed to load font: ${config.name}`));
      };

      document.head.appendChild(styleLink);
      // 移除 preload
      preloadLink.remove();
    };

    preloadLink.onerror = () => {
      loadingFonts.delete(fontFamily);
      console.error(`Failed to preload font: ${config.name}`);
      reject(new Error(`Failed to preload font: ${config.name}`));
    };

    document.head.appendChild(preloadLink);
  });

  loadingFonts.set(fontFamily, loadPromise);
  return loadPromise;
}

/**
 * 批量加载多个字体
 */
export function loadFonts(fontFamilies) {
  const uniqueFonts = [...new Set(fontFamilies)].filter(
    (f) => !SYSTEM_FONTS.some((sys) => sys.value === f) && !loadedFonts.has(f)
  );

  return Promise.all(uniqueFonts.map((f) => loadFont(f)));
}

/**
 * 在空闲时预加载字体
 */
export function preloadLikelyFont(fontFamily) {
  if (SYSTEM_FONTS.some((f) => f.value === fontFamily) || loadedFonts.has(fontFamily)) {
    return;
  }

  if ("requestIdleCallback" in window) {
    requestIdleCallback(
      () => {
        loadFont(fontFamily).catch(() => {});
      },
      { timeout: 5000 }
    );
  } else {
    setTimeout(() => {
      loadFont(fontFamily).catch(() => {});
    }, 100);
  }
}

/**
 * 获取字体的 CSS font-family 值
 */
export function getFontFamilyValue(fontFamily) {
  const config = ALL_CUSTOM_FONTS[fontFamily];
  if (config) {
    // 添加合适的 fallback
    const category = Object.values(FONT_CATEGORIES).find((cat) =>
      cat.fonts.some((f) => f.value === fontFamily)
    );
    
    if (category?.label === "中文字体") {
      return `${config.name}, system-ui, sans-serif`;
    }
    if (category?.label === "Serif") {
      return `${config.name}, Georgia, serif`;
    }
    if (category?.label === "Mono") {
      return `${config.name}, ui-monospace, monospace`;
    }
    return `${config.name}, system-ui, sans-serif`;
  }
  return fontFamily;
}

/**
 * 获取字体配置
 */
export function getFontConfig(fontFamily) {
  return ALL_CUSTOM_FONTS[fontFamily] || null;
}

export default {
  loadFont,
  loadFonts,
  isFontLoaded,
  preloadLikelyFont,
  getFontFamilyValue,
  getFontConfig,
  FONT_CATEGORIES,
  SYSTEM_FONTS,
};
