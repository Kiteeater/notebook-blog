/**
 * 液体交互控制层 —— 文字水感 + 封面折射的共享配置与工具。
 *
 * 设计原则（与全站体系对齐）：
 * - 不新增鼠标追踪器，只读 sceneState（mouseX/Y、mouseVX/VY、reduced、webgl）。
 * - 不引入第二个 rAF 循环：词级推流由各元素自己的 GSAP 补间驱动，
 *   封面 displacement map 由 LiquidField 的单一 rAF 驱动。
 * - 双 gate：reduced || !webgl → 全部 no-op，回退静态。
 * - 文字 transform 上限严格：位移 ≤ 4px、skew ≤ 2°、letter-spacing ≤ 0.04em，
 *   保证「克制、轻、文字始终可读」。
 *
 * 注意：本文件被 "use client" 组件引用，含 React hook，属 client 模块。
 */

import { useEffect, useRef } from "react";
import { sceneState } from "@/lib/sceneState";


/** 是否允许液体动效（与 BuoyantField 的 shouldRun 对齐） */
export function liquidEnabled(): boolean {
  return !sceneState.reduced && sceneState.webgl;
}

/**
 * 把一个元素注册为「水流受感体」：指针进入容器时，读取鼠标瞬时方向，
 * 给内层文字一个带阻尼的轻位移 + 轻 skew，停下后弹回原位。
 *
 * 返回 cleanup，卸载时调用。
 *
 * 实现要点：
 * - 用 GSAP quickTo 建 x/y/skewX 三个补间器，overwrite 自动防止堆叠。
 * - 鼠标方向由 pointermove 差分得出（局部坐标），避免全局速度向量的延迟感。
 * - 阻尼由 quickTo 的 duration + ease 控制，天然带回弹。
 */
export function attachLiquidPush(el: HTMLElement): () => void {
  if (!liquidEnabled()) return () => {};

  // rAF 驱动的水波动 + 鼠标扰动叠加（对齐 BuoyantField 范式）。
  // 每帧输出 = idle sin 波动（缓慢低频，文字像浮在水中轻晃）
  //          + 鼠标推流扰动（带阻尼，停下衰减，离开归零）
  // 鼠标越快扰动越大；停下/离开只剩 idle 轻晃。
  // 上限严守：位移 ≤ 4px、skew ≤ 2°（克制、文字始终可读）。

  // 每个元素独立相位，避免所有字同步晃（用 slug 似的确定性 hash）
  const seed = Math.random() * Math.PI * 2;
  const freqX = 0.7 + Math.random() * 0.5; // 横向晃动频率
  const freqY = 0.5 + Math.random() * 0.4; // 纵向晃动频率（略低）
  // idle 振幅：克制，1.2px 以内——只是「活着」，不是夸张摆动
  const idleAmpX = 0.8 + Math.random() * 0.5;
  const idleAmpY = 0.6 + Math.random() * 0.4;

  // 鼠标扰动状态（带阻尼的目标值 + 当前值，每帧低通）
  let pushTX = 0;
  let pushTY = 0;
  let pushSkew = 0;
  let pushX = 0;
  let pushY = 0;
  let pushSk = 0;

  // 局部鼠标速度（差分）
  let lastX = 0;
  let lastY = 0;
  let lastT = 0;
  let active = false;

  const onMove = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    const now = e.timeStamp;
    const dt = Math.max(8, now - lastT);
    if (!active) {
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = now;
      active = true;
      return;
    }
    const vx = (e.clientX - lastX) / dt; // px/ms
    const vy = (e.clientY - lastY) / dt;
    lastX = e.clientX;
    lastY = e.clientY;
    lastT = now;

    // 速度 → 扰动目标（上限 4px / 2°）
    pushTX = Math.max(-4, Math.min(4, vx * 1.8));
    pushTY = Math.max(-4, Math.min(4, vy * 1.8));
    pushSkew = Math.max(-2, Math.min(2, vx * 0.9));
  };

  const onLeave = () => {
    active = false;
    pushTX = 0;
    pushTY = 0;
    pushSkew = 0;
  };

  el.addEventListener("pointermove", onMove, { passive: true });
  el.addEventListener("pointerleave", onLeave, { passive: true });
  el.addEventListener("pointercancel", onLeave, { passive: true });

  el.style.willChange = "transform";

  let raf = 0;
  const tick = () => {
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    const t = sceneState.time;

    // 扰动低通：升得快、落得慢（水中惯性）
    const kd = active ? 0.22 : 0.06;
    pushX += (pushTX - pushX) * kd;
    pushY += (pushTY - pushY) * kd;
    pushSk += (pushSkew - pushSk) * (active ? 0.25 : 0.07);

    // idle 水波动 + 鼠标扰动叠加
    const x = Math.sin(t * freqX + seed) * idleAmpX + pushX;
    const y = Math.sin(t * freqY + seed * 1.3) * idleAmpY + pushY;
    const skew = pushSk; // idle 不加 skew（保持可读），只有鼠标推时才歪

    el.style.transform =
      `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) skewX(${skew.toFixed(2)}deg)`;
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerleave", onLeave);
    el.removeEventListener("pointercancel", onLeave);
    el.style.willChange = "";
    el.style.transform = "";
  };
}

/**
 * 把一个元素注册为「液体折射受感体」（目前仅 CoverArt 用）：
 * 不直接扭曲元素，只把自身视口内状态暴露给 LiquidField 的 displacement map。
 * 由 LiquidField 在每帧扫描 [data-liquid] 元素，判断鼠标是否在影响半径内。
 *
 * 返回 cleanup。元素需设置 data-liquid 属性作为扫描钩子。
 */
export function markLiquidTarget(el: HTMLElement): () => void {
  if (!liquidEnabled()) return () => {};
  el.setAttribute("data-liquid", "");
  return () => el.removeAttribute("data-liquid");
}

/**
 * React hook：把一个 ref 指向的元素注册为液体推流受感体。
 *
 * 用法：
 *   const ref = useLiquidPush<HTMLButtonElement>();
 *   return <button ref={ref}>...</button>;
 *
 * 元素本身成为 pointermove 容器；GSAP 写该元素的 x/y/skewX（上限 4px / 2°），
 * 与元素内层子节点（如 .nav-swap 的 masked slide）的 transform 互不干扰，
 * 因为作用在不同元素上。
 *
 * enabled 可选：传入 false 时跳过（如菜单未打开时）。
 */
export function useLiquidPush<T extends HTMLElement>(
  enabled: boolean = true,
): React.RefObject<T | null> {
  const ref = useRef<T | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    return attachLiquidPush(el);
  }, [enabled]);
  return ref;
}

