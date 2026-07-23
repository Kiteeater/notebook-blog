import { getAllPosts } from "@/lib/posts";

export const dynamic = "force-static";

const SITE_URL = "https://kiteeater.vercel.app";
const SITE_TITLE = "思考的碎片 — Pieces of Memory";
const SITE_DESC = "一个关于编程、AI、系统设计与个人思考的个人研究观测站。";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const posts = getAllPosts();

  const items = posts
    .map(
      (p) => `
    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${SITE_URL}/writing/${p.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/writing/${p.slug}</guid>
      <description>${escapeXml(p.description)}</description>
      <pubDate>${new Date(p.date).toUTCString()}</pubDate>
      ${p.tags.map((t) => `<category>${escapeXml(t)}</category>`).join("\n      ")}
    </item>`,
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${escapeXml(SITE_TITLE)}</title>
    <link>${SITE_URL}</link>
    <description>${escapeXml(SITE_DESC)}</description>
    <language>zh-CN</language>
    ${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
