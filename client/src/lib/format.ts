import type { Lang } from "./prefs";

/** The server stores UTC as "YYYY-MM-DD HH:MM:SS". Show it in the viewer's own time zone. */
export function formatWhen(value: string | null, lang: Lang): string {
  if (!value) return "—";
  const d = new Date(value.replace(" ", "T") + "Z");
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "ur" ? "ur-PK" : "en-GB", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
