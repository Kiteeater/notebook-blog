"use client";

import CoverArt from "./CoverArt";
import { useTransition } from "@/components/shell/TransitionProvider";
import { formatDate } from "@/lib/format";
import type { PostMeta } from "@/lib/types";

/** 索引网格中的单篇文章：大图 + 标题/主题/日期/阅读时长 + 细线，无浮动卡片 */
export default function PostCard({ post }: { post: PostMeta }) {
  const { navigate, prefetch } = useTransition();
  const href = `/writing/${post.slug}`;

  return (
    <article className="post-item" data-enter style={{ willChange: "transform" }}>
      <a
        href={href}
        onClick={(e) => {
          // 保留 cmd/ctrl+click 新标签页的原生行为
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          e.preventDefault();
          navigate(href);
        }}
        onPointerEnter={() => prefetch(href)}
        className="block"
        aria-label={`阅读：${post.title}`}
      >
        <div className="overflow-hidden rounded-[6px]">
          <CoverArt
            slug={post.slug}
            category={post.category}
            className="cover-media block aspect-[4/3] w-full"
          />
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
              {post.category ?? "Notes"} · {formatDate(post.date)}
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
    </article>
  );
}
