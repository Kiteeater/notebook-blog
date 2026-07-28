"use client";

import { useEffect, useRef, type RefObject } from "react";
import { sceneState } from "@/lib/sceneState";

/**
 * DOM 级「浮力场」——把背景 shader 的水感延伸到内容层。
 *
 * 单一 rAF 驱动每个 [data-buoyant] 子元素合成 transform：
 * idle 上下浮 + 缓慢摆动 + 前后景深（translateZ/opacity）+ 鼠标水流扰动（双层阻尼）
 * + 标题区弧形压缩（原 lens 逻辑并入，保留「越过雾线不重置」语义）。
 *
 * 关键：只写内层 .buoyant 的 transform，绝不碰外层 [data-enter] 元素——
 * GSAP 入场动 [data-enter]，浮力动内层 .buoyant，作用元素不同，互不干扰。
 *
 * 桌面 + 非 reduced-motion 才启动；移动端 / reduced 下卡片静态。
 */

type Props = {
  /** 容器 ref（调用者已有元素的 ref）；浮力场在其中收集 [data-buoyant] */
  containerRef: RefObject<HTMLElement | null>;
  /** 固定标题区 ref，用于派生 lens 压缩区 */
  headerRef?: RefObject<HTMLElement | null>;
  /** 视角（archive 满幅 / article 封面轻量）。article 时振幅减半、几乎无鼠标响应 */
  mode?: "archive" | "article";
  children: React.ReactNode;
};

type CardState = {
  el: HTMLElement;
  depth: number; // 0..1，越后越远
  phase: number; // 浮漂相位
  mDx: number; // 鼠标扰动 x（带阻尼）
  mDy: number; // 鼠标扰动 y
  applied: boolean; // 本帧是否已写 transform（用于离屏清理）
};

