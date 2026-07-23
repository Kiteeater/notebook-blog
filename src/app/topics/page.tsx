import NavLink from "@/components/shell/NavLink";
import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";
import { formatDate } from "@/lib/format";
import { getTopics } from "@/lib/posts";
import type { Topic } from "@/lib/types";

export const metadata = {
  title: "Topics",
  description: "按主题浏览：分类与标签的有序索引。",
};

function TopicRow({ topic }: { topic: Topic }) {
  return (
    <li data-enter className="border-b" style={{ borderColor: "var(--hairline)" }}>
      <NavLink
        href={`/writing?topic=${encodeURIComponent(topic.name)}`}
        className="group flex items-baseline justify-between gap-6 py-5 sm:py-6"
        ariaLabel={`浏览主题 ${topic.name}，共 ${topic.count} 篇`}
      >
        <span className="nav-swap font-sans text-[clamp(1.5rem,3.6vw,2.6rem)] font-medium leading-tight tracking-tight text-ink-950">
          <span className="swap-a">{topic.name}</span>
          <span className="swap-b" aria-hidden="true">
            {topic.name}
          </span>
        </span>
        <span className="flex shrink-0 items-baseline gap-6 font-sans text-[12px] tracking-wide text-ink-500">
          <span>{topic.count} 篇</span>
          <span className="hidden sm:inline">更新于 {formatDate(topic.latest)}</span>
        </span>
      </NavLink>
    </li>
  );
}

export default function TopicsPage() {
  const { categories, tags } = getTopics();

  return (
    <div data-page="topics" className="relative">
      <ScrollDrift />
      <TopVeil />
      <header className="mx-auto max-w-[880px] px-6 pt-28 sm:pt-36">
        <p data-enter className="eyebrow">
          主题索引
        </p>
        <h1
          data-enter
          className="mt-6 font-sans text-[clamp(2.3rem,6vw,4.2rem)] font-medium leading-none tracking-[-0.03em] text-ink-950"
        >
          Topics
        </h1>
      </header>

      <main className="mx-auto max-w-[880px] px-6 pb-32">
        <section className="mt-16">
          <h2 data-enter className="eyebrow mb-4">
            分类
          </h2>
          <ul>
            {categories.map((t) => (
              <TopicRow key={t.name} topic={t} />
            ))}
          </ul>
        </section>

        <section className="mt-20">
          <h2 data-enter className="eyebrow mb-4">
            标签
          </h2>
          <ul>
            {tags.map((t) => (
              <TopicRow key={t.name} topic={t} />
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
}
