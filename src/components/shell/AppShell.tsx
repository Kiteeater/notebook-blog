"use client";

import SceneCanvas from "@/components/scene/SceneCanvas";
import GlobalHeader from "./GlobalHeader";
import MenuOverlay from "./MenuOverlay";
import TransitionProvider from "./TransitionProvider";

/**
 * 跨路由常驻的 App Shell：
 * SharedScene（背景） + GlobalHeader（固定导航） + RouteContent（前景）。
 * 三者生命周期互不干扰，转场只改写场景 uniform 与前景透明度。
 */
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TransitionProvider>
      <SceneCanvas />
      <GlobalHeader />
      <MenuOverlay />
      <div className="relative" style={{ zIndex: 10 }}>
        {children}
      </div>
    </TransitionProvider>
  );
}
