"use client";

import { useEffect } from "react";

/**
 * 文章页增强（无渲染负担）：
 * - 代码块复制按钮（事件委托，一次绑定）
 * - TOC 随滚动高亮当前章节
 */
export default function ArticleEnhance() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const btn = (e.target as HTMLElement).closest?.(
        "[data-copy-btn]",
      ) as HTMLElement | null;
      if (!btn) return;
      const block = btn.closest(".codeblock");
      const text = block?.querySelector("pre")?.innerText ?? "";
      const done = () => {
        btn.dataset.copied = "true";
        btn.textContent = "已复制";
        window.setTimeout(() => {
          delete btn.dataset.copied;
          btn.textContent = "复制";
        }, 1600);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(text).then(done).catch(() => {});
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
        done();
      }
    };
    document.addEventListener("click", onClick);

    const links = [
      ...document.querySelectorAll<HTMLElement>("[data-toc-link]"),
    ];
    const heads = links
      .map((l) => document.getElementById(l.dataset.tocLink ?? ""))
      .filter((h): h is HTMLElement => Boolean(h));
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) {
          if (!en.isIntersecting) continue;
          for (const l of links) {
            l.dataset.active = String(l.dataset.tocLink === en.target.id);
          }
        }
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    heads.forEach((h) => io.observe(h));

    return () => {
      document.removeEventListener("click", onClick);
      io.disconnect();
    };
  }, []);

  return null;
}
