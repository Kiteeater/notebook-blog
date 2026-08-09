import type { Metadata } from "next";
import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";
import NavLink from "@/components/shell/NavLink";
import { formatDate } from "@/lib/format";
import { getAllSeries } from "@/lib/series";

export const metadata: Metadata = {
  title: "Series",
  description: "所有文章系列的索引。",
};

export default function SeriesIndexPage() {
  const series = getAllSeries();

  return (
    <div data-page="series-index" className="relative">
      <ScrollDrift />
      <TopVeil tone="sun" />

      <header className="mx-auto max-w-[760px] px-6 pt-28 sm:pt-36">
        <p data-enter className="eyebrow">
          Series · {series.length} 个
        </p>
        <h1
          data-enter
          className="mt-6 font-display text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.15] tracking-[-0.015em] text-ink-950"
        >
          Series
        </h1>
        {series.length === 0 && (
          <p
            data-enter
            className="mt-6 font-serif text-[1.15rem] italic leading-relaxed text-ink-600"
          >
            还没有系列。给文章的 front-matter 加上 series 字段，它就会出现在这里。
          </p>
        )}
      </header>

      <div className="mx-auto mt-16 w-full max-w-[760px] px-6 sm:mt-20">
        <ul>
          {series.map((s) => {
            const first = s.posts[0];
            const last = s.posts[s.posts.length - 1];
            return (
              <li
                key={s.key}
                data-enter
                className="border-t py-5"
                style={{ borderColor: "var(--hairline)" }}
              >
                <NavLink
                  href={`/series/${s.key}`}
                  className="group block"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="font-display text-[1.4rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 group-hover:opacity-60">
                      {s.title}
                    </span>
                    <span className="shrink-0 font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500 tabular-nums">
                      {s.posts.length} 篇
                    </span>
                  </div>
                  <p className="mt-2 font-sans text-[13px] leading-relaxed text-ink-600 line-clamp-2">
                    {s.description}
                  </p>
                  <p className="mt-2 font-sans text-[11px] tracking-wide text-ink-500">
                    {formatDate(first.date)} — {formatDate(last.date)}
                  </p>
                </NavLink>
              </li>
            );
          })}
        </ul>

        <div className="mt-16 pb-28">
          <NavLink
            href="/writing"
            className="font-sans text-[13px] font-medium text-ink-700 transition-opacity duration-300 hover:opacity-60"
          >
            ← 全部文章
          </NavLink>
        </div>
      </div>
    </div>
  );
}
