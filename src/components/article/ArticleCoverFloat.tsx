"use client";

import { useRef, type ReactNode } from "react";
import BuoyantField from "@/components/writing/BuoyantField";

/**
 * 文章封面图轻浮力：把「水中悬浮」的微弱漂浮感延续到详情页（图片而非文字，
 * 是氛围而非干扰）。amp 减半、几乎不响应鼠标，呼应「比 archive 更深、更强漂浮」。
 * 桌面 + 非 reduced-motion 才启动；否则封面静态。
 */
export default function ArticleCoverFloat({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={containerRef}>
      <BuoyantField containerRef={containerRef} mode="article">
        <div className="buoyant" data-buoyant data-phase={0.31}>
          {children}
        </div>
      </BuoyantField>
    </div>
  );
}
