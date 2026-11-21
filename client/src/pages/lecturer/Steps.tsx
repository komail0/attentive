import { usePrefs } from "../../lib/prefs";

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = usePrefs();
  return (
    <ol className="steps" style={{ listStyle: "none", margin: 0, padding: 0 }} aria-label={t("newSession")}>
      {([1, 2, 3] as const).map((i) => (
        <li key={i} className={`step${i === current ? " on" : ""}`} aria-current={i === current ? "step" : undefined}>
          {i}. {t(`step${i}`)}
        </li>
      ))}
    </ol>
  );
}
