"use client";

import { useEffect } from "react";
import { sceneState } from "@/lib/sceneState";

/**
 * 文档滚动 → 共享场景的极轻微镜头漂移（文章页 / Topics / About 使用）。
 * 文章上岸后背景是干燥阳光：漂移保留，幅度更克制，像日光下缓缓移动的视差。
 */
export default function ScrollDrift() {
  useEffect(() => {
    if (sceneState.reduced) return;
    const onScroll = () => {
      // 阅读页：极轻上移，避免长文滚动时背景抢戏
      sceneState.scrollTarget = Math.min(0.022, window.scrollY / 11000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener("scroll", onScroll);
      sceneState.scrollTarget = 0;
    };
  }, []);
  return null;
}
