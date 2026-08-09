import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticleEnhance from "@/components/article/ArticleEnhance";
import ArticleCoverFloat from "@/components/article/ArticleCoverFloat";
import NavLink from "@/components/shell/NavLink";
import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";
import CoverArt from "@/components/writing/CoverArt";
import { formatDate } from "@/lib/format";
import { categoryLabel } from "@/lib/categories";
import { getAdjacentPosts, getAllPosts, getPost } from "@/lib/posts";
import { getSeriesContext } from "@/lib/series";

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};
  return { title: post.title, description: post.description };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();
  const { prev, next } = getAdjacentPosts(slug);
  const seriesCtx = getSeriesContext(slug);

  return (
    <div data-page="article" className="relative">
      <ScrollDrift />
      <ArticleEnhance />
      <TopVeil tone="sun" />

      {/* 文章头：上岸后的编辑式开场，无液体语义 */}
      <header className="mx-auto max-w-[760px] px-6 pt-28 sm:pt-36">
        {seriesCtx && (
          <NavLink
            href={`/series/${seriesCtx.series.key}`}
            ariaLabel={`查看系列：${seriesCtx.series.title}`}
            className="series-strip group/series mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-ink-700 transition-colors duration-500"
            style={{ borderColor: "var(--hairline)" }}
          >
            <span className="text-ink-500">Series</span>
            <span className="text-ink-400">·</span>
            <span className="normal-case tracking-normal text-ink-900">
              {seriesCtx.series.title}
            </span>
            <span className="text-ink-400">·</span>
            <span className="tabular-nums text-ink-500">
              {seriesCtx.index + 1} / {seriesCtx.total}
            </span>
          </NavLink>
        )}
        <p data-enter className="eyebrow">
          {categoryLabel(post.category)} · {formatDate(post.date)}
        </p>
        <h1
          data-enter
          className="mt-6 font-display text-[clamp(2rem,5vw,3.4rem)] font-medium leading-[1.15] tracking-[-0.015em] text-ink-950"
        >
          {post.title}
        </h1>
        {post.description && (
          <p
            data-enter
            className="mt-6 font-serif text-[1.15rem] italic leading-relaxed text-ink-600"
          >
            {post.description}
          </p>
        )}
        <div
          data-enter
          className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t pt-5 font-sans text-[12px] tracking-wide text-ink-500"
          style={{ borderColor: "var(--hairline)" }}
        >
          {post.readingTime && <span>{post.readingTime}</span>}
          {post.tags.map((t) => (
            <span key={t}>#{t}</span>
          ))}
        </div>
      </header>

      {/* 头图：阳光纸面 3D 倾斜（干燥，非水中浮力） */}
      <figure
        data-enter
        className="article-cover-frame mx-auto mt-12 w-full max-w-[760px] px-6"
      >
        <ArticleCoverFloat>
          <CoverArt
            slug={post.slug}
            category={post.category}
            className="block aspect-[2/1] w-full overflow-hidden rounded-[6px]"
          />
        </ArticleCoverFloat>
      </figure>

      {/*
        正文严格居中；目录绝对定位到阅读栏右侧，
        避免 xl 双栏 grid 把正文整体往左顶偏。
        纸面：暖白半透明 + 极轻暖阴影，透出背景阳光，无毛玻璃水感。
      */}
      <div className="relative mx-auto mt-16 w-full max-w-[760px] px-6 sm:mt-20">
        <article
          data-enter
          className="prose-article article-sheet min-w-0 rounded-[10px] px-5 py-2 sm:px-8 sm:-mx-2"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {post.headings.length > 1 && (
          <aside className="pointer-events-none absolute left-full top-0 bottom-0 hidden w-[200px] pl-12 xl:block">
            <nav
              aria-label="目录"
              className="pointer-events-auto sticky top-32 max-h-[calc(100dvh-10rem)] overflow-y-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <p className="eyebrow mb-4">目录</p>
              {post.headings.map((h) => (
                <a
                  key={h.id}
                  href={`#${h.id}`}
                  data-toc-link={h.id}
                  data-active="false"
                  className="toc-link"
                  style={h.level === 3 ? { paddingLeft: "2rem" } : undefined}
                >
                  {h.text}
                </a>
              ))}
            </nav>
          </aside>
        )}
      </div>

      {/* 上一篇 / 下一篇：编辑式导航 */}
      <nav
        aria-label="文章导航"
        className="mx-auto mt-24 grid max-w-[760px] grid-cols-1 gap-px px-6 pb-28 sm:grid-cols-2"
      >
        <div
          className="border-t pt-6 sm:pr-8"
          style={{ borderColor: "var(--hairline)" }}
        >
          {prev && (
            <>
              <p className="eyebrow mb-3">← 上一篇</p>
              <NavLink
                href={`/writing/${prev.slug}`}
                className="font-display text-[1.25rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 hover:opacity-60"
              >
                {prev.title}
              </NavLink>
            </>
          )}
        </div>
        <div
          className="border-t pt-6 sm:border-l sm:pl-8 sm:text-right"
          style={{ borderColor: "var(--hairline)" }}
        >
          {next && (
            <>
              <p className="eyebrow mb-3">下一篇 →</p>
              <NavLink
                href={`/writing/${next.slug}`}
                className="font-display text-[1.25rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 hover:opacity-60"
              >
                {next.title}
              </NavLink>
            </>
          )}
        </div>
      </nav>

      {/*
        系列内导航：仅当文章属于某系列且有相邻篇时出现。
        正交于上面的全局 date 邻接导航——这里只走系列序。
      */}
      {seriesCtx && (seriesCtx.prevInSeries || seriesCtx.nextInSeries) && (
        <nav
          aria-label="系列内导航"
          className="mx-auto mt-16 max-w-[760px] px-6 pb-28"
        >
          <div
            className="border-t pt-6"
            style={{ borderColor: "var(--hairline)" }}
          >
            <p className="eyebrow mb-4">
              {seriesCtx.series.title} · 系列 · 第 {seriesCtx.index + 1} /{" "}
              {seriesCtx.total} 篇
            </p>
            <div className="grid grid-cols-1 gap-px sm:grid-cols-2">
              <div className="sm:pr-8">
                {seriesCtx.prevInSeries && (
                  <>
                    <p className="eyebrow mb-3">← 系列上一篇</p>
                    <NavLink
                      href={`/writing/${seriesCtx.prevInSeries.slug}`}
                      className="font-display text-[1.15rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 hover:opacity-60"
                    >
                      {seriesCtx.prevInSeries.title}
                    </NavLink>
                  </>
                )}
              </div>
              <div className="sm:border-l sm:pl-8 sm:text-right">
                {seriesCtx.nextInSeries && (
                  <>
                    <p className="eyebrow mb-3">系列下一篇 →</p>
                    <NavLink
                      href={`/writing/${seriesCtx.nextInSeries.slug}`}
                      className="font-display text-[1.15rem] font-medium leading-snug text-ink-950 transition-opacity duration-300 hover:opacity-60"
                    >
                      {seriesCtx.nextInSeries.title}
                    </NavLink>
                  </>
                )}
              </div>
            </div>
          </div>
        </nav>
      )}
    </div>
  );
}