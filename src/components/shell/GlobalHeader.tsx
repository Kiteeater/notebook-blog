"use client";

import { usePathname } from "next/navigation";
import { useTransition } from "./TransitionProvider";
import { useLiquidPush } from "@/components/liquid/liquidControls";

const NAV = [
  { href: "/", label: "Index" },
  { href: "/writing", label: "Writing" },
  { href: "/about", label: "About" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

/** 单个导航项：button 本体挂液体推流（x/y/skewX），内层 .nav-swap 做 masked slide。
 *  active 态：swap-b(serif italic) 默认停在原位，hover 时反向滑回 sans —— 切页有滑入过渡，hover 仍可动。 */
function NavLink({
  href,
  label,
  active,
  onNavigate,
  onPrefetch,
}: {
  href: string;
  label: string;
  active: boolean;
  onNavigate: (href: string) => void;
  onPrefetch: (href: string) => void;
}) {
  const ref = useLiquidPush<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onNavigate(href)}
      onPointerEnter={() => onPrefetch(href)}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className="nav-link font-sans text-[13px] font-medium text-ink-800"
    >
      {/* swap 容器独立成层：与 button 的 padding 解耦，避免 absolute swap-b 贴 padding box 错位。
          data-active 透传给 .nav-swap，让 swap 规则能区分选中态（active 不参与 hover swap） */}
      <span className="nav-swap" data-active={active}>
        <span className="swap-a">{label}</span>
        <span className="swap-b" aria-hidden="true">
          {label}
        </span>
      </span>
    </button>
  );
}

/** 固定在顶部的全局导航：左 Logo，右导航 + 圆形菜单钮。路由切换中不卸载、不闪烁。 */
export default function GlobalHeader() {
  const pathname = usePathname();
  const { navigate, prefetch, menuOpen, setMenuOpen } = useTransition();
  const logoRef = useLiquidPush<HTMLButtonElement>();

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-start justify-between px-5 pt-5 sm:px-8 sm:pt-6">
      {/* 博客名称 */}
      <button
        type="button"
        ref={logoRef}
        onClick={() => navigate("/")}
        onPointerEnter={() => prefetch("/")}
        className="pointer-events-auto group flex items-baseline gap-2.5 text-left"
        aria-label="回到首页"
      >
        <span className="font-sans text-[15px] font-semibold tracking-tight text-ink-950">
          思考的碎片
        </span>
        <span className="hidden font-sans text-[10px] font-medium uppercase tracking-[0.24em] text-ink-500 transition-colors duration-500 group-hover:text-ink-800 sm:inline">
          Break the Circle
        </span>
      </button>

      <div className="pointer-events-auto flex items-center gap-7">
        {/* 主导航：宽屏内联，窄屏收进菜单 */}
        <nav className="hidden items-center gap-7 md:flex" aria-label="主导航">
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              active={isActive(pathname, item.href)}
              onNavigate={navigate}
              onPrefetch={prefetch}
            />
          ))}
        </nav>

        {/* 圆形菜单按钮 */}
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "关闭菜单" : "打开菜单"}
          className="flex h-10 w-10 items-center justify-center gap-[5px] rounded-full border bg-paper-50/70 transition-colors duration-500 hover:bg-ink-950 hover:[&>span]:bg-paper-50"
          style={{ borderColor: "var(--hairline-strong)" }}
        >
          <span className="h-[4px] w-[4px] rounded-full bg-ink-950 transition-colors duration-500" />
          <span className="h-[4px] w-[4px] rounded-full bg-ink-950 transition-colors duration-500" />
        </button>
      </div>
    </header>
  );
}
