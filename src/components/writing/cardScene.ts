/**
 * Writing 网格的 WebGL 卡片层 —— 弯曲纸片质感的核心。
 *
 * 把每张封面做成一个细分的 PlaneGeometry，vertex shader 做拱起/翘边，
 * fragment 采样封面 texture + 水焦散 + 边缘厚度阴影 + 水下后处理。
 * 浮漂 / 景深 / 鼠标 push / 速度拖拽 / 滚动倾斜 全部迁移自 BuoyantField，
 * 但作用于 mesh 的 position/rotation 而非 DOM transform。
 *
 * 这个文件只管 WebGL；texture 加载、SVG 序列化、挂载交给 React 侧
 * (CardSceneCanvas)。两者通过 CanvasTexture 数组解耦。
 */

import * as THREE from "three";
import { sceneState } from "@/lib/sceneState";

export type CardRect = {
  /** mesh 四角投影回 viewport 的屏幕坐标（px），原点 = canvas 左上 */
  x: number;
  y: number;
  w: number;
  h: number;
  /** mesh 中心的屏幕坐标，文字层钉标题用 */
  cx: number;
  cy: number;
};

export type CardScene = {
  /** 每帧推进（由 React 侧 rAF 调用）。返回 false 表示应暂停（页面隐藏） */
  update: () => boolean;
  /** 取当前帧算好的屏幕投影 rect 数组（DOM 文字层/hit layer 读） */
  getCardRects: () => CardRect[];
  /** 设置 hover 的卡片 index（-1 = 无）；驱动 uCurl 缓动 */
  setHoverIndex: (i: number) => void;
  /** 释放所有 GL 资源 */
  dispose: () => void;
};

const CARD_W = 2 * 0.40; // 世界单位宽度（正交相机左右 ±1，2 列各占 0.40，略压缩）
const CARD_H = CARD_W * 0.75; // 4:3
const GAP_X = 0.08;
const COLS = 2;
const ROW_H = CARD_H + 0.30; // 行高（含垂直间距）
/** 首行卡片中心 Y（视口百分比）。紧贴固定标题区下方，让首屏 2 行饱满。
 *  正交相机 top=1 → 世界 Y=0.12 ≈ 视口 44% 处，卡片顶边落在 ~29%（标题下方）。 */
const HOME_Y = 0.12;

/** 每张卡的相位/景深派生（与 PostCard.phaseForSlug 同源，保证一致） */
function phaseForSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const vertexShader = /* glsl */ `
uniform float uCurl;
varying vec2 vUv;
varying float vEdge;     // 边缘权重，给 fragment 做厚度阴影
varying float vCurl;     // 当前弯曲量，给 fragment 做高光分布
void main() {
  vUv = uv;
  vec3 p = position;
  float edgeX = abs(p.x);   // 0=中心 1=边缘（plane 是 ±0.5，这里归一化）
  float edgeY = abs(p.y);
  // 中部前拱（抛物）：边缘权重平方，中心几乎不动
  float arch = uCurl * (edgeX * edgeX * 0.5 + edgeY * 0.18);
  p.z += arch;
  // 翘边：边缘急剧向后翻（四次方，集中在最外圈）
  p.z += uCurl * pow(edgeX, 4.0) * 0.9;
  vEdge = edgeX;
  vCurl = uCurl;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uTime;
uniform float uSubmerge;   // 复用背景水下氛围
uniform float uOpacity;    // 景深 DOF（远景降透明度）
varying vec2 vUv;
varying float vEdge;
varying float vCurl;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

void main() {
  vec4 tex = texture2D(uTex, vUv);
  vec3 col = tex.rgb;

  // 水焦散光斑（对应 .caustic-sheen）：缓慢游动的高光
  float c1 = sin(vUv.x * 9.0 + uTime * 0.5 + vUv.y * 4.0);
  float c2 = sin(vUv.x * 6.0 - uTime * 0.37 + vUv.y * 7.0);
  float caustic = pow(max(0.0, c1 * 0.5 + 0.5), 5.0) * 0.35
                + pow(max(0.0, c2 * 0.5 + 0.5), 6.0) * 0.25;
  col += vec3(0.99, 0.96, 0.88) * caustic;

  // 拱起面的高光分布：弯曲越强，中部越亮（模拟受光曲面）
  float archLight = (1.0 - vEdge) * vCurl * 0.12;
  col += vec3(1.0) * archLight;

  // 边缘厚度阴影：纸片侧边的暗边
  float edgeShade = smoothstep(0.42, 0.5, vEdge);
  col *= 1.0 - edgeShade * 0.35;

  // 水下后处理（精简版）：冷调 + 光衰减，与背景 sceneShader 同源
  col = mix(col, col * vec3(0.88, 0.94, 1.02) + vec3(0.0, 0.008, 0.018), uSubmerge * 0.4);
  float deep = uSubmerge * 0.5;
  col = mix(col, col * vec3(0.82, 0.9, 0.99), deep * 0.6);

  // 颗粒（替代 SVG 里 feTurbulence 在 canvas 可能丢失的部分）
  float g = hash21(vUv * vec2(800.0, 600.0) + fract(uTime) * 91.0);
  col += (g - 0.5) * 0.03;

  gl_FragColor = vec4(col, uOpacity);
}
`;

