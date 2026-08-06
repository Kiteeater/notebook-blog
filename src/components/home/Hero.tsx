"use client";

import { useEffect } from "react";
import { useTransition } from "@/components/shell/TransitionProvider";
import { sceneState } from "@/lib/sceneState";
import { useLiquidPush } from "@/components/liquid/liquidControls";

/**
 * Cinematic Home：单视口，只承担品牌表达与入口引导。
 * 滚轮不滚动文档，只给共享场景一个缓慢的镜头冲量。
 */
export default function Hero({ postCount }: { postCount: number }) {
  const { navigate, prefetch } = useTransition();
  const pillRef = useLiquidPush<HTMLButtonElement>();

  useEffect(() => {
    if (sceneState.reduced) return;
    const onWheel = (e: WheelEvent) => {
      const next = sceneState.wheelImpulse + e.deltaY * 0.00004;
      sceneState.wheelImpulse = Math.max(-0.09, Math.min(0.09, next));
    };
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      sceneState.wheelImpulse = 0;
    };
  }, []);

  return (
    <main
      data-page="home"
      className="relative flex h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 text-center"
    >
      {/* 中央排版：中文主标题 → 英文注脚 → 入口 */}
      <p data-enter className="eyebrow mb-7">
        Field notes on AI.
      </p>
      <h1 className="select-none">
        <span
          data-enter
          className="block font-display text-[clamp(2.6rem,7vw,5.6rem)] font-medium leading-[1.04] tracking-[-0.02em] text-ink-950"
        >
          思考的碎片
        </span>
        <span
          data-enter
          className="mt-3 block font-serif text-[clamp(1.05rem,2.4vw,1.6rem)] italic leading-[1.3] tracking-[-0.005em] text-ink-600"
        >
          不追求完整的答案，只记录正在发生的思考。
        </span>
      </h1>

      <div data-enter data-exit-first className="mt-12">
        <button
          type="button"
          ref={pillRef}
          onClick={() => navigate("/writing")}
          onPointerEnter={() => prefetch("/writing")}
          className="pill bg-paper-50/60 text-ink-950 backdrop-blur-[2px]"
        >
          View writing
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path
              d="M2 10L10 2M10 2H3.5M10 2v6.5"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* 底部状态栏：状态与年份，无功能说明 */}
      <div
        data-enter
        className="absolute inset-x-0 bottom-0 flex items-end justify-between px-5 pb-6 font-sans text-[10.5px] uppercase tracking-[0.2em] text-ink-600 sm:px-8"
      >
        <span>观测中 — {postCount} 条记录</span>
        <span>© 2026</span>
      </div>
    </main>
  );
}
