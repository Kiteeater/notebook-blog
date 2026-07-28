"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 水下感 segmented control —— unseen.co 式胶囊切换。
 *
 * 交互：
 * - 当前选中项为白色实心胶囊（深底）或墨色实心（浅底），未选中为透明描边。
 * - 选中态用绝对定位的「滑块」平移实现平滑互换（layoutEffect 测量位置）。
 * - 切换内容非瞬间替换：旧内容快淡出（opacity + 上移 + 轻模糊），
 *   新内容带延迟从下方浮上（像信息在水中浮起）。
 * - tab 字本身随 hover 产生轻水流位移（由 globals.css 的 .segmented-tab-hover 驱动）。
 *
 * 可复用：tabs 为任意 {id,label} 数组，内容由 children-by-active 渲染函数提供。
 */

export type SegmentedTab = {
  id: string;
  label: string;
};

type Props = {
  tabs: SegmentedTab[];
  /** 默认激活 tab id */
  defaultId?: string;
  /** 受控模式（可选）；不传则内部自管理 */
  activeId?: string;
  onChange?: (id: string) => void;
  /** 每个激活 tab 对应的内容节点 */
  renderContent: (activeId: string) => React.ReactNode;
  /** aria-label */
  label?: string;
};

export default function SegmentedControl({
  tabs,
  defaultId,
  activeId: controlled,
  onChange,
  renderContent,
  label,
}: Props) {
  const [internal, setInternal] = useState(defaultId ?? tabs[0]?.id ?? "");
  const activeId = controlled ?? internal;

  const setActive = useCallback(
    (id: string) => {
      if (controlled === undefined) setInternal(id);
      onChange?.(id);
    },
    [controlled, onChange],
  );

  // 选中滑块定位
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);

  const measure = useCallback(() => {
    const idx = tabs.findIndex((t) => t.id === activeId);
    const el = tabRefs.current[idx];
    const parent = el?.parentElement;
    if (!el || !parent) return;
    const pr = parent.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    setThumb({ x: er.left - pr.left, w: er.width });
  }, [activeId, tabs]);

  useEffect(() => {
    measure();
  }, [measure]);

  // 窗口尺寸变化、字体加载后重测
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    const parent = tabRefs.current.find(Boolean)?.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [measure]);

  // crossfade：activeId 变化时用 key 强制重挂载，CSS 动画接管浮上
  // direction 不追踪（左右切都统一「浮上」语义，更克制）
  return (
    <div className="segmented-block">
      <div
        role="tablist"
        aria-label={label}
        className="segmented relative inline-flex items-center gap-1 rounded-full p-1"
      >
        {/* 选中滑块 */}
        {thumb && (
          <span
            aria-hidden="true"
            className="segmented-thumb"
            style={{
              transform: `translateX(${thumb.x.toFixed(2)}px)`,
              width: `${thumb.w.toFixed(2)}px`,
            }}
          />
        )}
        {tabs.map((t, i) => {
          const active = t.id === activeId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[i] = el;
              }}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setActive(t.id)}
              data-active={active}
              className="segmented-tab relative z-10 rounded-full font-sans text-[13px] font-medium transition-colors duration-500 ease-observatory"
            >
              <span className="segmented-tab-label">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* 内容：key 切换 → 重挂载 → CSS 浮上动画 */}
      <div className="segmented-content mt-8">
        <div key={activeId} data-fade-in className="segmented-pane">
          {renderContent(activeId)}
        </div>
      </div>
    </div>
  );
}
