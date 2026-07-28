"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Lenis from "lenis";
import PostCard from "./PostCard";
import BuoyantField from "./BuoyantField";
import CardSceneCanvas from "./CardSceneCanvas";
import CardTextLayer from "./CardTextLayer";
import type { CardRect } from "./cardScene";
import { sceneState } from "@/lib/sceneState";
import { categoryLabel } from "@/lib/categories";
import { useLiquidPush } from "@/components/liquid/liquidControls";
import type { PostMeta } from "@/lib/types";

/** 单个筛选 pill：button 本体挂液体推流，内层文字随鼠标方向轻位移。 */
function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const ref = useLiquidPush<HTMLButtonElement>();
  return (
    <button
      ref={ref}
      type="button"
      className="pill-filter bg-paper-50/55"
      data-active={active}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
      <span className="count">{count}</span>
    </button>
  );
}

type Props = {
  posts: PostMeta[];
  categories: { name: string; count: number }[];
};

const ALL = "All";

/**
 * Selected Writing —— 对应 unseen.co 的 Projects。
 * 桌面端：标题与筛选器固定，网格在 Lenis 驱动的虚拟滚动中从其下方经过；
 * 经过标题区域时产生克制的弧形压缩（透镜形变），离开后恢复。
 * 移动端 / reduced-motion：正常文档滚动，无形变。
 */
export default function WritingIndex({ posts, categories }: Props) {
  const [filter, setFilter] = useState<string>(ALL);
  /** 虚拟滚动是否激活（桌面 + 非 reduced-motion 时由 Lenis effect 开启） */
  const [vs, setVs] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  // WebGL 卡片层共享状态（桌面 vs=true 时启用）：rects 由场景写入，hover 由命中层写入
  const rectsRef = useRef<CardRect[] | null>(null);
  const hoverRef = useRef<number>(-1);

  const pills = useMemo(() => {
    const names = [ALL, ...categories.map((c) => c.name)];
    if (filter !== ALL && !names.includes(filter)) names.push(filter);
    return names;
  }, [categories, filter]);

  const countOf = (name: string) =>
    name === ALL ? posts.length : posts.filter((p) => p.category === name).length;

  const filtered =
    filter === ALL ? posts : posts.filter((p) => p.category === filter);

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
      // 喂滚动速度给 BuoyantField 做卡片仰俯惯性（direction 带符号，归一到 ~-1..1）
      sceneState.scrollVelTarget = lenis.direction * Math.min(Math.abs(lenis.velocity) / 12, 1);
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
      sceneState.scrollVelTarget = 0;
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

  // 标题区弧形压缩已并入 BuoyantField（写入内层 .buoyant），此处不再单独 tick。

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
          aria-label="按分类筛选"
        >
          {pills.map((name) => (
            <FilterPill
              key={name}
              label={name === ALL ? ALL : categoryLabel(name)}
              count={countOf(name)}
              active={filter === name}
              onClick={() => setFilter(name)}
            />
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
              该分类下暂无文章。
            </p>
          ) : vs ? (
            // 桌面 WebGL 模式：
            // - contentRef 内放不可见占位撑出 Lenis 滚动高度（WebGL 内部按 scroll 布局）
            // - CardSceneCanvas / CardTextLayer 挂在 viewportRef 下 absolute 铺满视口
            <>
              <div
                aria-hidden="true"
                style={{ height: `${Math.ceil(filtered.length / 2) * 520 + 400}px` }}
              />
              {/* WebGL 套件用 portal 般的 absolute 定位，挂在 viewportRef 下 */}
              {/* WebGL 套件：canvas + 文字层共享同一 mask，卡片飞入标题区时
                  线性淡出（顶部 ~24% 渐变到透明），不再硬穿「Selected Writing」。 */}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  WebkitMaskImage:
                    "linear-gradient(180deg, transparent 0%, #000 24%, #000 100%)",
                  maskImage:
                    "linear-gradient(180deg, transparent 0%, #000 24%, #000 100%)",
                }}
              >
                <CardSceneCanvas
                  posts={filtered}
                  containerRef={gridRef}
                  rectsRef={rectsRef}
                  hoverRef={hoverRef}
                />
                <CardTextLayer
                  posts={filtered}
                  rectsRef={rectsRef}
                  hoverRef={hoverRef}
                />
              </div>
            </>
          ) : (
            <div
              ref={gridRef}
              className="writing-grid grid grid-cols-1 gap-x-10 gap-y-14 md:grid-cols-2 md:gap-y-20"
              style={{ perspective: "1400px" }}
            >
              <BuoyantField
                containerRef={gridRef}
                headerRef={headerRef}
                mode="archive"
              >
                {filtered.map((post) => (
                  <PostCard key={post.slug} post={post} />
                ))}
              </BuoyantField>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
