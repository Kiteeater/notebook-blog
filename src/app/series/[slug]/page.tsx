import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NavLink from "@/components/shell/NavLink";
import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";
import CoverArt from "@/components/writing/CoverArt";
import { formatDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { getAllSeries, getSeriesPosts } from "@/lib/series";

export function generateStaticParams() {
  return getAllSeries().map((s) => ({ slug: s.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const posts = getSeriesPosts(slug);
  if (posts.length === 0) return {};
  const first = posts[0];
  const title = first.seriesTitle ?? slug;
  return {
    title: `${title} · Series`,
    description: first.description,
  };
}

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const posts = getSeriesPosts(slug);
  if (posts.length === 0) notFound();

  const first = posts[0];
  const title = first.seriesTitle ?? slug;
  const description = first.description;

  return (
    <div data-page="series" className="relative">
      <ScrollDrift />
      <TopVeil tone="sun" />

      {/* 系列头：复用文章页排版骨架 */}
      <header className="mx-auto max-w-[760px] px-6 pt-28 sm:pt-36">
        <p data-enter className="eyebrow">
          Series · {posts.length} 篇
        </p>
        <h1
          data-enter
          className="mt-6 font-display text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.15] tracking-[-0.015em] text-ink-950"
        >
          {title}
        </h1>
        {description && (
          <p
            data-enter
            className="mt-6 font-serif text-[1.15rem] italic leading-relaxed text-ink-600"
          >
            {description}
          </p>
        )}
        {/*
          首篇封面：作为系列的视觉锚点。
          单篇时也合理——相当于该篇的强化展示。
        */}
        <figure data-enter className="article-cover-frame mt-12 w-full">
          <CoverArt
            slug={first.slug}
            category={first.category}
            className="block aspect-[2/1] w-full overflow-hidden rounded-[6px]"
          />
        </figure>
      </header>

      {/* 系列目录：每行 part 号 · 分类 · 日期 · 标题 */}
      <div className="mx-auto mt-16 w-full max-w-[760px] px-6 sm:mt-20">
        <ol className="series-toc">
          {posts.map((p, i) => (
            <li
              key={p.slug}
              data-enter
              className="border-t py-5"
              style={{ borderColor: "var(--hairline)" }}
            >
              <NavLink
                href={`/writing/${p.slug}`}
                className="group flex items-baseline gap-4"
              >
                <span className="font-sans text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500 tabular-nums">
                  Part {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-[1.2rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 group-hover:opacity-60">
                    {p.title}
                  </span>
                  <span className="mt-1 block font-sans text-[12px] tracking-wide text-ink-500">
                    {categoryLabel(p.category)} · {formatDate(p.date)}
                    {p.readingTime ? ` · ${p.readingTime}` : ""}
                  </span>
                </span>
              </NavLink>
            </li>
          ))}
        </ol>

        {/* 返回写作索引 */}
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
