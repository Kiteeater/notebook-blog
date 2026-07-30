/**
 * 顶部雾纱：文档滚动页的固定标题区下方，
 * 让滚过的内容溶入场景，而不是撞上导航。
 *
 * tone="mist"  —— 默认：冷雾白（水下 / 通用页）
 * tone="sun"   —— 文章上岸：暖纸白，与 sunlight 场景同色相
 */
export default function TopVeil({ tone = "mist" }: { tone?: "mist" | "sun" }) {
  const bg =
    tone === "sun"
      ? "linear-gradient(180deg, rgba(246,243,236,0.96) 0%, rgba(246,243,236,0.52) 55%, rgba(246,243,236,0) 100%)"
      : "linear-gradient(180deg, rgba(245,242,235,0.94) 0%, rgba(245,242,235,0.55) 55%, rgba(245,242,235,0) 100%)";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 top-0 z-30 h-24 sm:h-28"
      style={{ background: bg }}
    />
  );
}
