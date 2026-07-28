"use client";

import { useEffect, useRef } from "react";
import { sceneState } from "@/lib/sceneState";

/**
 * 全局液体折射场 —— 混合方案中的「栅格层扰动」子系统。
 *
 * 职责（单一）：
 * 维护一个低分辨率 displacement-map canvas（128×128），
 * 每帧（隔帧）绘制「以鼠标为中心的径向凸起 + 速度方向拖尾」，
 * 通过 SVG feImage→feDisplacementMap 让挂了 filter:url(#liquid-cover) 的
 * 栅格元素（目前仅 CoverArt）产生局部折射。
 *
 * 不做：
 * - 不追踪鼠标（只读 sceneState.mouseX/mouseY/mouseVX/mouseVY）
 * - 不直接扭曲文字（文字层走 liquidControls.attachLiquidPush 的 transform 路径）
 * - 不再开第二个鼠标监听器
 *
 * 性能纪律（对齐 BuoyantField）：
 * - 隔帧重绘（~30fps）+ document.hidden bail
 * - 视口内无 [data-liquid] 目标时跳过整帧绘制
 * - filter scale 上限 14，保证「克制、可识」
 * - reduced || !webgl → 完全 no-op，不挂 filter、不跑 rAF
 *
 * 挂载：AppShell 中与 SceneCanvas 同级，永不卸载。
 *
 * 浏览器兼容：feImage 引用 canvas 在 Chromium 系稳定；Firefox/Safari
 * 若 filter 不生效，封面仅表现为无折射（视觉降级，不报错）。
 */

const MAP_SIZE = 128; // displacement map 分辨率，足够低以保证性能
const FILTER_SCALE = 12; // feDisplacementMap scale，克制
const INFLUENCE_RADIUS = 0.18; // 鼠标影响半径（归一化 0..1）

