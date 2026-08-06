"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
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

type View = "filters" | "search";

/** 文章是否命中搜索词：title / description / tags / 分类文案（小写包含）。 */
function postMatches(post: PostMeta, q: string): boolean {
  const hay = [
    post.title,
    post.description,
    post.tags.join(" "),
    categoryLabel(post.category),
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

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

/** 搜索切换 icon：放大镜描边按钮，点击在「分类 / 搜索」视图间切换。
 *  搜索态下不再挂推流（避免输入区附近文字漂移）。 */
function SearchToggle({
  active,
  onClick,
}: {
  active: boolean;
  onClick: () => void;
}) {
  const ref = useLiquidPush<HTMLButtonElement>(!active);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={active ? "返回分类筛选" : "搜索文章"}
      aria-pressed={active}
      data-active={active}
      className="search-icon-btn"
    >
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
        <path
          d="M10.5 10.5L14 14"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}

/** 搜索输入框：圆角描边胶囊，聚焦时 placeholder 走 nav-swap masked slide。
 *  右侧 ✕ 仅在有输入时显示，清空并切回分类视图。 */
const SearchField = forwardRef<
  HTMLInputElement,
  { value: string; onChange: (v: string) => void; onClear: () => void }
>(function SearchField({ value, onChange, onClear }, ref) {
  const inner = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  useImperativeHandle(ref, () => inner.current as HTMLInputElement, []);
  const lifted = focused || value.length > 0;
  return (
    <div className="search-field" data-focused={focused}>
      <span className="search-icon-inline" aria-hidden="true">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M10.5 10.5L14 14"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      </span>
      <span className="nav-swap search-placeholder">
        <span className={lifted ? "swap-a shifted" : "swap-a"}>搜索文章…</span>
        <span className="swap-b">输入关键词</span>
      </span>
      <input
        ref={inner}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            onClear();
          }
        }}
        aria-label="搜索文章"
        className="search-input"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="清空搜索"
          className="search-clear"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
            <path
              d="M1.5 1.5L8.5 8.5M8.5 1.5L1.5 8.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  );
});

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
  /** 视图模式：分类筛选 / 搜索输入（互斥，复用 liquid-rise-in crossfade） */
  const [view, setView] = useState<View>("filters");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  /** 虚拟滚动是否激活（桌面 + 非 reduced-motion 时由 Lenis effect 开启） */
  const [vs, setVs] = useState(false);
  /** WebGL 初始化失败时退回 DOM 网格（仍可能保留普通文档滚动） */
  const [glFail, setGlFail] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const rafRef = useRef(0);
  // WebGL 卡片层共享状态（桌面 vs=true 时启用）：rects 由场景写入，hover 由命中层写入
  const rectsRef = useRef<CardRect[] | null>(null);
  const hoverRef = useRef<number>(-1);

  /** 桌面虚拟滚动 + WebGL 同时可用 */
  const useGl = vs && !glFail;

  const pills = useMemo(() => {
    const names = [ALL, ...categories.map((c) => c.name)];
    if (filter !== ALL && !names.includes(filter)) names.push(filter);
    return names;
  }, [categories, filter]);

  const countOf = (name: string) =>
    name === ALL ? posts.length : posts.filter((p) => p.category === name).length;

  // 搜索 debounce：120ms 后把 query 写入 debounced，触发 filtered 重算
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim().toLowerCase()), 120);
    return () => clearTimeout(t);
  }, [query]);

  const searched = useMemo(
    () => (debounced ? posts.filter((p) => postMatches(p, debounced)) : posts),
    [posts, debounced],
  );

  const filtered =
    filter === ALL ? searched : searched.filter((p) => p.category === filter);

  const desktop = () =>
    window.matchMedia("(min-width: 768px)").matches && !sceneState.reduced;

  // 桌面端：Lenis 惯性虚拟滚动（标题固定，网格在其后移动）
  useEffect(() => {
    if (!desktop()) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;

    const lenis = new Lenis({
      // 只在 viewport 内滚 content；滚轮监听挂 window——
      // 卡片层是 viewport 的兄弟节点，挂 wrapper 会收不到卡片区域上的 wheel。
      wrapper: viewport,
      content,
      eventsTarget: window,
      lerp: 0.16,
      wheelMultiplier: 1.85,
      // 用 content 高度算 limit（wrapper.scrollHeight 在 absolute+overflow 下不可靠）
      naiveDimensions: true,
    });
    lenisRef.current = lenis;
    // 开启 vs 后 DOM 会换成占位高度；等一帧再 resize，避免 limit 仍是旧网格高度
    setGlFail(false);
    setVs(true);
    requestAnimationFrame(() => {
      lenis.resize();
      lenis.scrollTo(0, { immediate: true });
    });

    lenis.on("scroll", () => {
      const limit = Math.max(1, lenis.limit);
      sceneState.scrollTarget = (lenis.scroll / limit) * 0.14 - 0.07;
      // 喂滚动速度给 BuoyantField 做卡片仰俯惯性（direction 带符号，归一到 ~-1..1）
      sceneState.scrollVelTarget = lenis.direction * Math.min(Math.abs(lenis.velocity) / 12, 1);
    });

    const loop = (t: number) => {
      lenis.raf(t);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    // 键盘滚动
    const onKey = (e: KeyboardEvent) => {
      if (!lenisRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "A" || tag === "BUTTON") return;
      const l = lenisRef.current;
      const vh = viewport.clientHeight;
      const map: Record<string, number | "home" | "end"> = {
        ArrowDown: l.scroll + 220,
        ArrowUp: l.scroll - 220,
        PageDown: l.scroll + vh * 0.92,
        PageUp: l.scroll - vh * 0.92,
        Home: "home",
        End: "end",
      };
      const target = map[e.key];
      if (target === undefined) return;
      e.preventDefault();
      if (target === "home") l.scrollTo(0);
      else if (target === "end") l.scrollTo(l.limit);
      else l.scrollTo(target);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("keydown", onKey);
      lenis.destroy();
      lenisRef.current = null;
      sceneState.scrollTarget = 0;
      sceneState.scrollVelTarget = 0;
      setVs(false);
    };
  }, []);

  /** WebGL 挂了：拆掉 Lenis，退回普通 DOM 文档流，避免空占位滚动 */
  const handleGlFail = () => {
    cancelAnimationFrame(rafRef.current);
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.destroy();
      lenisRef.current = null;
    }
    sceneState.scrollTarget = 0;
    sceneState.scrollVelTarget = 0;
    setGlFail(true);
    setVs(false);
  };

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

  // 搜索结果变化：回到顶部（轻量，不抢焦点）
  useEffect(() => {
    const lenis = lenisRef.current;
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
      requestAnimationFrame(() => lenis.resize());
    }
  }, [debounced]);

  // vs 布局稳定后（占位高度 / 视口 absolute 就位）再量一次，保证 limit 与 WebGL 进度对齐
  useEffect(() => {
    if (!vs) return;
    const lenis = lenisRef.current;
    if (!lenis) return;
    requestAnimationFrame(() => lenis.resize());
  }, [vs, filtered.length]);
  // 标题区弧形压缩已并入 BuoyantField（写入内层 .buoyant），此处不再单独 tick。

  /** 切到搜索视图：清空旧词、聚焦输入框。 */
  const enterSearch = () => {
    setQuery("");
    setDebounced("");
    setView("search");
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  /** 退出搜索：清空 + 回分类视图。 */
  const exitSearch = () => {
    setQuery("");
    setDebounced("");
    setView("filters");
    inputRef.current?.blur();
  };

  return (
    <div
      data-page="writing"
      className={`relative ${useGl ? "h-[100dvh] overflow-hidden" : ""}`}
    >
      {/* 顶部雾纱：网格经过时溶入雾中，保证固定标题可读 */}
      {useGl && (
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
          useGl ? "absolute inset-x-0 top-0" : ""
        }`}
      >
        <h1
          data-enter
          className="font-sans text-[clamp(2.3rem,6vw,4.4rem)] font-medium leading-none tracking-[-0.03em] text-ink-950"
        >
          Selected Writing
        </h1>
        <div className="pointer-events-auto mt-6 flex flex-wrap items-center justify-center gap-2">
          {/* 搜索切换 icon（常驻左侧） */}
          <SearchToggle
            active={view === "search"}
            onClick={view === "search" ? exitSearch : enterSearch}
          />
          {/* 控件区：key 随 view 切换 → 重挂载 → liquid-rise-in 浮上 */}
          <div key={view} className="segmented-pane">
            {view === "filters" ? (
              <div
                className="flex flex-wrap items-center justify-center gap-2"
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
            ) : (
              <SearchField
                ref={inputRef}
                value={query}
                onChange={setQuery}
                onClear={exitSearch}
              />
            )}
          </div>
        </div>
      </div>

      {/*
        Lenis wrapper（viewport）用原生 scrollTop 滚 content。
        卡片层必须放在 wrapper 之外：absolute 子节点在 overflow 滚动容器里
        仍会随 scrollTop 一起被抬走，表现为「滑到后面一篇都看不见」。
      */}
      <div
        ref={viewportRef}
        className={
          useGl
            ? // overflow 必须可滚：hidden/clip 会让 Lenis checkOverflow → stop
              "absolute inset-0 overflow-x-hidden overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            : ""
        }
      >
        <div
          ref={contentRef}
          className={`mx-auto max-w-[1180px] px-5 pt-8 sm:px-8 md:pt-[300px] ${
            useGl ? "pb-[12vh]" : "pb-24"
          }`}
        >
          {filtered.length === 0 ? (
            <p className="py-24 text-center font-sans text-sm text-ink-500">
              {debounced ? "未找到匹配文章。" : "该分类下暂无文章。"}
            </p>
          ) : useGl ? (
            <div
              aria-hidden="true"
              style={{
                // 行间行程 ~38vh，首屏余量 48vh；总滚程短、跟手更快
                height: `${Math.max(0, Math.ceil(filtered.length / 2) - 1) * 38 + 48}vh`,
              }}
            />
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

      {/* 桌面 WebGL：钉在页面壳上（不进 Lenis wrapper），只由 sceneState.scroll 驱动 */}
      {useGl && filtered.length > 0 && (
        <div
          className="pointer-events-none absolute inset-0 z-[5]"
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
            onFail={handleGlFail}
          />
          <CardTextLayer
            posts={filtered}
            rectsRef={rectsRef}
            hoverRef={hoverRef}
          />
        </div>
      )}
    </div>
  );
}
