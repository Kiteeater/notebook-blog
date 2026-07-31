"use client";

import { useLiquidPush } from "@/components/liquid/liquidControls";
import { useTransition } from "@/components/shell/TransitionProvider";

/**
 * About 页正文：名字 + 三行短文案 + GitHub 外链 + View writing 入口。
 * 客户端组件，因使用液体受感体与转场导航 hook。
 */
export default function AboutBody() {
  const ghRef = useLiquidPush<HTMLAnchorElement>();
  const { navigate, prefetch } = useTransition();

  return (
    <main className="mx-auto max-w-[760px] px-6 pb-32 pt-28 sm:pt-36">
      <p data-enter className="eyebrow">
        About
      </p>

      {/* 名字 */}
      <h1
        data-enter
        className="mt-10 font-display text-[clamp(2.4rem,6vw,4rem)] font-medium italic leading-[1.04] tracking-tight text-ink-950"
      >
        KiteEater.
      </h1>

      {/* 主文案：短句，一句一行，呼吸感 */}
      <div data-enter className="prose-article mt-14">
        <p>Learning everything. Building with AI.</p>
        <p>
          <span className="font-serif italic">Break the Circle.</span>
        </p>
        <p>Field notes. Raw.</p>
      </div>

      {/* 单一入口：GitHub，液体受感体外链 */}
      <section data-enter className="mt-20">
        <h2 className="eyebrow mb-6">Elsewhere</h2>
        <ul className="font-sans text-[15px]">
          <li
            className="flex items-baseline justify-between border-b py-4"
            style={{ borderColor: "var(--hairline)" }}
          >
            <a
              ref={ghRef}
              href="https://github.com/Kiteeater"
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-ink-950 transition-opacity hover:opacity-60"
            >
              Kiteeater
            </a>
            <span className="text-[12px] text-ink-500">GitHub →</span>
          </li>
        </ul>
      </section>

      {/* 首页 pill：View writing */}
      <div data-enter className="mt-16">
        <button
          type="button"
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
    </main>
  );
}
