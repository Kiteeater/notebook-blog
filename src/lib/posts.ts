import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import type { Heading, Post, PostMeta, Topic } from "./types";

// In the notebook repo, published Markdown lives beside the app. A standalone
// deployment export places the same files in the app's local `content` folder.
const SIBLING_CONTENT_DIR = path.resolve(process.cwd(), "..", "blog-content");
const CONTENT_DIR = fs.existsSync(SIBLING_CONTENT_DIR)
  ? SIBLING_CONTENT_DIR
  : path.join(process.cwd(), "content");

function ensureDir() {
  if (!fs.existsSync(CONTENT_DIR)) {
    fs.mkdirSync(CONTENT_DIR, { recursive: true });
  }
}

/** 读取所有文章的元数据，按日期倒序 */
export function getAllPosts(): PostMeta[] {
  ensureDir();
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, "");
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const { data } = matter(raw);
    return {
      slug,
      title: (data.title as string) ?? slug,
      description: (data.description as string) ?? "",
      date: (data.date as string) ?? "1970-01-01",
      tags: (data.tags as string[]) ?? [],
      category: data.category as string | undefined,
      readingTime: data.readingTime as string | undefined,
    } satisfies PostMeta;
  });

  return posts.sort((a, b) => (a.date < b.date ? 1 : -1));
}

function slugifyHeading(text: string, used: Set<string>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section";
  let id = base;
  let i = 2;
  while (used.has(id)) id = `${base}-${i++}`;
  used.add(id);
  return id;
}

/**
 * 后处理渲染出的 HTML：
 * 1. 为 h2/h3 注入 id 并提取 TOC
 * 2. 将 pre>code 包装为带语言标签与复制按钮的代码块
 */
function processHtml(html: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Set<string>();

  let out = html.replace(
    /<h([23])>([\s\S]*?)<\/h\1>/g,
    (_m, level: string, inner: string) => {
      const text = inner.replace(/<[^>]+>/g, "");
      const id = slugifyHeading(text, used);
      headings.push({ id, text, level: Number(level) as 2 | 3 });
      return `<h${level} id="${id}">${inner}</h${level}>`;
    },
  );

  out = out.replace(
    /<pre><code(?:\s+class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g,
    (m, lang: string | undefined) => {
      const label = lang ?? "text";
      return `<div class="codeblock"><div class="codeblock-bar"><span class="codeblock-lang">${label}</span><button type="button" class="codeblock-copy" data-copy-btn aria-label="复制代码">复制</button></div>${m}</div>`;
    },
  );

  // 图片懒加载 + 防布局抖动
  out = out.replace(/<img\s/g, '<img loading="lazy" decoding="async" ');

  return { html: out, headings };
}

/** 读取单篇文章并渲染为 HTML */
export async function getPost(slug: string): Promise<Post | null> {
  ensureDir();
  const file = path.join(CONTENT_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;

  const raw = fs.readFileSync(file, "utf8");
  const { data, content } = matter(raw);

  const processed = await remark()
    .use(remarkGfm)
    .use(remarkHtml)
    .process(content);

  const { html, headings } = processHtml(processed.toString());

  return {
    slug,
    title: (data.title as string) ?? slug,
    description: (data.description as string) ?? "",
    date: (data.date as string) ?? "1970-01-01",
    tags: (data.tags as string[]) ?? [],
    category: data.category as string | undefined,
    readingTime: data.readingTime as string | undefined,
    contentHtml: html,
    headings,
  };
}

/** 上一篇 / 下一篇（按日期倒序中的相邻项） */
export function getAdjacentPosts(slug: string): {
  prev: PostMeta | null;
  next: PostMeta | null;
} {
  const posts = getAllPosts();
  const i = posts.findIndex((p) => p.slug === slug);
  return {
    prev: i > 0 ? posts[i - 1] : null,
    next: i >= 0 && i < posts.length - 1 ? posts[i + 1] : null,
  };
}

/** 聚合分类与标签为主题索引 */
export function getTopics(): { categories: Topic[]; tags: Topic[] } {
  const posts = getAllPosts();
  const categories = new Map<string, Topic>();
  const tags = new Map<string, Topic>();

  const bump = (map: Map<string, Topic>, name: string, date: string) => {
    const t = map.get(name);
    if (t) {
      t.count += 1;
      if (date > t.latest) t.latest = date;
    } else {
      map.set(name, { name, count: 1, latest: date });
    }
  };

  for (const p of posts) {
    if (p.category) bump(categories, p.category, p.date);
    for (const t of p.tags) bump(tags, t, p.date);
  }

  const byCount = (a: Topic, b: Topic) =>
    b.count - a.count || (a.latest < b.latest ? 1 : -1);
  return {
    categories: [...categories.values()].sort(byCount),
    tags: [...tags.values()].sort(byCount),
  };
}

/** 估算阅读时长 */
export function estimateReadingTime(text: string): string {
  const words = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.round(words / 200));
  return `${minutes} min read`;
}
