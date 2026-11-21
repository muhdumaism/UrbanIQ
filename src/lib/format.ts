export function timeAgo(iso: string | Date, now = Date.now()) {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h`;
  const d = h / 24;
  return `${Math.floor(d)}d`;
}
export function timeAgoLong(iso: string | Date) {
  const t = timeAgo(iso);
  if (t === "just now") return t;
  const n = parseInt(t);
  const unit = t.endsWith("m") ? "minute" : t.endsWith("h") ? "hour" : "day";
  return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
}
export function formatDateTime(iso: string | Date) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
