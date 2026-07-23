"use client";

import { useEffect } from "react";
import { sceneState } from "@/lib/sceneState";

/** 文档滚动 → 共享场景的极轻微镜头漂移（文章页 / Topics / About 使用） */
export default function ScrollDrift() {
  useEffect(() => {
    if (sceneState.reduced) return;
    const onScroll = () => {
      sceneState.scrollTarget = Math.min(0.08, window.scrollY / 4200);
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
