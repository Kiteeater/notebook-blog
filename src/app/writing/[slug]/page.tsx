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

  return (
    <div data-page="article" className="relative">
      <ScrollDrift />
      <ArticleEnhance />
      <TopVeil />

      {/* 文章头 */}
      <header className="mx-auto max-w-[760px] px-6 pt-28 sm:pt-36">
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

      {/* 头图：轻浮力，把「悬浮在水中」延续到详情页 */}
      <figure
        data-enter
        className="mx-auto mt-12 max-w-[880px] overflow-hidden rounded-[6px] px-0 sm:mx-6 lg:mx-auto"
      >
        <ArticleCoverFloat>
          <CoverArt
            slug={post.slug}
            category={post.category}
            className="block aspect-[2/1] w-full"
          />
        </ArticleCoverFloat>
      </figure>

      {/* 正文 + TOC */}
      <div className="mx-auto mt-16 max-w-[1080px] px-6 sm:mt-20 xl:grid xl:grid-cols-[minmax(0,720px)_220px] xl:justify-center xl:gap-20">
        <article
          data-enter
          className="prose-article min-w-0 rounded-[10px] bg-paper-50/82 px-8 py-2 -mx-8 backdrop-blur-[3px]"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />

        {post.headings.length > 1 && (
          <aside className="hidden xl:block">
            <nav aria-label="目录" className="sticky top-32">
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
        className="mx-auto mt-24 grid max-w-[720px] grid-cols-1 gap-px px-6 pb-28 sm:grid-cols-2"
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
    </div>
  );
}
