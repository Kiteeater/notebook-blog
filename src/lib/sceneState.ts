/**
 * 跨路由共享的场景状态。
 * 渲染循环（SceneCanvas）每帧读取；TransitionController 用 GSAP 改写。
 * 刻意保持为普通可变对象，避免 React 重渲染进入渲染热路径。
 */
export type SceneMode = "home" | "writing" | "article" | "quiet";

export type SceneUniformValues = {
  exposure: number;
  contrast: number;
  fogLift: number;
  liquify: number;
  drift: number;
  /** 没入水中的程度（转场期间 >0；writing 页静置也保留小幅正值以维持水下氛围） */
  submerge: number;
  /** 镜头垂直漂移的静置目标（负值 = 世界抬升 = 镜头下沉） */
  scrollTarget: number;
};

export const sceneState = {
  time: 0,
  // 鼠标视差（-1..1），target 由指针写入，当前值在渲染循环里缓动
  mouseX: 0,
  mouseY: 0,
  mouseTX: 0,
  mouseTY: 0,
  // 虚拟滚动带来的镜头漂移
  scroll: 0,
  scrollTarget: 0,
  // 首页滚轮只推动镜头，不滚动文档
  wheelImpulse: 0,

  exposure: 1.0,
  contrast: 1.0,
  fogLift: 0.12,
  liquify: 0.0,
  drift: 1.0,
  submerge: 0.0,

  reduced: false,
  webgl: true,
};

export const SCENE_PRESETS: Record<SceneMode, SceneUniformValues> = {
  home: { exposure: 1.0, contrast: 1.0, fogLift: 0.12, liquify: 0.0, drift: 1.0, submerge: 0, scrollTarget: 0 },
  // writing 的 scrollTarget=-0.07 与 WritingIndex 的 Lenis 静置映射一致；
  // 整个 writing 页常驻「水下」：submerge 维持明显正值（光柱/气泡/冷调/整帧水色），
  // liquify 足够高让折射被鼠标与滚动持续搅动
  writing: { exposure: 1.45, contrast: 0.8, fogLift: 0.72, liquify: 0.28, drift: 0.4, submerge: 0.5, scrollTarget: -0.07 },
  article: { exposure: 1.24, contrast: 0.86, fogLift: 0.6, liquify: 0.04, drift: 0.15, submerge: 0, scrollTarget: 0 },
  quiet: { exposure: 1.2, contrast: 0.86, fogLift: 0.52, liquify: 0.04, drift: 0.2, submerge: 0, scrollTarget: 0 },
};

export function modeForPath(pathname: string): SceneMode {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/writing/")) return "article";
  if (pathname.startsWith("/writing")) return "writing";
  return "quiet";
}