/** 桌面 + 非 reduced-motion 才启用浮力 */
function shouldRun() {
  return (
    !sceneState.reduced &&
    window.matchMedia("(min-width: 768px)").matches &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export default function BuoyantField({
  containerRef,
  headerRef,
  mode = "archive",
  children,
}: Props) {
  const stateRef = useRef<CardState[]>([]);

  useEffect(() => {
    if (!shouldRun()) return;
    const container = containerRef.current;
    if (!container) return;

    const light = mode === "article";
    const ampScale = light ? 0.5 : 1;
    // 鼠标响应强度：article 几乎不响应（阅读场景）
    const pushK = light ? 6 : 26;
    const damp = light ? 0.04 : 0.08;

    /** （重新）收集卡片并派生每卡配置 */
    const collect = () => {
      const nodes = Array.from(
        container.querySelectorAll<HTMLElement>("[data-buoyant]"),
      );
      const n = nodes.length || 1;
      stateRef.current = nodes.map((el, i) => {
        const prev = stateRef.current.find((c) => c.el === el);
        // 相位从 data-phase（PostCard 按 slug 写入）派生，无则用 index
        const ph = parseFloat(el.dataset.phase ?? "") || i * 0.618;
        // depth 也从 phase 派生（而非 i/(n-1)）：这样筛选重排后同一张卡的
        // 景深层稳定不变，浮漂振幅不会突变；FNV-like 残差散布较均匀。
        const h = (Math.imul(((ph * 1e6) | 0) || 1, 2654435761) >>> 0);
        const depth = nodes.length > 1 ? (h % 1000) / 1000 : 0.5;
        return {
          el,
          depth,
          phase: ph,
          mDx: prev?.mDx ?? 0,
          mDy: prev?.mDy ?? 0,
          applied: false,
        };
      });
    };
    collect();

    // 筛选重排后 React 重建卡片，自动重收集（保留仍在场卡片的扰动状态）
    const mo = new MutationObserver(() => collect());
    mo.observe(container, { childList: true, subtree: true });

    const Z_FRONT = light ? 0 : 40;
    const Z_BACK = light ? -40 : -220;

    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (document.hidden) return;
      const t = sceneState.time;
      const mx = sceneState.mouseX;
      const my = sceneState.mouseY;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // lens 压缩区：固定标题底部以下
      const zone =
        (headerRef?.current?.getBoundingClientRect().bottom ?? 240) + 8;
      const range = 210;

      for (const c of stateRef.current) {
        const el = c.el;
        const rect = el.getBoundingClientRect();
        // 视口外暂停（保留已有 transform，不重置）
        if (rect.bottom < -80 || rect.top > vh + 80) {
          if (c.applied) {
            el.style.willChange = "auto";
            c.applied = false;
          }
          continue;
        }
        if (!c.applied) {
          el.style.willChange = "transform";
          c.applied = true;
        }

        const amp = (1 - c.depth * 0.55) * ampScale; // 前景大、后景小

        // idle 漂浮 + 摆动
        const bob =
          Math.sin(t * (0.5 + 0.3 * c.depth) + c.phase) * amp * 6;
        const sway = Math.sin(t * 0.27 + c.phase * 1.3) * amp * 4;
        const rotZ = Math.sin(t * 0.2 + c.phase) * 0.6 * amp;

        // 鼠标水流扰动：卡片中心到光标的归一化向量，越近权重越大
        const cx = (rect.left + rect.width * 0.5) / vw - 0.5;
        const cy = (rect.top + rect.height * 0.5) / vh - 0.5;
        const dx = cx - mx * 0.5;
        const dy = cy - my * 0.5;
        const near = Math.exp(-(dx * dx + dy * dy) * 2.4); // 0..1，越近越大
        const w = near * (1 - c.depth * 0.4); // 远处卡迟钝
        let tx = -dx * pushK * w;
        let ty = -dy * pushK * w;
        // 顺流拖：鼠标速度向量叠加进位移方向（不只是被「推开」，还被水流顺向带走）
        tx += sceneState.mouseVX * pushK * w * 1.4;
        ty += sceneState.mouseVY * pushK * w * 1.4;
        c.mDx += (tx - c.mDx) * damp; // 卡片级低通 = 拖拽+惯性
        c.mDy += (ty - c.mDy) * damp;

        // 标题区弧形压缩（原 lens 逻辑，保留越过雾线不重置：k 一旦 >0 不回零）
        let k = Math.min(1, Math.max(0, (zone + range - rect.top) / range));
        k = k * k * (3 - 2 * k);
        const lensY = -17 * k;
        const lensScaleY = 1 - 0.09 * k;
        const lensRotX = 4.6 * k;
        // 滚动惯性仰俯：向下滚卡片向上仰（水中惯性），限幅 ±6°；ampScale 让 article 弱响应
        const scrollTilt = Math.max(-6, Math.min(6, sceneState.scrollVel * -12)) * ampScale;

        const z = Z_FRONT + (Z_BACK - Z_FRONT) * c.depth;

        el.style.transform =
          `translate3d(${(sway + c.mDx).toFixed(2)}px, ` +
          `${(bob + c.mDy + lensY).toFixed(2)}px, ${z.toFixed(1)}px) ` +
          `rotateZ(${rotZ.toFixed(3)}deg) rotateX(${(lensRotX + scrollTilt).toFixed(2)}deg) ` +
          `scaleY(${lensScaleY.toFixed(4)})`;
        // 景深 DOF：opacity 加重衰减（远景到 ~0.58）；远景封面轻 blur（通过 --dof
        // 变量作用于 .cover-media，不糊标题文字）。depth ≤ 0.6 不 blur。
        el.style.opacity = (1 - c.depth * 0.42).toFixed(3);
        const dof = c.depth > 0.6 ? (c.depth - 0.6) * 3 : 0;
        el.style.setProperty("--dof", `${dof.toFixed(2)}px`);
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      mo.disconnect();
      // 卸载时清掉浮力写入，回到 CSS 静态态
      for (const c of stateRef.current) {
        c.el.style.transform = "";
        c.el.style.opacity = "";
        c.el.style.willChange = "";
        c.el.style.removeProperty("--dof");
      }
      stateRef.current = [];
    };
  }, [containerRef, headerRef, mode]);

  // 不包裹 DOM：BuoyantField 仅作 effect 驱动器，渲染时被放进调用者已有的
  // 网格/容器内部（containerRef 指向那个容器）。避免引入额外层、保持透视上下文。
  return <>{children}</>;
}
