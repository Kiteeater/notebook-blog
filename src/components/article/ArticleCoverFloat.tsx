"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { sceneState } from "@/lib/sceneState";

/**
 * 文章封面「干燥阳光」3D：
 * - 不再用水中浮力（bob / 水流扰动）——详情页已上岸
 * - 用极轻的视角倾斜 + 呼吸缩放，模拟纸面被斜阳照着时的体积感
 * - 鼠标驱动 rotateX/Y（视差），滚动微仰俯；全程无 liquify 语义
 * 桌面 + 非 reduced-motion 才启动；否则封面静态。
 */
export default function ArticleCoverFloat({ children }: { children: ReactNode }) {
  const shellRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const shell = shellRef.current;
    const face = faceRef.current;
    if (!shell || !face) return;
    if (
      sceneState.reduced ||
      !window.matchMedia("(min-width: 768px)").matches ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let raf = 0;
    let rx = 0;
    let ry = 0;
    let sc = 1;

    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;

      const t = sceneState.time;
      // 目标：鼠标视差（幅度克制）+ 滚动微仰 + 极慢呼吸
      const targetRy = sceneState.mouseX * 4.2;
      const targetRx =
        -sceneState.mouseY * 3.2 +
        Math.max(-2.2, Math.min(2.2, sceneState.scrollVel * -5));
      const breathe = 1 + Math.sin(t * 0.35) * 0.004;

      // 低通：纸面有质量，不跟手抖
      rx += (targetRx - rx) * 0.06;
      ry += (targetRy - ry) * 0.06;
      sc += (breathe - sc) * 0.08;

      face.style.transform =
        `rotateX(${rx.toFixed(3)}deg) rotateY(${ry.toFixed(3)}deg) ` +
        `scale(${sc.toFixed(4)})`;
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      face.style.transform = "";
    };
  }, []);

  return (
    <div
      ref={shellRef}
      className="article-cover-shell"
      style={{ perspective: "1100px" }}
    >
      <div
        ref={faceRef}
        className="article-cover-face will-change-transform"
        style={{ transformStyle: "preserve-3d" }}
      >
        {children}
      </div>
    </div>
  );
}
