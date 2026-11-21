import { Play, Plus, FileText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Hero, shownText } from "../../components/ui";
import { api, type SessionListItem } from "../../lib/api";
import { errKey } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { formatWhen } from "../../lib/format";

export default function Sessions() {
  const { t, lang } = usePrefs();
  const [items, setItems] = useState<SessionListItem[] | null>(null);
  const [err, setErr] = useState("");

  const load = () => api<{ sessions: SessionListItem[] }>("/api/sessions").then((r) => setItems(r.sessions), (e) => setErr(t(errKey(e))));
  useEffect(() => {
    document.title = `${t("navSessions")} · Attentive`;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(s: SessionListItem) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      await api(`/api/sessions/${s.id}`, { method: "DELETE" });
      setItems((x) => x?.filter((i) => i.id !== s.id) ?? null);
    } catch (e) {
      setErr(t(errKey(e)));
    }
  }

  return (
    <Desk>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <Hero a="mySessions1" b="mySessions2" small />
        <Link className="btn" to="/lecturer/new">
          <Plus size={18} aria-hidden /> {t("newSession")}
        </Link>
      </div>
      {err && (
        <div className="err" role="alert">
          {err}
        </div>
      )}
      {items === null ? (
        <p className="sub" role="status">
          {t("loading")}
        </p>
      ) : items.length === 0 ? (
        <div className="panel">
          <p className="sub">{t("noSessions")}</p>
        </div>
      ) : (
        <div className="panel tablewrap">
          <table className="tbl">
            <caption className="sr-only">{t("mySessions1")} {t("mySessions2")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("colCode")}</th>
                <th scope="col">{t("colLecture")}</th>
                <th scope="col">{t("colStarted")}</th>
                <th scope="col">{t("colStatus")}</th>
                <th scope="col">{t("colPins")}</th>
                <th scope="col">
                  <span className="sr-only">{t("edit")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <b dir="ltr">{s.code}</b>
                  </td>
                  <td>
                    {s.title}
                    {s.course && <div className="fine">{s.course}</div>}
                  </td>
                  <td>{formatWhen(s.startedAt ?? s.createdAt, lang)}</td>
                  <td>{s.status === "live" ? t("stLive") : s.status === "ended" ? t("stEnded") : t("stDraft")}</td>
                  <td>{shownText(s.pins, t)}</td>
                  <td>
                    <div className="row2" style={{ flexWrap: "nowrap" }}>
                      <Link className="btn sm line" to={s.status === "draft" ? `/lecturer/sessions/${s.id}/setup` : `/lecturer/sessions/${s.id}`} style={{ whiteSpace: "nowrap" }}>
                        {s.status === "live" ? <Play size={16} aria-hidden /> : <FileText size={16} aria-hidden />}{" "}
                        {s.status === "live" ? t("openDash") : s.status === "ended" ? t("viewReport") : t("continueSetup")}
                      </Link>
                      {s.status !== "live" && (
                        <button type="button" className="btn sm line" onClick={() => remove(s)} aria-label={`${t("delete")}: ${s.title}`}>
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Desk>
  );
}
