"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { coverArtSvg } from "./coverArtSvg";
import { createCardScene, type CardScene, type CardRect } from "./cardScene";
import { sceneState } from "@/lib/sceneState";
import type { PostMeta } from "@/lib/types";

/**
 * Writing 网格的 WebGL 卡片层（弯曲纸片）。
 *
 * 职责：
 * - 把每篇文章的 CoverArt（纯 SVG）序列化成 data URL → CanvasTexture
 * - 挂载 createCardScene，起 rAF 每帧推进
 * - 暴露 cardRects（通过 ref 回调）给 DOM 文字层 / hit layer 做投影跟随
 * - 把 hover index 喂给场景（驱动 uCurl 缓动）
 *
 * 桌面 + 非 reduced-motion 才挂载；否则返回 null（WritingIndex 退回 DOM 卡片）。
 * canvas 本身 pointer-events-none，命中由上层 CardHitLayer 的透明 <a> 负责。
 */

type Props = {
  posts: PostMeta[];
  /** 容器 ref（WritingIndex 的 gridRef），canvas 用 absolute inset-0 铺满它 */
  containerRef: React.RefObject<HTMLElement | null>;
  /** 共享 rects ref：场景每帧写入，文字层 / hit layer 的 rAF 读取跟随。
   *  用 ref 而非回调，避免回调闭包变化触发场景重建。 */
  rectsRef: React.RefObject<CardRect[] | null>;
  /** hover index 回写 ref：hit layer 写入，场景每帧读取驱动 uCurl */
  hoverRef: React.RefObject<number>;
  /** WebGL / 纹理初始化失败时回调，父级应退回 DOM 卡片网格 */
  onFail?: () => void;
};

/** 把 CoverArt SVG 字符串转成 CanvasTexture（异步，等待 image load）。
 *  直接调纯函数 coverArtSvg 拿 SVG，不依赖 React 渲染周期（避免 lifecycle 冲突）。
 *  base64 data URL —— 跨浏览器最稳的 SVG→Image 路径。 */
function coverToTexture(post: PostMeta): Promise<THREE.CanvasTexture> {
  const svg = coverArtSvg(post.slug, post.category);
  const dataUrl =
    "data:image/svg+xml;base64," +
    window.btoa(unescape(encodeURIComponent(svg)));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1024;
      canvas.height = 768;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("2d context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      tex.needsUpdate = true;
      resolve(tex);
    };
    img.onerror = () =>
      reject(
        new Error(
          "cover svg load failed: " +
            post.slug +
            " (svg len=" +
            svg.length +
            ", head=" +
            JSON.stringify(svg.slice(0, 200)) +
            ")",
        ),
      );
    img.src = dataUrl;
  });
}

export default function CardSceneCanvas({
  posts,
  containerRef,
  rectsRef,
  hoverRef,
  onFail,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const onFailRef = useRef(onFail);
  onFailRef.current = onFail;

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    let scene: CardScene | null = null;
    let raf = 0;
    let disposed = false;

    // 1. 异步加载所有封面纹理
    Promise.all(posts.map(coverToTexture))
      .then((textures) => {
        if (disposed || !canvasRef.current) {
          textures.forEach((t) => t.dispose());
          return;
        }
        try {
          scene = createCardScene(
            canvasRef.current,
            posts.map((p) => p.slug),
            textures,
          );
        } catch (err) {
          textures.forEach((t) => t.dispose());
          throw err;
        }
        // 2. rAF 循环：推进 + 写 rects + 读 hover
        const loop = () => {
          raf = requestAnimationFrame(loop);
          if (!scene) return;
          const alive = scene.update();
          if (!alive) return;
          rectsRef.current = scene.getCardRects();
          // hover index 由 hit layer 写入 hoverRef，场景每帧读取驱动弯曲
          scene.setHoverIndex(hoverRef.current);
        };
        raf = requestAnimationFrame(loop);
      })
      .catch((err) => {
        console.error("[CardSceneCanvas] texture/scene init failed:", err);
        if (!disposed) {
          setFailed(true);
          onFailRef.current?.();
        }
      });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      scene?.dispose();
      scene = null;
    };
    // 只依赖 posts（筛选变化 → 新数组 → 重建）；ref 是稳定引用不触发重建
    void containerRef;
  }, [posts]);

  if (failed) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
      style={{ zIndex: 0 }}
    />
  );
}
