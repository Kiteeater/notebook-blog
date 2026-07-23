/**
 * 程序生成的「档案版画」封面。
 * 按 slug 确定性播种：每篇文章得到同一视觉世界里独一无二的一帧——
 * 雾中碑板、发光窗洞、地面反射与细颗粒，与共享场景同源。
 * 全部为内联 SVG：无外链素材，不会加载失败。
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

type CoverArtProps = {
  slug: string;
  category?: string;
  className?: string;
};

export default function CoverArt({ slug, category, className }: CoverArtProps) {
  const rand = mulberry32(hashSlug(slug));
  const uid = `c${hashSlug(slug).toString(36)}`;

  const W = 800;
  const H = 600;
  const horizon = 350 + rand() * 40;

  // 碑板布局
  const slabCount = 2 + Math.floor(rand() * 3);
  const slabs: {
    x: number;
    w: number;
    top: number;
    tone: number;
    winW: number;
    winH: number;
    winY: number;
    cool: boolean;
  }[] = [];
  let cursor = 60 + rand() * 60;
  for (let i = 0; i < slabCount; i++) {
    const w = 90 + rand() * 130;
    const top = 60 + rand() * 140;
    slabs.push({
      x: cursor,
      w,
      top,
      tone: 0.82 + rand() * 0.16,
      winW: w * (0.3 + rand() * 0.25),
      winH: 60 + rand() * 110,
      winY: top + 40 + rand() * 60,
      cool: rand() > 0.72,
    });
    cursor += w + 70 + rand() * 110;
    if (cursor > W - 140) break;
  }

  // 主题印记
  const motif = (category ?? "").toLowerCase();
  const motifX = 560 + rand() * 120;
  const motifY = 120 + rand() * 60;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${slug} 封面`}
      className={className}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b3a891" />
          <stop offset="0.55" stopColor="#ddd4c0" />
          <stop offset="1" stopColor="#e6dfcc" />
        </linearGradient>
        <linearGradient id={`${uid}-floor`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#d9d1bd" stopOpacity="0" />
          <stop offset="1" stopColor="#8f8571" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id={`${uid}-iri`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8ba6b8" />
          <stop offset="0.5" stopColor="#cfc4b8" />
          <stop offset="1" stopColor="#b89ea8" />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="0.5" cy="0.45" r="0.75">
          <stop offset="0" stopColor="#fdf8ec" />
          <stop offset="1" stopColor="#fdf8ec" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${uid}-vig`} cx="0.5" cy="0.5" r="0.72">
          <stop offset="0.62" stopColor="#171512" stopOpacity="0" />
          <stop offset="1" stopColor="#171512" stopOpacity="0.16" />
        </radialGradient>
        <filter id={`${uid}-grain`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <pattern id={`${uid}-scan`} width="4" height="7" patternUnits="userSpaceOnUse">
          <rect width="4" height="1" y="0" fill="#171512" opacity="0.05" />
        </pattern>
      </defs>

      <rect width={W} height={H} fill={`url(#${uid}-sky)`} />

      {/* 天光 */}
      <ellipse cx={W * (0.2 + rand() * 0.2)} cy={H * 0.1} rx={W * 0.5} ry={H * 0.35} fill={`url(#${uid}-glow)`} opacity="0.55" />

      {/* 碑板（实体） */}
      {slabs.map((s, i) => (
        <g key={i}>
          <rect x={s.x} y={s.top} width={s.w} height={horizon - s.top} fill="#6f675a" opacity={s.tone} />
          <rect x={s.x} y={s.top} width={s.w} height={horizon - s.top} fill="#403a30" opacity="0.24" />
          {/* 虹彩边缘 */}
          <rect x={s.x - 1.2} y={s.top} width={2.4} height={horizon - s.top} fill={`url(#${uid}-iri)`} opacity="0.7" />
          {/* 发光窗洞 */}
          <rect
            x={s.x + (s.w - s.winW) / 2 - 12}
            y={s.winY - 12}
            width={s.winW + 24}
            height={s.winH + 24}
            fill={`url(#${uid}-glow)`}
            opacity="0.95"
          />
          <rect
            x={s.x + (s.w - s.winW) / 2}
            y={s.winY}
            width={s.winW}
            height={s.winH}
            fill={s.cool ? "#dbe7ef" : "#f8f1e0"}
          />
        </g>
      ))}

      {/* 反射（镜像 + 渐隐） */}
      <g opacity="0.32" transform={`translate(0 ${horizon * 2}) scale(1 -1)`}>
        {slabs.map((s, i) => (
          <rect key={i} x={s.x} y={s.top} width={s.w} height={horizon - s.top} fill="#5c5446" />
        ))}
      </g>
      <rect x="0" y={horizon} width={W} height={H - horizon} fill={`url(#${uid}-floor)`} />
      {/* 水纹 */}
      {Array.from({ length: 7 }).map((_, i) => (
        <rect
          key={i}
          x={40 + rand() * 500}
          y={horizon + 14 + i * 26 + rand() * 10}
          width={60 + rand() * 200}
          height={1.1}
          fill="#f5efe2"
          opacity={0.32 - i * 0.03}
        />
      ))}
      <rect x="0" y={horizon - 1} width={W} height={2} fill="#f8f3e6" opacity="0.85" />
      <rect x="0" y={horizon + 1} width={W} height={2.5} fill="#3f392e" opacity="0.14" />

      {/* 主题印记 */}
      {motif === "ai" && (
        <g fill="none" stroke="#4c463a" opacity="0.5">
          <circle cx={motifX} cy={motifY} r="26" strokeWidth="1.2" />
          <circle cx={motifX} cy={motifY} r="15" strokeWidth="1" opacity="0.7" />
          <circle cx={motifX} cy={motifY} r="5" strokeWidth="1" opacity="0.9" />
        </g>
      )}
      {motif === "programming" && (
        <g fill="#4c463a" opacity="0.5">
          {Array.from({ length: 5 }).map((_, r) =>
            Array.from({ length: 3 }).map((_, c) => (
              <rect
                key={`${r}-${c}`}
                x={motifX + c * 26}
                y={motifY + r * 13}
                width={14 + ((r * 7 + c * 3) % 3) * 6}
                height="4"
              />
            )),
          )}
        </g>
      )}
      {motif === "design" && (
        <g fill="#4c463a" opacity="0.45">
          {Array.from({ length: 4 }).map((_, r) =>
            Array.from({ length: 6 }).map((_, c) => (
              <circle key={`${r}-${c}`} cx={motifX + c * 22} cy={motifY + r * 22} r={(r + c) % 4 === 0 ? 3 : 1.6} />
            )),
          )}
        </g>
      )}
      {motif === "writing" && (
        <g stroke="#4c463a" strokeWidth="2" opacity="0.5">
          <line x1={motifX} y1={motifY} x2={motifX + 92} y2={motifY} />
          <line x1={motifX} y1={motifY + 16} x2={motifX + 64} y2={motifY + 16} />
          <line x1={motifX} y1={motifY + 32} x2={motifX + 78} y2={motifY + 32} />
        </g>
      )}

      {/* 扫描线 + 颗粒 + 暗角 */}
      <rect width={W} height={H} fill={`url(#${uid}-scan)`} />
      <rect width={W} height={H} filter={`url(#${uid}-grain)`} opacity="0.06" />
      <rect width={W} height={H} fill={`url(#${uid}-vig)`} />
      <rect width={W} height={H} fill="none" stroke="#171512" strokeOpacity="0.1" strokeWidth="2" />
    </svg>
  );
}
