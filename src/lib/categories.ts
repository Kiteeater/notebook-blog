/**
 * 分类的集中定义。
 *
 * content 目录的物理结构决定分类：`blog-content/<key>/xxx.md` → category = <key>。
 * 这里只负责把 key 翻译成展示给用户的文案，以及暴露分类的有序列表给 UI。
 *
 * 不要在组件里硬编码中文文案——一律走 `categoryLabel`。
 */

export type CategoryKey = "daily-paper" | "tech" | "musings";

export const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "daily-paper", label: "Daily Paper" },
  { key: "tech", label: "Engineering" },
  { key: "musings", label: "Musings" },
];

/** 把 category key 翻译成显示文案；未知值原样返回，缺省返回「未分类」。 */
export function categoryLabel(key?: string): string {
  if (!key) return "未分类";
  const found = CATEGORIES.find((c) => c.key === key);
  return found ? found.label : key;
}
