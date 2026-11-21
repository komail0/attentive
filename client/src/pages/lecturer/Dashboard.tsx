import { MessageSquare, Monitor, Plus, Square, Users, Pin as PinIcon } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Live, Sheet, Tally } from "../../components/ui";
import { api, type LecturerSession } from "../../lib/api";
import { errKey } from "../../lib/auth";
import { usePrefs, slideTitle } from "../../lib/prefs";

export default function Dashboard() {
  const { id = "" } = useParams();
  const { t, lang } = usePrefs();
  const [s, setS] = useState<LecturerSession | null>(null);
  const [lost, setLost] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [line, setLine] = useState("");
  const [added, setAdded] = useState(false);
  const lineRef = useRef<HTMLTextAreaElement>(null);

  // Live updates over server-sent events. The browser reconnects by itself; we only show the state.
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${id}/stream`);
    es.onopen = () => setLost(false);
    es.onmessage = (e) => {
      setS(JSON.parse(e.data) as LecturerSession);
      setLost(false);
    };
    es.onerror = () => setLost(true);
    return () => es.close();
  }, [id]);

  useEffect(() => {
    document.title = `${s?.title ?? t("liveDash1")} · Attentive`;
  }, [s?.title, t]);

  if (s?.status === "ended") return <Navigate to={`/lecturer/sessions/${id}/report`} replace />;
  if (s?.status === "draft") return <Navigate to={`/lecturer/sessions/${id}/setup`} replace />;

  const act = async (path: string, body: unknown = {}) => {
    setErr("");
    try {
      await api(`/api/sessions/${id}/${path}`, { body });
      return true;
    } catch (e) {
      setErr(t(errKey(e)));
      return false;
    }
  };

  async function addLine(e: FormEvent) {
    e.preventDefault();
    const text = line.trim();
    if (!text) return;
    if (await act("transcript", { text })) {
      setLine("");
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
      lineRef.current?.focus();
    }
  }

  const slides = s?.slides ?? [];
  const selected = slides.find((x) => x.n === (sel ?? s?.current)) ?? slides[0];
  const empty = slides.every((x) => x.display === "none");
  const commentsFor = (n: number) => s?.comments.filter((c) => c.slide === n) ?? [];

  return (
    <Desk>
      {lost && (
        <div className="toast warn" role="alert">
          <b>{t("connLost")}</b>
        </div>
      )}
      {err && (
        <div className="err" role="alert">
          {err}
        </div>
      )}
      {!s || !selected ? (
        <p className="sub" role="status">
          {t("loading")}
        </p>
      ) : (
        <>
          <div className="dhero">
            <div>
              <span className="meta" dir="ltr">
                {t("liveNow")} · {s.code}
              </span>
              <h1 className="display">
                <span className="a">{t("liveDash1")}</span>
                <span className="b">{selected.n}</span>
              </h1>
            </div>
            <div className="tallybox">
              <Tally shown={selected.display} big />
              <span className="meta">{selected.n === s.hottest ? t("lectHottest") : t("lectPins")}</span>
            </div>
          </div>

          <div className="stats">
            <span className="pillstat">
              <Users size={18} aria-hidden /> {s.joined} {t("lectJoined")}
            </span>
            <span className="pillstat">
              <PinIcon size={18} aria-hidden /> {s.totalPins === "none" ? 0 : s.totalPins === "few" ? t("aFew") : s.totalPins} {t("lectPins")}
            </span>
            <span className="pillstat">
              <MessageSquare size={18} aria-hidden /> {s.comments.length} {t("lectComments")}
            </span>
            <span className="sp" />
            <button type="button" className="btn sm line" onClick={() => setConfirm(true)}>
              <Square size={16} aria-hidden /> {t("endLecture")}
            </button>
          </div>

          <div className="strip" role="group" aria-label={t("navDash")}>
            {slides.map((x) => {
              const nc = commentsFor(x.n).length;
              return (
                <button key={x.n} type="button" className="cell" aria-pressed={x.n === selected.n} onClick={() => setSel(x.n)}>
                  <span className="n">
                    <span className="sr-only">{t("slide")} </span>
                    {x.n}
                  </span>
                  <span className="tt" dir="auto">
                    {slideTitle(x, lang)}
                  </span>
                  <Tally shown={x.display} />
                  <span style={{ display: "flex", gap: 8, alignItems: "center", minHeight: 20 }}>
                    {x.n === s.current && <span className="now">{t("now")}</span>}
                    {nc > 0 && (
                      <span className="fine" style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                        <MessageSquare size={12} aria-hidden /> {nc}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {empty && (
            <Live>
              <div className="panel">
                <h2 className="h2">{t("emptyTitle")}</h2>
                <p className="sub">{t("emptyText")}</p>
              </div>
            </Live>
          )}

          <div className="cols">
            <section className="panel" aria-labelledby="sel-h">
              <span className="meta">
                {t("slide")} {selected.n}
              </span>
              <h2 className="h2" id="sel-h" dir="auto">
                {slideTitle(selected, lang)}
              </h2>
              {selected.n !== s.current && (
                <div>
                  <button type="button" className="btn sm" onClick={() => void act("current", { n: selected.n })}>
                    <Monitor size={16} aria-hidden /> {t("setCurrent")}
                  </button>
                </div>
              )}
              <p className="fine">{t("fewNoteLec")}</p>
              <span className="meta" style={{ marginTop: 6 }}>
                {t("anonCommentsLead")}
              </span>
              {commentsFor(selected.n).length === 0 ? (
                <p className="sub">{t("noCommentsYet")}</p>
              ) : (
                commentsFor(selected.n).map((c, i) => (
                  <div className="cmt" key={i} dir="auto">
                    {c.text}
                  </div>
                ))
              )}
              <p className="fine">{t("noNames")}</p>
            </section>

            <section className="panel tr" aria-labelledby="tr-h">
              <h2 className="h2" id="tr-h">
                {t("transcript")}
              </h2>
              <div className="scroll" tabIndex={0} role="log" aria-label={t("transcript")}>
                {s.transcript.length === 0 && <p className="sub">{t("noTranscript")}</p>}
                {s.transcript.map((l, i) => (
                  <p key={i}>
                    <span className="meta">{l.at}</span>
                    <br />
                    {l.text}
                  </p>
                ))}
              </div>
              <form onSubmit={addLine} style={{ display: "grid", gap: 8 }}>
                <div className="field">
                  <label htmlFor="line">{t("addLine")}</label>
                  <textarea id="line" ref={lineRef} value={line} onChange={(e) => setLine(e.target.value)} maxLength={600} placeholder={t("addLineHint")} style={{ minHeight: 84 }} />
                </div>
                <div className="row2" style={{ alignItems: "center" }}>
                  <button type="submit" className="btn sm" style={{ flex: "0 0 auto" }}>
                    <Plus size={16} aria-hidden /> {t("addLineBtn")}
                  </button>
                  <Live>{added && <span className="fine">{t("lineAdded")}</span>}</Live>
                </div>
              </form>
            </section>
          </div>
        </>
      )}
      {confirm && (
        <Sheet titleId="end-h" onClose={() => setConfirm(false)}>
          <h2 className="h2" id="end-h">
            {t("endConfirm")}
          </h2>
          <div className="row2">
            <button type="button" className="btn line" onClick={() => setConfirm(false)}>
              {t("cancel")}
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                setConfirm(false);
                await act("end");
              }}
            >
              {t("endLecture")}
            </button>
          </div>
        </Sheet>
      )}
    </Desk>
  );
}
