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
  /** 视野收窄（0=常态、1=最强暗角）：下潜峰值时半径收缩，模拟深水视野被压缩 */
  vignette: number;
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
  // 鼠标速度向量（每帧差分 + 衰减，停手归零）；BuoyantField 消费做「顺流拖」
  mouseVX: 0,
  mouseVY: 0,
  // 虚拟滚动带来的镜头漂移
  scroll: 0,
  scrollTarget: 0,
  // 滚动速度（每帧差分 + 衰减）；BuoyantField 消费做卡片仰俯惯性
  scrollVel: 0,
  scrollVelTarget: 0,
  // 首页滚轮只推动镜头，不滚动文档
  wheelImpulse: 0,

  exposure: 1.0,
  contrast: 1.0,
  fogLift: 0.12,
  liquify: 0.0,
  drift: 1.0,
  submerge: 0.0,
  vignette: 0.0,

  reduced: false,
  webgl: true,
};

export const SCENE_PRESETS: Record<SceneMode, SceneUniformValues> = {
  home: { exposure: 1.0, contrast: 1.0, fogLift: 0.12, liquify: 0.0, drift: 1.0, submerge: 0, vignette: 0, scrollTarget: 0 },
  // writing 的 scrollTarget=-0.07 与 WritingIndex 的 Lenis 静置映射一致；
  // 整个 writing 页常驻「水下」：submerge 维持明显正值（光柱/气泡/冷调/整帧水色），
  // liquify 足够高让折射被鼠标与滚动持续搅动；vignette 0.12 维持轻微深水视野收窄
  writing: { exposure: 1.45, contrast: 0.8, fogLift: 0.72, liquify: 0.28, drift: 0.4, submerge: 0.5, vignette: 0.12, scrollTarget: -0.07 },
  // article 比 writing 更深：submerge 0.62 > 0.5（继续下沉）、liquify 0.12（折射更强但不晃字）、
  // drift 0.28（漂浮更明显）、exposure 1.18（光衰减）、vignette 0.2（更深 → 视野更窄）。
  // dive 峰值 1 → 着陆落到 0.62 = 沉到更深水底。
  article: { exposure: 1.18, contrast: 0.88, fogLift: 0.62, liquify: 0.12, drift: 0.28, submerge: 0.62, vignette: 0.2, scrollTarget: 0 },
  quiet: { exposure: 1.2, contrast: 0.86, fogLift: 0.52, liquify: 0.04, drift: 0.2, submerge: 0, vignette: 0, scrollTarget: 0 },
};

/**
 * 下潜峰值统一参数。navigate() 切页瞬间把场景推到这里——
 * 暗（exposure 0.62）、冷（fogLift 0.85）、折射拉满（liquify 1.15）、视野收窄（vignette 0.78）。
 * 与旧逻辑「变亮变雾」相反：真实下潜是变暗变静、视野被压缩。
 * 着陆段再从这里缓动回落到目标 preset。
 */
export const DIVE_PEAK = {
  exposure: 0.62,
  contrast: 0.96,
  fogLift: 0.85,
  liquify: 1.15,
  submerge: 1,
  vignette: 0.78,
};

export function modeForPath(pathname: string): SceneMode {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/writing/")) return "article";
  if (pathname.startsWith("/writing")) return "writing";
  return "quiet";
}
