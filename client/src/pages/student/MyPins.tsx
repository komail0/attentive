import { Pin, Undo2 } from "lucide-react";
import { useEffect } from "react";
import { Hero } from "../../components/ui";
import { usePrefs, slideTitle } from "../../lib/prefs";
import { useStudent } from "../../lib/student";

export default function MyPins() {
  const { t, lang } = usePrefs();
  const { session, pinned, sending, undo } = useStudent();
  useEffect(() => {
    document.title = `${t("tabPins")} · Attentive`;
  }, [t]);
  const list = [...pinned].sort((a, b) => b - a).map((n) => session?.slides.find((s) => s.n === n)).filter((s): s is NonNullable<typeof s> => Boolean(s));
  return (
    <>
      <Hero a="h_my" b="h_pins" small />
      <p className="sub">{t("myPinsSub")}</p>
      {list.length === 0 ? (
        <div className="empty">
          <span className="bigic">
            <Pin size={40} aria-hidden />
          </span>
          <p className="sub">{t("myPinsEmpty")}</p>
        </div>
      ) : (
        <ul className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {list.map((s) => (
            <li key={s.n} className="row pinned">
              <span className="num" aria-hidden>
                {s.n}
              </span>
              <div className="ttl">
                <span className="sr-only">
                  {t("slide")} {s.n}:{" "}
                </span>
                {slideTitle(s, lang)}
              </div>
              <button
                type="button"
                className="btn sm line"
                aria-disabled={sending !== null ? "true" : undefined}
                aria-label={`${t("undo")}: ${t("slide")} ${s.n}`}
                onClick={() => {
                  if (sending === null) void undo(s.n);
                }}
              >
                <Undo2 size={15} aria-hidden /> {t("undo")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
