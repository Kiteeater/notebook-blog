"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import PostCard from "./PostCard";
import { sceneState } from "@/lib/sceneState";
import type { PostMeta } from "@/lib/types";

type Props = {
  posts: PostMeta[];
  categories: { name: string; count: number }[];
  initialTopic?: string;
};

const ALL = "All";

/**
 * Selected Writing —— 对应 unseen.co 的 Projects。
 * 桌面端：标题与筛选器固定，网格在 Lenis 驱动的虚拟滚动中从其下方经过；
 * 经过标题区域时产生克制的弧形压缩（透镜形变），离开后恢复。
 * 移动端 / reduced-motion：正常文档滚动，无形变。
 */
export default function WritingIndex({ posts, categories, initialTopic }: Props) {
  const validInitial =
    initialTopic &&
    (categories.some((c) => c.name === initialTopic) ||
      posts.some((p) => p.tags.includes(initialTopic)))
      ? initialTopic
      : ALL;

  const [filter, setFilter] = useState<string>(validInitial);
  /** 虚拟滚动是否激活（桌面 + 非 reduced-motion 时由 Lenis effect 开启） */
  const [vs, setVs] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const pills = useMemo(() => {
    const names = [ALL, ...categories.map((c) => c.name)];
    if (filter !== ALL && !names.includes(filter)) names.push(filter);
    return names;
  }, [categories, filter]);

  const countOf = (name: string) =>
    name === ALL
      ? posts.length
      : posts.filter((p) => p.category === name || p.tags.includes(name)).length;

  const filtered =
    filter === ALL
      ? posts
      : posts.filter((p) => p.category === filter || p.tags.includes(filter));

  const desktop = () =>
    window.matchMedia("(min-width: 768px)").matches && !sceneState.reduced;

  // 桌面端：Lenis 惯性虚拟滚动（标题固定，网格在其后移动）
  useEffect(() => {
    if (!desktop()) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const lenis = new Lenis({
      wrapper: viewport,
      content,
      lerp: 0.105,
      wheelMultiplier: 1,
    });
    lenisRef.current = lenis;
    setVs(true);

    lenis.on("scroll", () => {
      const limit = Math.max(1, lenis.limit);
      sceneState.scrollTarget = (lenis.scroll / limit) * 0.14 - 0.07;
    });

    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // 键盘滚动
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "A" || tag === "BUTTON") return;
      const vh = viewport.clientHeight;
      const map: Record<string, number | "home" | "end"> = {
        ArrowDown: lenis.scroll + 140,
        ArrowUp: lenis.scroll - 140,
        PageDown: lenis.scroll + vh * 0.85,
        PageUp: lenis.scroll - vh * 0.85,
        Home: "home",
        End: "end",
      };
      const target = map[e.key];
      if (target === undefined) return;
      e.preventDefault();
      if (target === "home") lenis.scrollTo(0);
      else if (target === "end") lenis.scrollTo(lenis.limit);
      else lenis.scrollTo(target);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      lenis.destroy();
      lenisRef.current = null;
      sceneState.scrollTarget = 0;
      setVs(false);
    };
  }, []);

  // 筛选变化：回到顶部并重排
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
      requestAnimationFrame(() => lenis.resize());
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [filter]);

  // 桌面端：透镜形变 —— 网格项接近固定标题区域时的弧形压缩
  useEffect(() => {
    if (!desktop()) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const grid = gridRef.current;
      if (!grid) return;
      const zone = (headerRef.current?.getBoundingClientRect().bottom ?? 240) + 8;
      const range = 210;
      const items = grid.querySelectorAll<HTMLElement>(".post-item");
      for (const el of items) {
        const rect = el.getBoundingClientRect();
        const start = zone + range;
        // 越过雾线后保持形变（滑入标题下方的雾中），不重置
        let k = Math.min(1, Math.max(0, (start - rect.top) / range));
        k = k * k * (3 - 2 * k);
        if (k > 0.012) {
          el.style.transformOrigin = "top center";
          el.style.transform = `translateY(${(-17 * k).toFixed(2)}px) scaleY(${(1 - 0.09 * k).toFixed(4)}) rotateX(${(4.6 * k).toFixed(2)}deg)`;
        } else {
          if (el.style.transform) el.style.transform = "";
        }
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      data-page="writing"
      className={`relative ${vs ? "h-[100dvh] overflow-hidden" : ""}`}
    >
      {/* 顶部雾纱：网格经过时溶入雾中，保证固定标题可读 */}
      {vs && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-[280px]"
          style={{
            background:
              "linear-gradient(180deg, rgba(245,242,235,0.97) 0%, rgba(245,242,235,0.88) 40%, rgba(245,242,235,0) 100%)",
          }}
        />
      )}

      {/* 固定的标题与筛选器 */}
      <div
        ref={headerRef}
        className={`pointer-events-none z-20 px-5 pb-2 pt-24 text-center sm:pt-28 ${
          vs ? "absolute inset-x-0 top-0" : ""
        }`}
      >
        <h1
          data-enter
          className="font-sans text-[clamp(2.3rem,6vw,4.4rem)] font-medium leading-none tracking-[-0.03em] text-ink-950"
        >
          Selected Writing
        </h1>
        <div
          data-enter
          className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-2"
          role="group"
          aria-label="按主题筛选"
        >
          {pills.map((name) => (
            <button
              key={name}
              type="button"
              className="pill-filter bg-paper-50/55"
              data-active={filter === name}
              onClick={() => setFilter(name)}
              aria-pressed={filter === name}
            >
              {name}
              <span className="count">{countOf(name)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 虚拟滚动视口 */}
      <div
        ref={viewportRef}
        className={vs ? "absolute inset-0 overflow-hidden" : ""}
      >
        <div
          ref={contentRef}
          className={`mx-auto max-w-[1180px] px-5 pt-8 sm:px-8 md:pt-[300px] ${
            vs ? "pb-[38vh]" : "pb-24"
          }`}
        >
          {filtered.length === 0 ? (
            <p className="py-24 text-center font-sans text-sm text-ink-500">
              该主题下暂无文章。
            </p>
          ) : (
            <div
              ref={gridRef}
              className="writing-grid grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-2 md:gap-y-20"
              style={{ perspective: "1400px" }}
            >
              {filtered.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
