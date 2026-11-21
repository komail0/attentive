import { CircleCheck, MessageSquare, RefreshCw, Send, TriangleAlert, Undo2, WifiOff, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Hero, Live, Sheet, SkipLink, StudentTabs, TopBar } from "../../components/ui";
import { usePrefs, slideTitle } from "../../lib/prefs";
import { StudentProvider, useStudent } from "../../lib/student";

export default function StudentLayout() {
  const { code = "" } = useParams();
  return (
    <StudentProvider code={code.toUpperCase()}>
      <Shell />
    </StudentProvider>
  );
}

function Shell() {
  const { t, lang } = usePrefs();
  const nav = useNavigate();
  const loc = useLocation();
  const { code, session, load, failed, notice, dialog, retry, cancel, undo, openComment, closeComment, refresh } = useStudent();
  const retryRef = useRef<HTMLButtonElement>(null);
  const base = `/s/${encodeURIComponent(code)}`;
  const onAfter = loc.pathname.endsWith("/after");

  useEffect(() => {
    if (failed) retryRef.current?.focus();
  }, [failed]);
  useEffect(() => {
    if (session?.status === "ended" && !onAfter) nav(`${base}/after`, { replace: true });
  }, [session?.status, onAfter, nav, base]);
  useEffect(() => {
    document.title = `${session ? session.title : t("brand")} · Attentive`;
  }, [session, t]);

  const waiting = load === "ok" && session?.status === "draft";
  const offline = load === "offline";
  const loading = load === "loading" && !session;
  const showTabs = !onAfter && !offline && !waiting && !loading;
  const dialogSlide = dialog !== null ? session?.slides.find((s) => s.n === dialog) : undefined;

  return (
    <div className="app">
      <SkipLink />
      <TopBar />
      <main className="body has-fab" id="main" tabIndex={-1}>
        <Live>
          {notice && (
            <div className="toast">
              <div className="warnrow">
                <span style={{ color: "var(--accent)" }}>
                  <CircleCheck size={22} aria-hidden />
                </span>
                <b>{notice.text}</b>
              </div>
              {notice.actions && notice.n !== undefined && (
                <div className="row2">
                  <button type="button" className="btn sm line" onClick={() => undo(notice.n!)}>
                    <Undo2 size={15} aria-hidden /> {t("undo")}
                  </button>
                  <button type="button" className="btn sm line" onClick={() => openComment(notice.n!)}>
                    <MessageSquare size={15} aria-hidden /> {t("addComment")}
                  </button>
                </div>
              )}
            </div>
          )}
        </Live>
        {failed && (
          <div className="toast warn" role="alert">
            <div className="warnrow">
              <TriangleAlert className="ic warn" size={22} aria-hidden />
              <span>
                <b>{failed.kind === "pin" ? t("errTitle") : t("undoErr")}</b>
                {failed.kind === "pin" ? <>. {t("errMsg")}</> : null}
              </span>
            </div>
            <div className="row2">
              <button type="button" className="btn sm" ref={retryRef} onClick={retry}>
                <RefreshCw size={15} aria-hidden /> {t("retry")}
              </button>
              <button type="button" className="btn sm line" onClick={cancel}>
                <X size={15} aria-hidden /> {t("cancel")}
              </button>
            </div>
          </div>
        )}
        {loading ? (
          <p className="sub" role="status">
            {t("joinChecking")}
          </p>
        ) : offline ? (
          <>
            <Hero a="h_off" b="h_line" small />
            <div className="empty" role="region" aria-label={t("offlineTitle")}>
              <span className="bigic warnic">
                <WifiOff size={40} aria-hidden />
              </span>
              <h2 className="h2">{t("offlineTitle")}</h2>
              <p className="sub">{t("offlineText")}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
                <button type="button" className="btn wide" onClick={() => void refresh()}>
                  <RefreshCw size={18} aria-hidden /> {t("tryAgain")}
                </button>
                <button type="button" className="btn line wide" onClick={() => nav("/")}>
                  {t("changeCode")}
                </button>
              </div>
            </div>
          </>
        ) : waiting ? (
          <>
            <Hero a="h_soon1" b="h_soon2" small />
            <div className="empty">
              <h2 className="h2">{t("waiting")}</h2>
              <p className="sub">{t("waitingSub")}</p>
              <button type="button" className="btn line" onClick={() => nav("/")}>
                {t("changeCode")}
              </button>
            </div>
          </>
        ) : (
          <Outlet />
        )}
      </main>
      {showTabs && <StudentTabs base={base} />}
      {dialog !== null && <CommentSheet n={dialog} title={dialogSlide ? slideTitle(dialogSlide, lang) : ""} onClose={closeComment} />}
    </div>
  );
}

function CommentSheet({ n, onClose }: { n: number; title: string; onClose: () => void }) {
  const { t } = usePrefs();
  const { sendComment } = useStudent();
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!text.trim()) {
      setErr(t("commentEmpty"));
      ta.current?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await sendComment(n, text.trim());
    } catch {
      setErr(t("commentErr"));
      setBusy(false);
      ta.current?.focus();
    }
  }
  return (
    <Sheet titleId="cm-title" onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div className="cardhead">
            <span className="cic">
              <MessageSquare size={22} aria-hidden />
            </span>
            <h2 className="h2" id="cm-title">
              {t("commentTitle")}
            </h2>
          </div>
          <p className="sub">{t("commentSub", { n })}</p>
        </div>
        <div className="field">
          <label htmlFor="cm-text">{t("commentLabel")}</label>
          <textarea
            id="cm-text"
            ref={ta}
            maxLength={280}
            value={text}
            placeholder={t("commentPlaceholder")}
            onChange={(e) => setText(e.target.value)}
            aria-invalid={err ? "true" : undefined}
            aria-describedby={`cm-count${err ? " cm-err" : ""}`}
          />
          <span id="cm-count" className="fine">
            {t("commentCount", { n: text.length })}
          </span>
          {err && (
            <div id="cm-err" className="err" role="alert">
              {err}
            </div>
          )}
        </div>
        <div className="row2">
          <button type="button" className="btn line" onClick={onClose}>
            <X size={18} aria-hidden /> {t("skip2")}
          </button>
          <button type="submit" className={`btn${busy ? " busy" : ""}`} aria-disabled={busy ? "true" : undefined}>
            <Send size={18} aria-hidden /> {busy ? t("sending") : t("sendComment")}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
