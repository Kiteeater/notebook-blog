/**
 * 顶部雾纱：文档滚动页（文章 / Topics / About）的固定标题区下方，
 * 让滚过的内容溶入场景的雾，而不是撞上导航。
 * 与共享场景同色，不产生「面板感」。
 */
export default function TopVeil() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24 sm:h-28"
      style={{
        background:
          "linear-gradient(180deg, rgba(245,242,235,0.94) 0%, rgba(245,242,235,0.55) 55%, rgba(245,242,235,0) 100%)",
      }}
    />
  );
}
