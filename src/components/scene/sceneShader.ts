/**
 * 「观测站大厅」—— 原创程序化场景。
 * 雾中档案空间：递进的碑板与发光窗洞、反射地面、尘埃、
 * 微弱虹彩材质边光。转场所需的液化 / 曝光 / 雾升全部为 uniform。
 */

export const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const fragmentShader = /* glsl */ `
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uScroll;
uniform vec2 uPan;
uniform float uExposure;
uniform float uContrast;
uniform float uFogLift;
uniform float uLiquify;
uniform float uDrift;
uniform float uSubmerge;
uniform float uVignette;
uniform float uWarmth;
uniform float uTouch;

varying vec2 vUv;

float hash21(vec2 p) {
  p = fract(p * vec2(234.34, 435.345));
  p += dot(p, p + 34.23);
  return fract(p.x * p.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise2(p);
    p *= 2.03;
    a *= 0.5;
  }
  return v;
}

float sdBox(vec2 p, vec2 b) {
  vec2 d = abs(p) - b;
  return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

/* 克制的虹彩材质色 */
vec3 spectral(float t) {
  return 0.5 + 0.5 * cos(6.2831 * (t * vec3(0.9, 0.95, 1.0) + vec3(0.0, 0.33, 0.67)));
}

/* 大厅（不含地面反射）。p：x 居中已校正宽高比，y 0..1 向上 */
vec3 hall(vec2 p, float t) {
  vec3 top = vec3(0.722, 0.698, 0.648);
  vec3 horizon = vec3(0.925, 0.898, 0.845);
  vec3 col = mix(horizon, top, smoothstep(0.12, 1.05, p.y));

  /* 左上缓慢漂移的天光 */
  vec2 lp = vec2(-0.52 + 0.09 * sin(t * 0.05), 0.86 + 0.05 * cos(t * 0.043));
  /* 日源随 pan 偏移：相机平移时远处光源视差，强化空间纵深 */
  lp.x += uPan.x * 0.06;
  lp.y += uPan.y * 0.03;
  col += vec3(0.12, 0.115, 0.105) * exp(-3.2 * length(p - lp));

  /* 三层碑板，由远及近 */
  for (int L = 2; L >= 0; L--) {
    float fl = float(L);
    float depth = 0.55 + 0.2 * fl;
    float par = 1.0 - depth;
    vec2 q = p;
    q.x += uMouse.x * 0.055 * par + uDrift * 0.012 * sin(t * 0.06 + fl * 2.1);
    q.y += uMouse.y * 0.028 * par + uScroll * (0.2 + 0.3 * par);
    /* 假 3D：pan 驱动相机平移，近景层(depth 小)位移大、远景层位移小 → 深度错觉 */
    float panStr = 0.18 * par;
    q.x += uPan.x * panStr;
    q.y += uPan.y * panStr * 0.7;

    float w = 0.34 - 0.06 * fl;
    float row = q.x / w + 3.0 * fl;
    float id = floor(row);
    float lx = fract(row) - 0.5;
    float h = hash21(vec2(id, fl * 7.3));
    float h2 = hash21(vec2(id * 1.7 + 3.1, fl * 3.7));
    float h3 = hash21(vec2(id * 2.3 + 7.7, fl * 5.1));

    float slabW = w * (0.30 + 0.22 * h);
    float base = 0.30 + 0.05 * fl;
    float topY = base + 0.24 + 0.52 * h2;
    vec2 bp = vec2(lx * w, q.y - (base + topY) * 0.5);
    float d = sdBox(bp, vec2(slabW * 0.5, (topY - base) * 0.5));

    float depthFog = mix(1.0, 0.5, depth);
    vec3 slabCol = mix(vec3(0.475, 0.446, 0.398), vec3(0.75, 0.72, 0.66), 1.0 - depth);
    slabCol *= 0.9 + 0.1 * noise2(q * 8.0 + fl);
    float body = smoothstep(0.004, -0.004, d);
    col = mix(col, mix(col, slabCol, depthFog), body * (0.94 - 0.3 * (1.0 - depth)));

    /* 碑板内的发光窗洞：部分碑板保持沉默（无窗），制造节奏 */
    float showWin = step(0.3, h3);
    float winW = slabW * 0.42;
    float winH = (topY - base) * (0.2 + 0.2 * h);
    vec2 wp = vec2(lx * w, q.y - (base + 0.06 + winH + 0.14 * h2 * (topY - base)));
    float dw = sdBox(wp, vec2(winW * 0.5, winH * 0.5));
    float flick = 0.86 + 0.14 * sin(t * (0.25 + h * 0.4) + id * 13.7);
    vec3 winCol = mix(vec3(0.99, 0.96, 0.89), vec3(0.78, 0.86, 0.92), h * 0.4) * flick;
    float winBody = smoothstep(0.003, -0.003, dw) * body * showWin;
    col = mix(col, winCol, winBody * (0.45 + 0.55 * (1.0 - depth)) * 0.9);
    col += winCol * exp(-42.0 * abs(dw)) * 0.045 * body * showWin;

    /* 碑板边缘的微弱虹彩 */
    float rim = exp(-95.0 * abs(d)) * body * 0.085;
    col += spectral(h + p.y * 0.25) * rim;
  }
  return col;
}

void main() {
  vec2 uv = vUv;
  vec2 asp = vec2(uRes.x / uRes.y, 1.0);
  vec2 p = (uv - 0.5) * asp;
  p.y += 0.5;

  float t = uTime;

  /* ---- 液态折射：自底部与两侧增强；没入水中时全画面呼吸 ---- */
  float liq = max(uLiquify, 0.0);
  float liqMask = smoothstep(0.6, 0.0, p.y) * 0.75 + smoothstep(0.32, 0.58, abs(uv.x - 0.5)) * 0.55;
  float amp = liq * 0.04 * liqMask + uSubmerge * 0.013;
  p.x += sin(p.y * 17.0 + t * 2.1) * amp + sin(p.y * 46.0 - t * 3.6) * amp * 0.6;
  p.y += sin(p.x * 21.0 + t * 1.7) * amp * 0.7;

  /* 鼠标搅动水面：指针偏移产生横向涡流，滚动产生纵向水流
     仅在有水（liq/submerge）时生效，越靠近水面搅动越强 */
  float water = liq + uSubmerge;
  float surface = smoothstep(0.0, 0.7, p.y);
  p.x += uMouse.x * water * 0.028 * surface;
  p.y += uMouse.y * water * 0.017 * surface + uScroll * water * 0.08;

  /* 局部触碰折射：鼠标附近像隔着水被手指碰了一下（LiquidField 驱动 uTouch）
     与全局 liquify 解耦，干燥页（article）也能有克制的局部水感 */
  if (uTouch > 0.001) {
    vec2 muv = vec2(uMouse.x * 0.5 + 0.5, 1.0 - (uMouse.y * 0.5 + 0.5));
    vec2 d = (uv - muv) * asp;
    float fall = exp(-dot(d, d) * 14.0) * uTouch;
    float swirl = fbm(uv * 6.0 + t * 0.35) - 0.5;
    p.x += (d.x * 0.55 + swirl * 0.35) * fall * 0.055;
    p.y += (d.y * 0.45 + swirl * 0.28) * fall * 0.045;
    /* 速度拖尾：顺流轻微拉长 */
    p.x += uMouse.x * fall * 0.012;
    p.y += uMouse.y * fall * 0.008;
  }

  float floorY = 0.34;
  /* 地平线随 pan.y 上下：向下拖相机往下看 → 地平线上移露出更多地面，反之抬起 */
  floorY += uPan.y * 0.05;
  vec3 col;
  if (p.y < floorY) {
    /* 反射地面：镜像大厅 + 波纹扰动 */
    float my = floorY + (floorY - p.y);
    vec2 mp = vec2(p.x, my);
    float depth01 = clamp((floorY - p.y) / floorY, 0.0, 1.0);
    mp.x += sin(my * 34.0 + t * 0.85 + p.x * 4.0) * (0.006 + 0.05 * liq) * (0.35 + depth01);
    mp.x += (fbm(vec2(p.x * 3.0, my * 6.0 - t * 0.1)) - 0.5) * 0.02 * (0.3 + liq);
    vec3 refl = hall(mp, t);
    refl *= vec3(0.82, 0.86, 0.92);
    refl *= 1.0 - 0.45 * depth01;
    float sheen = pow(max(0.0, sin(p.x * 3.0 + t * 0.12 + depth01 * 5.0)), 3.0);
    refl += spectral(depth01 * 0.7 + t * 0.015) * sheen * 0.03 * (1.0 - depth01);
    vec3 base = vec3(0.585, 0.56, 0.52);
    col = mix(refl, base, depth01 * 0.4);
    col += vec3(0.4) * exp(-700.0 * abs(p.y - floorY));
  } else {
    col = hall(p, t);
  }

  /* 漂浮的尘埃 */
  {
    vec2 dp = p * vec2(9.0, 7.0);
    dp.y -= t * 0.03;
    vec2 cell = floor(dp);
    vec2 f = fract(dp) - 0.5;
    float h = hash21(cell);
    vec2 off = vec2(sin(t * 0.3 + h * 17.0), cos(t * 0.23 + h * 11.0)) * 0.3;
    float m = smoothstep(0.06, 0.0, length(f + off)) * step(0.82, h);
    col += vec3(1.0, 0.98, 0.92) * m * (0.4 + 0.6 * sin(t * 0.7 + h * 40.0)) * 0.09;
  }

  /* ---- 没入水中（转场峰值）：水面光、光柱、深处转冷、上浮微粒 ---- */
  if (uSubmerge > 0.001) {
    float topGlow = smoothstep(0.3, 1.1, p.y);

    /* 整帧水色：水下统一的冷青调，越深越浓（让整页都「在水里」而非只有底部） */
    col = mix(col, col * vec3(0.9, 0.95, 1.03) + vec3(0.0, 0.008, 0.018), uSubmerge * 0.45);

    /* 头顶水面的辉光 */
    col += vec3(0.985, 0.965, 0.9) * topGlow * uSubmerge * 0.24;

    /* 两道缓慢摆动的光柱 */
    float sway = fbm(vec2(p.x * 2.5, t * 0.06)) * 3.0;
    float shaft = pow(max(0.0, sin(p.x * 8.0 + sway + t * 0.12)), 3.0)
                + pow(max(0.0, sin(p.x * 13.0 - t * 0.08 + 2.2)), 4.0) * 0.6;
    col += vec3(1.0, 0.985, 0.94) * shaft * topGlow * uSubmerge * 0.09;

    /* 深处转冷、略微压暗 */
    float deep = smoothstep(0.7, -0.1, p.y) * uSubmerge;
    col = mix(col, col * vec3(0.82, 0.89, 0.99) + vec3(0.01, 0.028, 0.05), deep * 0.92);

    /* 上浮微粒（气泡） */
    vec2 bp = p * vec2(13.0, 9.0);
    bp.y -= t * 0.24;
    vec2 bc = floor(bp);
    vec2 bf = fract(bp) - 0.5;
    float bh = hash21(bc);
    bf.x += sin(t * 0.6 + bh * 21.0) * 0.22;
    float bm = smoothstep(0.06, 0.0, length(bf)) * step(0.9, bh);
    col += vec3(1.0, 0.99, 0.95) * bm * (0.5 + 0.5 * sin(t * 0.9 + bh * 35.0)) * uSubmerge * 0.14;
  }

  /* ---- 干燥阳光（article 上岸）：暖顶光、斜向光柱、金尘 —— 无折射、无气泡 ---- */
  if (uWarmth > 0.001) {
    float w = uWarmth;
    /* 整帧暖调：纸本米黄，替代水下冷青 */
    col = mix(col, col * vec3(1.04, 1.01, 0.96) + vec3(0.018, 0.012, 0.0), w * 0.55);

    /* 左上暖日：固定方位，缓慢呼吸（不是渐变罩，是体积光衰减） */
    vec2 sun = vec2(-0.38 + uMouse.x * 0.04, 0.92 + uMouse.y * 0.02);
    float sunDist = length(p - sun);
    col += vec3(1.0, 0.94, 0.82) * exp(-2.4 * sunDist) * w * 0.22;
    col += vec3(0.98, 0.9, 0.72) * exp(-8.0 * sunDist) * w * 0.08;

    /* 斜向光柱：从日源沿对角线落下，fbm 做边缘软抖（空气热浪，非水面折射） */
    vec2 rp = p - sun;
    float along = rp.x * 0.55 + rp.y * 0.84; /* 朝右下 */
    float across = rp.x * 0.84 - rp.y * 0.55;
    float heat = fbm(vec2(across * 2.2, along * 0.7 - t * 0.04)) * 0.35;
    float beam =
      exp(-abs(across + heat * 0.12) * 9.0) *
      smoothstep(-0.15, 0.55, along) *
      (0.55 + 0.45 * sin(along * 5.0 + t * 0.09 + heat * 1.7));
    float beam2 =
      exp(-abs(across - 0.18 + heat * 0.08) * 14.0) *
      smoothstep(0.0, 0.7, along) * 0.55;
    col += vec3(1.0, 0.96, 0.86) * (beam + beam2) * w * 0.07;

    /* 金尘：比水下尘埃更暖、更稀、下落更慢 —— 干空气里的颗粒 */
    vec2 gp = p * vec2(11.0, 8.5);
    gp.y -= t * 0.018;
    vec2 gc = floor(gp);
    vec2 gf = fract(gp) - 0.5;
    float gh = hash21(gc + 19.0);
    gf.x += sin(t * 0.22 + gh * 14.0) * 0.28;
    float gm = smoothstep(0.045, 0.0, length(gf)) * step(0.88, gh);
    col += vec3(1.0, 0.95, 0.82) * gm * (0.45 + 0.55 * sin(t * 0.5 + gh * 28.0)) * w * 0.11;

    /* 底部略收暗：落地阴影，给纸面阅读区留对比，不做暗角压迫 */
    float ground = smoothstep(0.55, 0.0, p.y);
    col *= 1.0 - ground * w * 0.06;
  }

  /* ---- 后期 ---- */
  col *= uExposure;
  col = (col - 0.5) * uContrast + 0.5;

  /* 雾自底部漫入（转场提亮） */
  float lift = smoothstep(0.78, -0.12, p.y) * uFogLift;
  col = mix(col, vec3(0.965, 0.953, 0.925), lift);
  col = mix(col, vec3(0.957, 0.947, 0.918), uFogLift * smoothstep(0.62, 1.05, p.y) * 0.72);

  /* vignette：uVignette=0 时与原行为等价（半径 1.3→0.42、边缘压到 0.88）；
     下潜峰值 uVignette→1 时半径收窄到 0.62、边缘压到 0.55，模拟深水视野被压缩 */
  float vigR = mix(1.30, 0.62, uVignette);
  float vigA = mix(0.42, 0.20, uVignette);
  float vigEdge = mix(0.88, 0.55, uVignette);
  float vig = smoothstep(vigR, vigA, length((uv - 0.5) * asp * 1.12));
  col *= mix(vigEdge, 1.0, vig);

  float g = hash21(vUv * uRes + fract(t) * 371.0);
  col += (g - 0.5) * 0.026;

  gl_FragColor = vec4(col, 1.0);
}
`;
