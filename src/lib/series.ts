import { getAllPosts } from "./posts";
import type { PostMeta, Series, SeriesContext } from "./types";

/**
 * 系列聚合：纯函数，输入是 getAllPosts() 的快照。
 *
 * 数据单一来源 = 文章 front-matter（series / seriesTitle）。
 * 顺序 = 系列内文章按 date 升序；part 号 = 升序中的 1-based 序号。
 * 系列展示文案（title / description）取首篇（升序最早）的声明，
 * 这样后续新文章追加到系列末尾时，系列对外文案稳定不变。
 */

/** 按系列 key 分组，组内按 date 升序。返回值不排序。 */
function groupBySeries(posts: PostMeta[]): Map<string, PostMeta[]> {
  const map = new Map<string, PostMeta[]>();
  for (const p of posts) {
    if (!p.series) continue;
    const arr = map.get(p.series);
    if (arr) arr.push(p);
    else map.set(p.series, [p]);
  }
  for (const arr of map.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }
  return map;
}

/**
 * 所有系列：组内升序，系列间按首篇 date 倒序（最新的系列排前面）。
 * title / description 取首篇（升序最早）的声明。
 */
export function getAllSeries(): Series[] {
  const groups = groupBySeries(getAllPosts());
  const series: Series[] = [];
  for (const [key, posts] of groups) {
    if (posts.length === 0) continue;
    const first = posts[0];
    series.push({
      key,
      title: first.seriesTitle ?? key,
      description: first.description,
      posts,
    });
  }
  return series.sort((a, b) => (a.posts[0].date < b.posts[0].date ? 1 : -1));
}

/** 给定系列 key → 升序文章列表。找不到返回空数组。 */
export function getSeriesPosts(seriesKey: string): PostMeta[] {
  const groups = groupBySeries(getAllPosts());
  return groups.get(seriesKey) ?? [];
}

/** 给定文章 slug → 在系列中的位置与相邻篇。不在任何系列里返回 null。 */
export function getSeriesContext(slug: string): SeriesContext | null {
  const groups = groupBySeries(getAllPosts());
  for (const [key, posts] of groups) {
    const index = posts.findIndex((p) => p.slug === slug);
    if (index === -1) continue;
    const first = posts[0];
    const series: Series = {
      key,
      title: first.seriesTitle ?? key,
      description: first.description,
      posts,
    };
    return {
      series,
      index,
      total: posts.length,
      prevInSeries: index > 0 ? posts[index - 1] : null,
      nextInSeries: index < posts.length - 1 ? posts[index + 1] : null,
    };
  }
  return null;
}
