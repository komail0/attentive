import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Hero, Tally } from "../../components/ui";
import { api, type LecturerSession, type Shown } from "../../lib/api";
import { errKey } from "../../lib/auth";
import { usePrefs, slideTitle } from "../../lib/prefs";

const rank = (s: Shown) => (s === "none" ? -1 : s === "few" ? 0 : s);

export default function Report() {
  const { id = "" } = useParams();
  const { t, lang } = usePrefs();
  const [r, setR] = useState<LecturerSession | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api<{ report: LecturerSession }>(`/api/sessions/${id}/report`).then((x) => setR(x.report), (e) => setErr(t(errKey(e))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => {
    document.title = `${r?.title ?? t("reportTitle1")} · Attentive`;
  }, [r?.title, t]);

  if (r?.status === "live") return <Navigate to={`/lecturer/sessions/${id}`} replace />;
  if (r?.status === "draft") return <Navigate to={`/lecturer/sessions/${id}/setup`} replace />;

  const rows = r ? [...r.slides].filter((s) => s.display !== "none").sort((a, b) => rank(b.display) - rank(a.display) || a.n - b.n) : [];
  const total = r ? (r.totalPins === "none" ? 0 : r.totalPins === "few" ? t("aFew") : r.totalPins) : 0;
  const top = r?.hottest ?? null;

  return (
    <Desk>
      <Hero a="reportTitle1" b="reportTitle2" small />
      {err && (
        <div className="err" role="alert">
          {err}
        </div>
      )}
      {!r ? (
        <p className="sub" role="status">
          {t("loading")}
        </p>
      ) : (
        <>
          <p className="sub">{t("reportSub", { title: r.title, joined: r.joined, pins: String(total), comments: r.comments.length })}</p>
          <div className="row2 no-print" style={{ flexWrap: "wrap" }}>
            <button type="button" className="btn sm" style={{ flex: "0 0 auto" }} onClick={() => window.print()}>
              <Printer size={16} aria-hidden /> {t("printReport")}
            </button>
            <Link className="btn sm line" style={{ flex: "0 0 auto" }} to="/lecturer/sessions">
              {t("backToSessions")}
            </Link>
          </div>
          <div className="cols">
            <section className="panel" aria-labelledby="pb">
              <h2 className="h2" id="pb">
                {t("pinsBySlide")}
              </h2>
              {rows.length === 0 ? (
                <p className="sub">{t("emptyTitle")}</p>
              ) : (
                <div className="tablewrap">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th scope="col">{t("colSlide")}</th>
                        <th scope="col">{t("colTitle")}</th>
                        <th scope="col">{t("colPins")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((s) => (
                        <tr key={s.n}>
                          <td>
                            <b>{s.n}</b>
                          </td>
                          <td dir="auto">{slideTitle(s, lang)}</td>
                          <td>
                            <Tally shown={s.display} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="fine">{t("fewNoteLec")}</p>
            </section>
            <section className="panel" aria-labelledby="fn">
              <h2 className="h2" id="fn">
                {t("forNext")}
              </h2>
              <p>{top !== null ? t("forNextText", { n: top }) : t("forNextNone")}</p>
              <span className="meta">{t("anonCommentsLead")}</span>
              {r.comments.length === 0 ? (
                <p className="sub">{t("noCommentsYet")}</p>
              ) : (
                r.comments.map((c, i) => (
                  <div className="cmt" key={i} dir="auto">
                    <span className="meta">
                      {t("slide")} {c.slide}
                    </span>
                    <br />
                    {c.text}
                  </div>
                ))
              )}
            </section>
          </div>
          <section className="panel tr" aria-labelledby="trh">
            <h2 className="h2" id="trh">
              {t("transcriptTab")}
            </h2>
            {r.transcript.length === 0 && <p className="sub">{t("noTranscript")}</p>}
            {r.transcript.map((l, i) => (
              <p key={i}>
                <span className="meta">{l.at}</span>
                <br />
                {l.text}
              </p>
            ))}
          </section>
        </>
      )}
    </Desk>
  );
}
