export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string; // ISO yyyy-mm-dd
  tags: string[];
  category?: string;
  readingTime?: string;
  /**
   * 系列 key（slug-safe，如 "kimi-k3"）。
   * 同一 key 的文章按 date 升序组成有序集合。
   * 正交于 category：category 横向分类，series 纵向串文章。
   */
  series?: string;
  /** 系列展示名（如 "Kimi K3 架构全解"）。系列内任一篇声明即可，以最早一篇为准。 */
  seriesTitle?: string;
};

export type Heading = {
  id: string;
  text: string;
  level: 2 | 3;
};

export type Post = PostMeta & {
  contentHtml: string;
  headings: Heading[];
};

/**
 * 一个系列：由多篇文章按 date 升序组成的有序集合。
 * title / description 取首篇（升序最早）的声明，作为系列的对外展示文案。
 */
export type Series = {
  key: string;
  title: string;
  description: string;
  posts: PostMeta[];
};

/** 给定文章在系列中的位置与相邻篇。 */
export type SeriesContext = {
  series: Series;
  /** 0-based 序号 */
  index: number;
  total: number;
  prevInSeries: PostMeta | null;
  nextInSeries: PostMeta | null;
};
