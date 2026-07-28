/**
 * 程序生成的「档案版画」封面 —— React 薄壳。
 *
 * 实际 SVG 生成在 coverArtSvg.ts（纯函数，无 React 依赖），
 * 这里用 dangerouslySetInnerHTML 挂载，保持 DOM 渲染路径不变。
 *
 * 两处复用同一份 SVG 逻辑：
 * - 本组件（DOM 卡片，降级路径）
 * - CardSceneCanvas（WebGL 纹理，直接调 coverArtSvg）
 *
 * 液体折射：不在本组件挂 filter，由调用方在合适的外层挂
 * filter:url(#liquid-cover)（避免与 .cover-media 的 DOF blur 冲突）。
 */
import { coverArtSvg } from "./coverArtSvg";

type CoverArtProps = {
  slug: string;
  category?: string;
  className?: string;
};

export default function CoverArt({ slug, category, className }: CoverArtProps) {
  return (
    <div
      className={className}
      role="img"
      aria-label={`${slug} 封面`}
      dangerouslySetInnerHTML={{ __html: coverArtSvg(slug, category) }}
    />
  );
}
