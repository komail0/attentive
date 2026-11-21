import { BookOpen, FileText, Pin } from "lucide-react";
import { useEffect, useState } from "react";
import { Hero } from "../../components/ui";
import { api, type PublicSession } from "../../lib/api";
import { usePrefs, slideSummary, slideTitle } from "../../lib/prefs";
import { useStudent } from "../../lib/student";

interface After {
  session: PublicSession;
  transcript: { at: string; text: string }[];
}

/** Study resource after the lecture: summaries and transcript for every student, pinned slides first. */
export default function After() {
  const { t, lang } = usePrefs();
  const { code, pinned } = useStudent();
  const [data, setData] = useState<After | null>(null);
  const [failed, setFailed] = useState(false);
  const [tab, setTab] = useState<"summaries" | "transcript">("summaries");

  useEffect(() => {
    document.title = `${t("recap")} · Attentive`;
  }, [t]);
  useEffect(() => {
    api<After>(`/api/s/${encodeURIComponent(code)}/after`).then(setData, () => setFailed(true));
  }, [code]);

  const slides = data ? [...data.session.slides].sort((a, b) => Number(pinned.includes(b.n)) - Number(pinned.includes(a.n)) || a.n - b.n) : [];
  return (
    <>
      <Hero a="h_re" b="h_cap" small />
      <p className="sub">
        {data?.session.title} · {t("ended")}. {t("afterSub")}
      </p>
      <div className="seg" role="group" aria-label={t("recap")}>
        <button type="button" aria-pressed={tab === "summaries"} onClick={() => setTab("summaries")}>
          <BookOpen size={16} aria-hidden /> {t("summaries")}
        </button>
        <button type="button" aria-pressed={tab === "transcript"} onClick={() => setTab("transcript")}>
          <FileText size={16} aria-hidden /> {t("transcriptTab")}
        </button>
      </div>
      {failed ? (
        <p className="err" role="alert">
          {t("err_network")}
        </p>
      ) : !data ? (
        <p className="sub" role="status">
          {t("loading")}
        </p>
      ) : tab === "summaries" ? (
        slides.length === 0 ? (
          <p className="sub">{t("afterEmpty")}</p>
        ) : (
          <ul className="rows" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {slides.map((s) => {
              const mine = pinned.includes(s.n);
              return (
                <li key={s.n} className={`row${mine ? " pinned" : ""}`} style={{ gridTemplateColumns: "3.5rem 1fr" }}>
                  <span className="num" aria-hidden>
                    {s.n}
                  </span>
                  <div>
                    <div className="ttl">
                      <span className="sr-only">
                        {t("slide")} {s.n}:{" "}
                      </span>
                      {slideTitle(s, lang)}
                    </div>
                    <div className="sum" dir="auto">{slideSummary(s, lang)}</div>
                    {mine && (
                      <div style={{ color: "var(--accent)", display: "flex", gap: 6, alignItems: "center", fontWeight: 800, marginTop: 6 }}>
                        <Pin size={14} aria-hidden /> {t("yourPin")}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : data.transcript.length === 0 ? (
        <p className="sub">{t("noTranscript")}</p>
      ) : (
        <div className="card">
          <div className="tl">
            {data.transcript.map((l, i) => (
              <div key={i}>
                <div className="ts">{l.at}</div>
                <div>{l.text}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
