"use client";

import { useTransition } from "./TransitionProvider";

/** 走液态转场的站内链接；保留新标签页打开等原生行为 */
export default function NavLink({
  href,
  className,
  style,
  children,
  ariaLabel,
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  const { navigate, prefetch } = useTransition();
  return (
    <a
      href={href}
      className={className}
      style={style}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        navigate(href);
      }}
      onPointerEnter={() => prefetch(href)}
    >
      {children}
    </a>
  );
}
