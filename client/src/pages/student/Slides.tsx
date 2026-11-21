import { Check, Pin, ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { usePrefs, slideSummary, slideTitle } from "../../lib/prefs";
import { useStudent } from "../../lib/student";

export default function Slides() {
  const { t, lang } = usePrefs();
  const { session, pinned, sending, failed, pin } = useStudent();
  useEffect(() => {
    document.title = `${t("tabSlides")} · Attentive`;
  }, [t]);
  if (!session) return null;
  const slides = [...session.slides].sort((a, b) => b.n - a.n);
  const currentDone = pinned.includes(session.current);
  const fabBusy = sending !== null;

  return (
    <>
      <div>
        <h1 className="display">
          <span className="a">{t("h_slide")}</span>
          <span className="b">{session.current}</span>
        </h1>
        <p className="meta" style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
          <ShieldCheck size={14} aria-hidden /> {t("metaB")}
        </p>
      </div>
      <section aria-labelledby="sl-h">
        <div className="sechead">
          <h2 id="sl-h" className="h2">
            {t("earlier")}
          </h2>
          <span className="meta">{t("slideCount", { n: slides.length })}</span>
        </div>
        <ul className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {slides.map((s) => {
            const on = s.n === session.current;
            const done = pinned.includes(s.n);
            const busy = sending === s.n;
            const bad = failed?.kind === "pin" && failed.n === s.n;
            const title = slideTitle(s, lang);
            const disabled = done || sending !== null;
            return (
              <li key={s.n} className={`row${on ? " on" : ""}${done ? " pinned" : ""}`}>
                <span className="num" aria-hidden>
                  {s.n}
                </span>
                <div>
                  <div className="ttl" dir="auto">
                    <span className="sr-only">
                      {t("slide")} {s.n}:{" "}
                    </span>
                    {title}
                    {on && <span className="chip">{t("now")}</span>}
                  </div>
                  <div className="sum" dir="auto">{slideSummary(s, lang)}</div>
                  {bad && (
                    <div className="err" style={{ marginTop: 6 }}>
                      <TriangleAlert className="ic warn" size={20} aria-hidden />
                      <span>{t("notSent")}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={`btn sm${done ? " done" : ""}${busy ? " busy" : ""}`}
                  aria-disabled={disabled ? "true" : undefined}
                  aria-label={done ? t("pinnedAria", { n: s.n, title }) : t("pinAria", { n: s.n, title })}
                  onClick={() => {
                    if (!disabled) void pin(s.n);
                  }}
                >
                  {busy ? t("sending") : done ? (<><Check size={15} aria-hidden /> {t("pinnedWord")}</>) : (<><Pin size={15} aria-hidden /> {t("pin")}</>)}
                </button>
              </li>
            );
          })}
        </ul>
      </section>
      <div className="fab-wrap">
        <button
          type="button"
          className="badge"
          aria-disabled={currentDone || fabBusy ? "true" : undefined}
          aria-label={currentDone ? t("pinnedAria", { n: session.current, title: slideTitle(slides.find((s) => s.n === session.current) ?? slides[0], lang) }) : t("pinThis")}
          onClick={() => {
            if (!currentDone && !fabBusy) void pin(session.current);
          }}
        >
          {currentDone ? <Check size={22} aria-hidden /> : <Pin size={22} aria-hidden />}
          <span>{currentDone ? t("pinnedBadge") : t("pinBadge")}</span>
        </button>
      </div>
    </>
  );
}
