"use client";

import CoverArt from "./CoverArt";
import { useTransition } from "@/components/shell/TransitionProvider";
import { formatDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import type { PostMeta } from "@/lib/types";

/** 确定性的浮漂相位：每篇文章在浮力场中拥有独一无二、稳定的相位 */
function phaseForSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000; // 0..1
}

/** 索引网格中的单篇文章：封面 + 标题/主题/日期/阅读时长 + 细线。
 *  内层 .buoyant 由 BuoyantField 驱动浮力；焦散光斑叠在封面上强化水中材质。 */
export default function PostCard({ post }: { post: PostMeta }) {
  const { navigate, prefetch } = useTransition();
  const href = `/writing/${post.slug}`;
  const phase = phaseForSlug(post.slug);

  return (
    <article className="post-item group" data-enter style={{ willChange: "transform" }}>
      <div className="buoyant" data-buoyant data-phase={phase}>
        <a
          href={href}
          onClick={(e) => {
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            navigate(href);
          }}
          onPointerEnter={() => prefetch(href)}
          className="block"
          aria-label={`阅读：${post.title}`}
        >
          <div
            className="liquid-cover relative overflow-hidden rounded-[6px]"
            data-liquid=""
          >
            <CoverArt
              slug={post.slug}
              category={post.category}
              className="cover-media block aspect-[4/3] w-full"
            />
            {/* 水中焦散光斑：缓慢游动的高光，强化「悬浮在水中」的材质感 */}
            <span className="caustic-sheen" aria-hidden="true" />
          </div>

          <div
            className="mt-5 flex items-start justify-between gap-5 border-t pt-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <div className="min-w-0">
              <h3 className="post-title font-sans text-[17px] font-medium leading-snug text-ink-950">
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
              className="mt-1.5 shrink-0 text-ink-500 transition-transform duration-500 ease-observatory group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
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
        </a>
      </div>
    </article>
  );
}
