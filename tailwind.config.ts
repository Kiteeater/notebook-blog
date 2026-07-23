import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // 雾白暖灰 —— 观测站的空气
        paper: {
          50: "#f6f3ec",
          100: "#efebe1",
          200: "#e5dfd1",
          300: "#d5cdba",
        },
        // 近黑墨
        ink: {
          950: "#171512",
          900: "#232019",
          800: "#353026",
          700: "#4c463a",
          600: "#686158",
          500: "#8a8375",
          400: "#aaa393",
        },
        // 冷色材质强调（虹彩钢材，微量使用）
        frost: {
          300: "#c3d2dc",
          400: "#9db4c2",
          500: "#7d96a8",
          600: "#5f7b8f",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      transitionTimingFunction: {
        // 全站统一的自然缓动
        observatory: "cubic-bezier(0.22, 1, 0.36, 1)",
      },
      maxWidth: {
        prose: "720px",
      },
    },
  },
  plugins: [],
};

export default config;
