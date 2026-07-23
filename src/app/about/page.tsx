import ScrollDrift from "@/components/shell/ScrollDrift";
import TopVeil from "@/components/shell/TopVeil";

export const metadata = {
  title: "About",
  description: "关于这个观测站：写作动机与联系入口。",
};

export default function AboutPage() {
  return (
    <div data-page="about" className="relative">
      <ScrollDrift />
      <TopVeil />
      <main className="mx-auto max-w-[760px] px-6 pb-32 pt-28 sm:pt-36">
        <p data-enter className="eyebrow">
          About
        </p>

        {/* 引语式介绍 */}
        <h1
          data-enter
          className="mt-10 font-display text-[clamp(1.7rem,4.2vw,2.9rem)] font-medium italic leading-[1.4] tracking-tight text-ink-950"
        >
          「自由是意志。行动是能力。
          <br />
          勇气是随时间不衰减的信念。」
        </h1>

        <div data-enter className="prose-article mt-14">
          <p>
            这是我的个人博客，一个收存思考碎片的地方。我写编程、Agent
            开发、设计，偶尔写生活。
          </p>
          <p>
            我相信动手胜过死记，真实胜过完整。这里的每一篇，都是某个时刻思维的切片——可能粗糙，但都是真的。
          </p>
          <p>
            这个站点本身也是一篇文章：用 Next.js
            从零搭建，排版、留白、动效，每一个选择都是在回答「我是个什么样的写作者」。
          </p>
        </div>

        {/* 联系与订阅 */}
        <section data-enter className="mt-20">
          <h2 className="eyebrow mb-2">Elsewhere</h2>
          <ul className="font-sans text-[15px]">
            <li
              className="flex items-baseline justify-between border-b py-4"
              style={{ borderColor: "var(--hairline)" }}
            >
              <a
                href="/rss.xml"
                className="font-medium text-ink-950 transition-opacity hover:opacity-60"
              >
                RSS
              </a>
              <span className="text-[12px] text-ink-500">订阅本站</span>
            </li>
            <li
              className="flex items-baseline justify-between border-b py-4"
              style={{ borderColor: "var(--hairline)" }}
            >
              <span className="font-medium text-ink-950">GitHub</span>
              <span className="text-[12px] text-ink-500">[待替换：GitHub 链接]</span>
            </li>
            <li
              className="flex items-baseline justify-between border-b py-4"
              style={{ borderColor: "var(--hairline)" }}
            >
              <span className="font-medium text-ink-950">X / Twitter</span>
              <span className="text-[12px] text-ink-500">[待替换：X 链接]</span>
            </li>
            <li
              className="flex items-baseline justify-between border-b py-4"
              style={{ borderColor: "var(--hairline)" }}
            >
              <span className="font-medium text-ink-950">Email</span>
              <span className="text-[12px] text-ink-500">[待替换：邮箱地址]</span>
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
