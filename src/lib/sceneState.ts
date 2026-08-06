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
  /**
   * 干燥阳光感（0=无、1=最强）。
   * article 页主驱动：暖色顶光、斜向光柱、金尘；与 submerge 互斥使用。
   */
  warmth: number;
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
  // 拖拽平移相机（假 3D 视差）。pointerdown 写 target，render loop 缓动 current。
  // 松手后 target 缓慢回零 → panX 自然回落 → 视角自动回正。
  panTX: 0, // -1..1 目标
  panTY: 0,
  panX: 0, // 缓动后当前值，喂 shader
  panY: 0,
  // 虚拟滚动带来的镜头漂移
  scroll: 0,
  scrollTarget: 0,
  // 滚动速度（每帧差分 + 衰减）；BuoyantField 消费做卡片仰俯惯性
  scrollVel: 0,
  scrollVelTarget: 0,
  // 首页滚轮只推动镜头，不滚动文档
  wheelImpulse: 0,

  /**
   * 局部液体触碰强度（0..1）。
   * LiquidField 在鼠标经过 [data-liquid] 目标时写入；
   * SceneCanvas 读入 shader 做背景局部折射（与 GSAP 管线的 liquify 解耦）。
   */
  touch: 0,

  exposure: 1.0,
  contrast: 1.0,
  fogLift: 0.12,
  liquify: 0.0,
  drift: 1.0,
  submerge: 0.0,
  vignette: 0.0,
  warmth: 0.0,

  reduced: false,
  webgl: true,
  /** 全屏菜单是否打开（MenuOverlay 同步）。打开时禁用拖拽 pan */
  menuOpen: false,
};

export const SCENE_PRESETS: Record<SceneMode, SceneUniformValues> = {
  home: {
    exposure: 1.0,
    contrast: 1.0,
    fogLift: 0.12,
    liquify: 0.0,
    drift: 1.0,
    submerge: 0,
    vignette: 0,
    warmth: 0.08,
    scrollTarget: 0,
  },
  // writing 的 scrollTarget=-0.07 与 WritingIndex 的 Lenis 静置映射一致；
  // 整个 writing 页常驻「水下」：submerge 维持明显正值（光柱/气泡/冷调/整帧水色），
  // liquify 足够高让折射被鼠标与滚动持续搅动；vignette 0.12 维持轻微深水视野收窄
  writing: {
    exposure: 1.45,
    contrast: 0.8,
    fogLift: 0.72,
    liquify: 0.28,
    drift: 0.4,
    submerge: 0.5,
    vignette: 0.12,
    warmth: 0,
    scrollTarget: -0.07,
  },
  // article：破水上岸。无液体、无冷青、阅读优先。
  // 高曝光 + warmth 做阳光透亮；drift 保留克制的大厅景深呼吸；fog 压低求澄净。
  article: {
    exposure: 1.34,
    contrast: 0.96,
    fogLift: 0.18,
    liquify: 0,
    drift: 0.42,
    submerge: 0,
    vignette: 0.03,
    warmth: 0.72,
    scrollTarget: 0,
  },
  quiet: {
    exposure: 1.2,
    contrast: 0.86,
    fogLift: 0.52,
    liquify: 0.04,
    drift: 0.2,
    submerge: 0,
    vignette: 0,
    warmth: 0.15,
    scrollTarget: 0,
  },
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
  warmth: 0,
};

/**
 * 破水而出峰值（writing → article）。
 * 水面张力拉到最大、短暂亮化，随后 warmth 接管、水体退尽。
 * 与 DIVE_PEAK 对称：一个沉入深水，一个穿出水面。
 */
export const EMERGE_PEAK = {
  exposure: 1.72,
  contrast: 0.9,
  fogLift: 0.55,
  liquify: 0.95,
  submerge: 0.22,
  vignette: 0.08,
  warmth: 0.35,
};

export function modeForPath(pathname: string): SceneMode {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/writing/")) return "article";
  if (pathname.startsWith("/writing")) return "writing";
  return "quiet";
}