export default function LiquidField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 双 gate：与 BuoyantField 完全对齐
    if (sceneState.reduced || !sceneState.webgl) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: false });
    if (!ctx) return;

    // 预分配 ImageData，避免每帧分配
    const img = ctx.createImageData(MAP_SIZE, MAP_SIZE);
    const data = img.data;

    // 平滑过的鼠标坐标（局部阻尼，让折射有惯性而非生硬跟随）
    let sx = 0.5;
    let sy = 0.5;
    // 平滑过的强度（停下后缓慢衰减）
    let strength = 0;
    let wasFlat = true;

    /**
     * 写一张平坦 map（所有像素 R=G=128 = 零位移）。
     * 用于鼠标离开后让 filter 回到无折射态。
     */
    function writeFlat() {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 0;
        data[i + 3] = 255;
      }
    }
    writeFlat(); // 初始平坦
    ctx.putImageData(img, 0, 0);

    let frame = 0;
    let raf = 0;

    const draw = () => {
      const mx = sceneState.mouseX * 0.5 + 0.5; // -1..1 → 0..1
      const my = 1 - (sceneState.mouseY * 0.5 + 0.5); // 翻转 y（DOM 向下为正）

      // 扫描挂了 data-liquid 的元素，判断鼠标是否在任一目标的影响半径内
      const targets = document.querySelectorAll<HTMLElement>("[data-liquid]");
      let active = false;
      let tx = 0.5;
      let ty = 0.5;

      for (const t of targets) {
        const rect = t.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
        // 元素中心归一化坐标
        const cx = (rect.left + rect.width * 0.5) / window.innerWidth;
        const cy = (rect.top + rect.height * 0.5) / window.innerHeight;
        const dx = mx - cx;
        const dy = my - cy;
        // 用元素尺寸粗略估算影响半径（归一化）
        const radius =
          (Math.max(rect.width, rect.height) / window.innerWidth) * 0.7 +
          INFLUENCE_RADIUS;
        if (dx * dx + dy * dy < radius * radius) {
          active = true;
          tx = mx;
          ty = my;
          break;
        }
      }

      // 鼠标速度强度：停下归零，移动放大
      const vel = Math.min(
        1,
        Math.sqrt(
          sceneState.mouseVX * sceneState.mouseVX +
            sceneState.mouseVY * sceneState.mouseVY,
        ) * 6,
      );
      const targetStrength = active ? 0.35 + vel * 0.65 : 0;

      // 阻尼：升得快、落得慢（水中惯性）
      strength += (targetStrength - strength) * (active ? 0.18 : 0.06);
      sx += (tx - sx) * 0.2;
      sy += (ty - sy) * 0.2;

      // 强度极低时写一次平坦 map 后停笔（省 putImageData）
      if (strength < 0.01) {
        if (!wasFlat) {
          writeFlat();
          ctx.putImageData(img, 0, 0);
          repaint();
          wasFlat = true;
        }
        return;
      }
      wasFlat = false;

      // 画 displacement map：
      // 以 (sx, sy) 为中心的径向高斯凸起 + 沿速度方向拉伸
      const vx = sceneState.mouseVX;
      const vy = -sceneState.mouseVY; // 翻转 y
      const radius2 = INFLUENCE_RADIUS * INFLUENCE_RADIUS;

      for (let y = 0; y < MAP_SIZE; y++) {
        for (let x = 0; x < MAP_SIZE; x++) {
          const px = x / (MAP_SIZE - 1);
          const py = y / (MAP_SIZE - 1);
          const dx = px - sx;
          const dy = py - sy;
          const d2 = dx * dx + dy * dy;
          // 径向高斯衰减
          const fall = Math.exp(-(d2 / radius2) * 2.2) * strength;
          // 位移方向：径向向外（模拟凸透镜折射）+ 顺速度方向拖尾
          const rx = Math.max(
            -127,
            Math.min(127, dx * fall * 60 + vx * fall * 40),
          );
          const ry = Math.max(
            -127,
            Math.min(127, dy * fall * 60 + vy * fall * 40),
          );
          const idx = (y * MAP_SIZE + x) * 4;
          data[idx] = 128 + rx; // R → x 位移
          data[idx + 1] = 128 + ry; // G → y 位移
          data[idx + 2] = 0;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(img, 0, 0);
      repaint();
    };

    let tick = 0;
    // 强制被 filter 的元素重光栅：浏览器不会因 canvas 内容变化自动 dirty-check
    // feDisplacementMap，需要扰动。用 data 属性 toggle 最轻量（避免 reflow）。
    function repaint() {
      tick = (tick + 1) % 1000000;
      const v = String(tick);
      document.querySelectorAll<HTMLElement>("[data-liquid]").forEach((t) => {
        t.setAttribute("data-liquid-tick", v);
      });
    }

    const loop = () => {
      raf = requestAnimationFrame(loop);
      if (document.hidden) return;
      frame++;
      if (frame % 2 === 0) draw(); // 隔帧（~30fps）
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
    };
  }, []);

  // SVG defs 始终渲染（保证 SSR/客户端一致，无 hydration 隐患）；
  // filter 是否生效交给 CSS：.liquid-cover 的 filter 声明 + reduced-motion 媒体查询。
  // rAF 是否运行由上方 effect 内的 sceneState gate 控制。
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed left-0 top-0 h-0 w-0"
      style={{ zIndex: -1, overflow: "hidden" }}
    >
      <defs>
        <filter
          id="liquid-cover"
          x="-12%"
          y="-12%"
          width="124%"
          height="124%"
          colorInterpolationFilters="sRGB"
        >
          <feImage href="#liquid-displacement-map" result="map" preserveAspectRatio="none" />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale={FILTER_SCALE}
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </defs>
      <foreignObject x={0} y={0} width={MAP_SIZE} height={MAP_SIZE} style={{ display: "none" }}>
        <canvas
          id="liquid-displacement-map"
          ref={canvasRef}
          width={MAP_SIZE}
          height={MAP_SIZE}
        />
      </foreignObject>
    </svg>
  );
}
