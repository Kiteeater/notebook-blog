"use client";

import { useEffect, useRef } from "react";
import { useTransition } from "@/components/shell/TransitionProvider";
import { formatDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import type { CardRect } from "./cardScene";
import type { PostMeta } from "@/lib/types";

/**
 * WebGL 卡片网格的 DOM 覆盖层：文字 + 命中区。
 *
 * - 文字层：4 个 PostCardText，rAF 读 rectsRef 把标题钉到对应 mesh 投影下方。
 *   文字本身不弯曲（DOM 平面），但随卡片中心浮沉——视觉上是「贴在弯曲封面下沿」。
 * - 命中层：4 个透明 <a>，位置/尺寸跟随 rect，pointermove 写 hoverRef（驱动 uCurl）、
 *   click 调 navigate。canvas pointer-events-none，所有命中走这里。
 *
 * 两个层共享同一个 rectsRef / hoverRef（与 CardSceneCanvas 同源）。
 */

type Props = {
  posts: PostMeta[];
  rectsRef: React.RefObject<CardRect[] | null>;
  hoverRef: React.RefObject<number>;
};

export default function CardTextLayer({ posts, rectsRef, hoverRef }: Props) {
  const textRefs = useRef<Array<HTMLDivElement | null>>([]);
  // 缓存每个 text-layer 内的 .post-title，用于 hover 时写 transform
  const titleRefs = useRef<Array<HTMLElement | null>>([]);
  const hitRefs = useRef<Array<HTMLAnchorElement | null>>([]);
  const { navigate, prefetch } = useTransition();

  // rAF：把文字钉到 mesh 投影下方、命中区盖住整个 mesh
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      const rects = rectsRef.current;
      if (!rects) return;
      for (let i = 0; i < posts.length; i++) {
        const r = rects[i];
        if (!r) continue;
        // 文字钉在封面底边下方 14px
        const tx = r.x;
        const ty = r.y + r.h + 14;
        const el = textRefs.current[i];
        if (el) {
          el.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
          el.style.width = `${r.w.toFixed(0)}px`;
          // hover 态：WebGL 模式无 .post-item 祖先，CSS :hover 不触发，
          // 这里由 hoverRef 驱动标题轻位移（与 PostCard 的 translateX(6px) 对齐）
          const title = titleRefs.current[i];
          if (title) {
            const hovered = hoverRef.current === i;
            title.style.transform = hovered ? "translateX(6px)" : "";
          }
        }
        // 命中区盖住 mesh 全部
        const hit = hitRefs.current[i];
        if (hit) {
          hit.style.transform = `translate3d(${r.x.toFixed(1)}px, ${r.y.toFixed(1)}px, 0)`;
          hit.style.width = `${r.w.toFixed(0)}px`;
          hit.style.height = `${r.h.toFixed(0)}px`;
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [posts, rectsRef]);

  return (
    <>
      {/* 文字层 */}
      {posts.map((post, i) => (
        <div
          key={`text-${post.slug}`}
          ref={(el) => {
            textRefs.current[i] = el;
          }}
          className="post-text-layer pointer-events-none absolute left-0 top-0 will-change-transform"
          data-post-text={post.slug}
        >
          <div
            className="flex items-start justify-between gap-5 border-t pt-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="min-w-0">
              <h3
                ref={(el) => {
                  titleRefs.current[i] = el;
                }}
                className="post-title font-sans text-[17px] font-medium leading-snug text-ink-950"
              >
                {post.title}
              </h3>
              <p className="mt-2 font-sans text-[12px] tracking-wide text-ink-500">
                {categoryLabel(post.category)} · {formatDate(post.date)}
                {post.readingTime ? ` · ${post.readingTime}` : ""}
              </p>
            </div>
            <svg
              width="13"
              height="13"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden="true"
              className="mt-1.5 shrink-0 text-ink-500"
            >
              <path
                d="M2 10L10 2M10 2H3.5M10 2v6.5"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      ))}

      {/* 命中层 */}
      {posts.map((post, i) => {
        const href = `/writing/${post.slug}`;
        return (
          <a
            key={`hit-${post.slug}`}
            ref={(el) => {
              hitRefs.current[i] = el;
            }}
            href={href}
            className="card-hit absolute left-0 top-0 will-change-transform"
            aria-label={`阅读：${post.title}`}
            onPointerEnter={() => {
              hoverRef.current = i;
              prefetch(href);
            }}
            onPointerLeave={() => {
              hoverRef.current = -1;
            }}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              hoverRef.current = -1;
              navigate(href);
            }}
          />
        );
      })}
    </>
  );
}
