const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** ISO yyyy-mm-dd -> "Jul 20, 2026" */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** ISO yyyy-mm-dd -> "2026 / 07 / 20" 用于装饰性展示 */
export function formatDateSparse(iso: string): string {
  return iso.replaceAll("-", " / ");
}
