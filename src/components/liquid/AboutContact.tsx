"use client";

import SegmentedControl, { type SegmentedTab } from "./SegmentedControl";

/**
 * About 页的联系区：New Business / General 胶囊切换 + 水下浮上 crossfade。
 *
 * SegmentedControl 负责胶囊选中滑块与内容 crossfade；
 * 本组件只提供两个 tab 的内容结构与占位联系信息（后续替换为真实地址）。
 */

const TABS: SegmentedTab[] = [
  { id: "business", label: "New Business" },
  { id: "general", label: "General" },
];

/** 单行联系信息：左侧标签（水流受感体），右侧次要说明。 */
function ContactRow({
  label,
  value,
  href,
  hint,
}: {
  label: string;
  value: string;
  href?: string;
  hint?: string;
}) {
  return (
    <li
      className="flex items-baseline justify-between border-b py-4"
      style={{ borderColor: "var(--hairline)" }}
    >
      {href ? (
        <a
          href={href}
          className="font-medium text-ink-950 transition-opacity hover:opacity-60"
        >
          {value}
        </a>
      ) : (
        <span className="font-medium text-ink-950">{value}</span>
      )}
      <span className="text-[12px] text-ink-500">{hint ?? label}</span>
    </li>
  );
}

export default function AboutContact() {
  return (
    <SegmentedControl
      tabs={TABS}
      label="联系方式"
      renderContent={(activeId) =>
        activeId === "business" ? (
          <ul className="font-sans text-[15px]">
            <ContactRow
              label="合作邮箱"
              value="hello@example.com"
              href="mailto:hello@example.com"
              hint="项目咨询 · 合作邀约"
            />
            <ContactRow
              label="GitHub"
              value="@your-handle"
              hint="代码与实验"
            />
          </ul>
        ) : (
          <ul className="font-sans text-[15px]">
            <ContactRow
              label="个人邮箱"
              value="hi@example.com"
              href="mailto:hi@example.com"
              hint="随便聊聊"
            />
            <ContactRow
              label="X / Twitter"
              value="@your-handle"
              hint="碎片想法"
            />
            <ContactRow
              label="RSS"
              value="/rss.xml"
              href="/rss.xml"
              hint="订阅本站"
            />
          </ul>
        )
      }
    />
  );
}
