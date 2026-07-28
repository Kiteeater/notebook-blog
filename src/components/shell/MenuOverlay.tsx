"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useTransition } from "./TransitionProvider";

const ITEMS = [
  { href: "/", label: "Index", num: "01" },
  { href: "/writing", label: "Writing", num: "02" },
  { href: "/about", label: "About", num: "03" },
] as const;

/** 全屏菜单：大字号编号列表，hover 切换为衬线斜体 */
export default function MenuOverlay() {
  const pathname = usePathname();
  const { navigate, prefetch, menuOpen, setMenuOpen } = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setMenuOpen]);

  return (
    <div
      data-open={menuOpen}
      aria-hidden={!menuOpen}
      className="fixed inset-0 z-[60] flex flex-col bg-paper-50/[0.985] transition-[opacity,visibility] duration-500 ease-observatory data-[open=false]:pointer-events-none data-[open=false]:invisible data-[open=false]:opacity-0"
    >
      <div className="flex justify-end px-5 pt-5 sm:px-8 sm:pt-6">
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          aria-label="关闭菜单"
          tabIndex={menuOpen ? 0 : -1}
          className="flex h-10 w-10 items-center justify-center rounded-full border text-ink-950 transition-colors duration-500 hover:bg-ink-950 hover:text-paper-50"
          style={{ borderColor: "var(--hairline-strong)" }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
      </div>

      <nav
        className="flex flex-1 flex-col justify-center px-8 sm:px-16"
        aria-label="全屏菜单"
      >
        {ITEMS.map((item, i) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <div
              key={item.href}
              className="overflow-hidden border-b"
              style={{ borderColor: "var(--hairline)" }}
            >
              <button
                type="button"
                onClick={() => navigate(item.href)}
                onPointerEnter={() => prefetch(item.href)}
                tabIndex={menuOpen ? 0 : -1}
                data-open={menuOpen}
                className="group flex w-full items-baseline gap-5 py-4 text-left transition-[transform,opacity] duration-700 ease-observatory data-[open=false]:translate-y-10 data-[open=false]:opacity-0 sm:py-5"
                style={{ transitionDelay: menuOpen ? `${120 + i * 70}ms` : "0ms" }}
              >
                <span className="font-mono text-[12px] text-ink-500">{item.num}</span>
                <span className="nav-swap font-sans text-[11vw] font-medium leading-[1.05] tracking-tight text-ink-950 sm:text-[6.5vw] lg:text-[5vw]">
                  {active ? (
                    <span className="swap-a font-serif italic">{item.label}</span>
                  ) : (
                    <span className="swap-a">{item.label}</span>
                  )}
                  <span className="swap-b" aria-hidden="true">
                    {item.label}
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </nav>

      <footer className="flex items-center justify-between px-8 pb-7 font-sans text-[11px] uppercase tracking-[0.18em] text-ink-500 sm:px-16">
        <span>[待替换：联系邮箱]</span>
        <span>© 2026</span>
      </footer>
    </div>
  );
}
