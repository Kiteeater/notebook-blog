import WritingIndex from "@/components/writing/WritingIndex";
import { getAllPosts } from "@/lib/posts";

export const metadata = {
  title: "Selected Writing",
  description: "编程、AI、系统设计与个人思考的完整索引。",
};

export default async function WritingPage({
  searchParams,
}: {
  searchParams: Promise<{ topic?: string }>;
}) {
  const posts = getAllPosts();
  const { topic } = await searchParams;

  const counts = new Map<string, number>();
  for (const p of posts) {
    if (p.category) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <WritingIndex posts={posts} categories={categories} initialTopic={topic} />
  );
}
