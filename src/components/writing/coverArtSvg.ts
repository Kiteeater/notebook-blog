/**
 * 程序生成的「档案版画」封面 —— 纯字符串版（与 CoverArt.tsx 同源同输出）。
 *
 * 把 SVG 生成抽成无 React 依赖的纯函数，供两处复用：
 * - CoverArt.tsx 的 React 组件（DOM 渲染，降级路径用）
 * - CardSceneCanvas 的 SVG→CanvasTexture（WebGL 卡片纹理）
 *
 * 前者用 React 渲染拿 SVG 会和主渲染周期冲突（flushSync/unmount 在 lifecycle 里禁用），
 * 所以这里用纯字符串拼接，零 React 依赖，可在任何时机同步调用。
 */

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Slab = {
  x: number;
  w: number;
  top: number;
  tone: number;
  winW: number;
  winH: number;
  winY: number;
  cool: boolean;
};

/** 3 位精度，避免浮点属性字符串过长 */
const n = (v: number, d = 2) => Number(v.toFixed(d));

/**
 * 生成单张封面的 SVG 字符串。与 CoverArt.tsx 视觉完全一致。
 * @param slug 文章 slug（确定性播种）
 * @param category 主题（决定 motif 印记）
 */
export function coverArtSvg(slug: string, category?: string): string {
  const rand = mulberry32(hashSlug(slug));
  const uid = `c${hashSlug(slug).toString(36)}`;

  const W = 800;
  const H = 600;
  const horizon = n(350 + rand() * 40);

  // 碑板布局
  const slabCount = 2 + Math.floor(rand() * 3);
  const slabs: Slab[] = [];
  let cursor = n(60 + rand() * 60);
  for (let i = 0; i < slabCount; i++) {
    const w = n(90 + rand() * 130);
    const top = n(60 + rand() * 140);
    slabs.push({
      x: cursor,
      w,
      top,
      tone: n(0.82 + rand() * 0.16),
      winW: n(w * (0.3 + rand() * 0.25)),
      winH: n(60 + rand() * 110),
      winY: n(top + 40 + rand() * 60),
      cool: rand() > 0.72,
    });
    cursor += w + n(70 + rand() * 110);
    if (cursor > W - 140) break;
  }

  // 主题印记：分类 key 直接匹配（posts.ts 由目录名推导，已是小写连字符形式）
  const motif = category ?? "";
  const motifX = n(560 + rand() * 120);
  const motifY = n(120 + rand() * 60);

  // 天光中心（独立 rand 顺序需与 CoverArt.tsx 一致）
  const glowCx = n(W * (0.2 + rand() * 0.2));
  const glowCy = n(H * 0.1);

  // 水纹（7 条，rand 顺序与 CoverArt 一致）
  const waterLines: { x: number; y: number; w: number; op: number }[] = [];
  for (let i = 0; i < 7; i++) {
    waterLines.push({
      x: n(40 + rand() * 500),
      y: n(horizon + 14 + i * 26 + rand() * 10),
      w: n(60 + rand() * 200),
      op: n(0.32 - i * 0.03),
    });
  }

  const parts: string[] = [];
  parts.push(
    `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${slug} 封面" preserveAspectRatio="xMidYMid slice">`,
  );

  // defs
  parts.push(`<defs>
  <linearGradient id="${uid}-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b3a891"/>
    <stop offset="0.55" stop-color="#ddd4c0"/>
    <stop offset="1" stop-color="#e6dfcc"/>
  </linearGradient>
  <linearGradient id="${uid}-floor" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#d9d1bd" stop-opacity="0"/>
    <stop offset="1" stop-color="#8f8571" stop-opacity="0.95"/>
  </linearGradient>
  <linearGradient id="${uid}-iri" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#8ba6b8"/>
    <stop offset="0.5" stop-color="#cfc4b8"/>
    <stop offset="1" stop-color="#b89ea8"/>
  </linearGradient>
  <radialGradient id="${uid}-glow" cx="0.5" cy="0.45" r="0.75">
    <stop offset="0" stop-color="#fdf8ec"/>
    <stop offset="1" stop-color="#fdf8ec" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="${uid}-vig" cx="0.5" cy="0.5" r="0.72">
    <stop offset="0.62" stop-color="#171512" stop-opacity="0"/>
    <stop offset="1" stop-color="#171512" stop-opacity="0.16"/>
  </radialGradient>
  <filter id="${uid}-grain">
    <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2"/>
    <feColorMatrix type="saturate" values="0"/>
  </filter>
  <pattern id="${uid}-scan" width="4" height="7" patternUnits="userSpaceOnUse">
    <rect width="4" height="1" y="0" fill="#171512" opacity="0.05"/>
  </pattern>
</defs>`);

  // 背景
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${uid}-sky)"/>`);
  parts.push(
    `<ellipse cx="${glowCx}" cy="${glowCy}" rx="${n(W * 0.5)}" ry="${n(H * 0.35)}" fill="url(#${uid}-glow)" opacity="0.55"/>`,
  );

  // 碑板
  for (const s of slabs) {
    const winColor = s.cool ? "#dbe7ef" : "#f8f1e0";
    parts.push(
      `<g>
  <rect x="${s.x}" y="${s.top}" width="${s.w}" height="${n(horizon - s.top)}" fill="#6f675a" opacity="${s.tone}"/>
  <rect x="${s.x}" y="${s.top}" width="${s.w}" height="${n(horizon - s.top)}" fill="#403a30" opacity="0.24"/>
  <rect x="${n(s.x - 1.2)}" y="${s.top}" width="2.4" height="${n(horizon - s.top)}" fill="url(#${uid}-iri)" opacity="0.7"/>
  <rect x="${n(s.x + (s.w - s.winW) / 2 - 12)}" y="${n(s.winY - 12)}" width="${n(s.winW + 24)}" height="${n(s.winH + 24)}" fill="url(#${uid}-glow)" opacity="0.95"/>
  <rect x="${n(s.x + (s.w - s.winW) / 2)}" y="${s.winY}" width="${s.winW}" height="${s.winH}" fill="${winColor}"/>
</g>`,
    );
  }

  // 反射（镜像 + 渐隐）
  const reflSlabs = slabs
    .map((s) => `<rect x="${s.x}" y="${s.top}" width="${s.w}" height="${n(horizon - s.top)}" fill="#5c5446"/>`)
    .join("");
  parts.push(
    `<g opacity="0.32" transform="translate(0 ${horizon * 2}) scale(1 -1)">${reflSlabs}</g>`,
  );
  parts.push(`<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#${uid}-floor)"/>`);

  // 水纹
  for (const wl of waterLines) {
    parts.push(
      `<rect x="${wl.x}" y="${wl.y}" width="${wl.w}" height="1.1" fill="#f5efe2" opacity="${wl.op}"/>`,
    );
  }
  parts.push(`<rect x="0" y="${n(horizon - 1)}" width="${W}" height="2" fill="#f8f3e6" opacity="0.85"/>`);
  parts.push(`<rect x="0" y="${n(horizon + 1)}" width="${W}" height="2.5" fill="#3f392e" opacity="0.14"/>`);

  // 主题印记：分类 key 与图形的映射。
  //   paper-reading → 错落折线（文献/书脊，含「引用块」的矩形标题区）
  //   soul          → 圆点矩阵（呼吸感的点阵）
  //   tech          → 碑文式矩形阵列（代码/碑文质感）
  //   projects      → 三条横线（文字行印记，呼应「项目叙事」）
  if (motif === "paper-reading") {
    parts.push(
      `<g stroke="#4c463a" stroke-width="1" opacity="0.5">
  <rect x="${motifX}" y="${motifY}" width="42" height="5" fill="#4c463a" stroke="none" opacity="0.85"/>
  <line x1="${motifX}" y1="${motifY + 14}" x2="${motifX + 86}" y2="${motifY + 14}"/>
  <line x1="${motifX}" y1="${motifY + 24}" x2="${motifX + 62}" y2="${motifY + 24}"/>
  <line x1="${motifX + 4}" y1="${motifY + 36}" x2="${motifX + 80}" y2="${motifY + 36}" stroke-dasharray="3 3"/>
</g>`,
    );
  } else if (motif === "soul") {
    const dots: string[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const rad = (r + c) % 4 === 0 ? 3 : 1.6;
        dots.push(`<circle cx="${motifX + c * 22}" cy="${motifY + r * 22}" r="${rad}"/>`);
      }
    }
    parts.push(`<g fill="#4c463a" opacity="0.45">${dots.join("")}</g>`);
  } else if (motif === "tech") {
    const rects: string[] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 3; c++) {
        rects.push(
          `<rect x="${motifX + c * 26}" y="${motifY + r * 13}" width="${14 + ((r * 7 + c * 3) % 3) * 6}" height="4"/>`,
        );
      }
    }
    parts.push(`<g fill="#4c463a" opacity="0.5">${rects.join("")}</g>`);
  } else if (motif === "projects") {
    parts.push(
      `<g stroke="#4c463a" stroke-width="2" opacity="0.5">
  <line x1="${motifX}" y1="${motifY}" x2="${motifX + 92}" y2="${motifY}"/>
  <line x1="${motifX}" y1="${motifY + 16}" x2="${motifX + 64}" y2="${motifY + 16}"/>
  <line x1="${motifX}" y1="${motifY + 32}" x2="${motifX + 78}" y2="${motifY + 32}"/>
</g>`,
    );
  }

  // 扫描线 + 颗粒 + 暗角
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${uid}-scan)"/>`);
  parts.push(`<rect width="${W}" height="${H}" filter="url(#${uid}-grain)" opacity="0.06"/>`);
  parts.push(`<rect width="${W}" height="${H}" fill="url(#${uid}-vig)"/>`);
  parts.push(
    `<rect width="${W}" height="${H}" fill="none" stroke="#171512" stroke-opacity="0.1" stroke-width="2"/>`,
  );

  parts.push("</svg>");
  return parts.join("");
}