export function createCardScene(
  canvas: HTMLCanvasElement,
  slugs: string[],
  textures: THREE.CanvasTexture[],
): CardScene {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });

  const scene = new THREE.Scene();
  // 正交相机：左右 ±1，与 NDC 一致，投影线性、与 DOM 坐标换算简单
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  camera.position.z = 5;

  const n = slugs.length;
  const meshes: THREE.Mesh[] = [];
  const curls: number[] = [];          // 当前 uCurl（每帧缓动）
  const curlTargets: number[] = [];    // 目标 uCurl
  const phases = slugs.map(phaseForSlug);
  const depths = slugs.map(() => 0);   // 占位，下面赋值
  // depth 从 phase 派生（与 BuoyantField 同源 FNV 残差）
  slugs.forEach((s, i) => {
    const h = (Math.imul((phases[i] * 1e6) | 0 || 1, 2654435761) >>> 0);
    depths[i] = n > 1 ? (h % 1000) / 1000 : 0.5;
  });

  for (let i = 0; i < n; i++) {
    const geo = new THREE.PlaneGeometry(CARD_W, CARD_H, 24, 24);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTex: { value: textures[i] },
        uTime: { value: 0 },
        uSubmerge: { value: sceneState.submerge },
        uOpacity: { value: 1 },
        uCurl: { value: 0.25 },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = i;
    scene.add(mesh);
    meshes.push(mesh);
    curls.push(0.25);
    curlTargets.push(0.25);
  }

  const cardRects: CardRect[] = slugs.map(() => ({
    x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0,
  }));

  // ---- 布局：2 列网格，按 scroll 做虚拟滚动 ----
  const layoutX = (i: number) => {
    const col = i % COLS;
    const totalW = COLS * CARD_W + (COLS - 1) * GAP_X;
    return -totalW / 2 + CARD_W / 2 + col * (CARD_W + GAP_X);
  };
  const layoutY = (i: number, scrollPx: number) => {
    const row = Math.floor(i / COLS);
    // 世界 Y 越大越靠上（正交相机 top=1）。首行 HOME_Y=0.58（视口 21%，标题下方），
    // 后续行按 ROW_H 向下递减。scrollPx>0 时整网格向上滑（卡片从下方升入）。
    return HOME_Y - row * ROW_H + scrollPx;
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
  };
  resize();
  window.addEventListener("resize", resize);

  // ---- 每帧推进 ----
  // 鼠标 push 状态（与 BuoyantField 同：卡片级低通 = 拖拽+惯性）
  const mDx = new Array(n).fill(0);
  const mDy = new Array(n).fill(0);

  const tmpVec = new THREE.Vector3();

  const update = () => {
    if (document.hidden) return false;
    const t = sceneState.time;
    const dt = 0.016; // 近似；sceneState.time 已是帧率无关累积
    const vw = canvas.clientWidth || window.innerWidth;
    const vh = canvas.clientHeight || window.innerHeight;
    const aspect = vw / vh;

    // 虚拟滚动：把 sceneState.scroll（静置 ≈ -0.07）归一成 0..1 进度，
    // 再按总行数放大成世界 Y 偏移——保证任意文章数都能完整滚到底。
    // scroll 在 WritingIndex 里映射自 lenis: (scroll/limit)*0.14 - 0.07，
    // 静置 -0.07、滚到底 +0.07，归一进度 = (scroll + 0.07) / 0.14。
    const rows = Math.ceil(n / COLS);
    const progress = Math.min(1, Math.max(0, (sceneState.scroll + 0.07) / 0.14));
    // 滚到底时末行中心要从 HOME_Y 滑到 HOME_Y（与首行静置同高），中间所有行
    // 整体上移 (rows-1)*ROW_H。+0.1 余量让末行不至于贴底雾。
    const scrollWorld = progress * ((rows - 1) * ROW_H + 0.1);

    const mx = sceneState.mouseX;
    const my = sceneState.mouseY;

    // uCurl 缓动
    for (let i = 0; i < n; i++) {
      curls[i] += (curlTargets[i] - curls[i]) * 0.12;
    }

    for (let i = 0; i < n; i++) {
      const mesh = meshes[i];
      const phase = phases[i];
      const depth = depths[i];
      const amp = 1 - depth * 0.55;

      const baseX = layoutX(i);
      const baseY = layoutY(i, scrollWorld);

      // idle 漂浮 + 摆动
      const bob = Math.sin(t * (0.5 + 0.3 * depth) + phase) * amp * 0.012;
      const sway = Math.sin(t * 0.27 + phase * 1.3) * amp * 0.008;
      const rotZ = Math.sin(t * 0.2 + phase) * 0.01 * amp;

      // 鼠标 push（位置项）：归一化卡片中心到光标
      // mesh 中心世界坐标 → 归一化 -1..1
      const cxw = (baseX + 1) / 2;        // 0..1
      const cyw = (baseY + 1) / 2;
      const dx = cxw - 0.5 - mx * 0.5;
      const dy = cyw - 0.5 - my * 0.5;
      const near = Math.exp(-(dx * dx + dy * dy) * 2.4);
      const w = near * (1 - depth * 0.4);
      const pushK = 0.05;
      let tx = -dx * pushK * w;
      let ty = -dy * pushK * w;
      // 速度拖拽
      tx += sceneState.mouseVX * pushK * w * 1.4;
      ty += sceneState.mouseVY * pushK * w * 1.4;
      mDx[i] += (tx - mDx[i]) * 0.08;
      mDy[i] += (ty - mDy[i]) * 0.08;

      // 滚动惯性仰俯
      const scrollTilt = Math.max(-0.1, Math.min(0.1, sceneState.scrollVel * -0.2)) * amp;

      mesh.position.x = baseX + sway + mDx[i];
      mesh.position.y = baseY + bob + mDy[i];
      mesh.position.z = 0.4 - depth * 1.8; // 前景 0.4、远景 -1.4
      mesh.rotation.z = rotZ;
      mesh.rotation.x = scrollTilt;
      // 手动刷新 world 矩阵，确保下面投影读的是当帧（而非上一帧 render 的残留）
      mesh.updateMatrixWorld();

      // 更新 uniforms
      const u = mesh.material as THREE.ShaderMaterial;
      u.uniforms.uTime.value = t;
      u.uniforms.uSubmerge.value = sceneState.submerge;
      u.uniforms.uOpacity.value = 1 - depth * 0.42;
      u.uniforms.uCurl.value = curls[i];

      // ---- 投影 rect（取 BL/TR 对角，正交相机无透视畸变）----
      projectLocal(mesh, new THREE.Vector3(-CARD_W / 2, -CARD_H / 2, 0), camera, aspect, tmpVec);
      const sx0 = tmpVec.x;
      const sy0 = tmpVec.y;
      projectLocal(mesh, new THREE.Vector3(CARD_W / 2, CARD_H / 2, 0), camera, aspect, tmpVec);
      const sx1 = tmpVec.x;
      const sy1 = tmpVec.y;
      const r = cardRects[i];
      r.x = Math.min(sx0, sx1);
      r.y = Math.min(sy0, sy1);
      r.w = Math.abs(sx1 - sx0);
      r.h = Math.abs(sy1 - sy0);
      r.cx = (sx0 + sx1) / 2;
      r.cy = (sy0 + sy1) / 2;
    }

    renderer.render(scene, camera);
    return true;
  };

  /** 把 mesh 局部坐标投影到屏幕像素（原点 canvas 左上，Y 向下） */
  function projectLocal(
    mesh: THREE.Mesh,
    local: THREE.Vector3,
    cam: THREE.OrthographicCamera,
    aspect: number,
    out: THREE.Vector3,
  ) {
    // mesh 的本地点 → 世界：需 mesh.matrixWorld，但本帧未 render。
    // 由于 mesh 位置/旋转我们都直接设了，手动合成 world：
    out.copy(local).applyMatrix4(mesh.matrixWorld);
    out.project(cam); // NDC -1..1
    out.x = (out.x * 0.5 + 0.5) * (canvas.clientWidth || window.innerWidth);
    out.y = (1 - (out.y * 0.5 + 0.5)) * (canvas.clientHeight || window.innerHeight);
    // aspect 已由相机 left/right ±1 + canvas 宽高比决定；这里不再二次校正
    void aspect;
  }

  const getCardRects = () => cardRects;
  const setHoverIndex = (i: number) => {
    for (let k = 0; k < n; k++) {
      curlTargets[k] = k === i ? 0.85 : 0.22;
    }
  };

  const dispose = () => {
    window.removeEventListener("resize", resize);
    for (const m of meshes) {
      (m.material as THREE.ShaderMaterial).dispose();
      m.geometry.dispose();
    }
    renderer.dispose();
  };

  return { update, getCardRects, setHoverIndex, dispose };
}
