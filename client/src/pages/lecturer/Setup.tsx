import { Copy, FileUp, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Field, Hero, Live } from "../../components/ui";
import { api, type LecturerSession } from "../../lib/api";
import { errKey } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { Steps } from "./Steps";

interface Draft {
  n: number;
  title: string;
  titleUr: string;
  summary: string;
  summaryUr: string;
}

/** Step 2 (upload and check slides) and step 3 (share the code and start). */
export default function Setup() {
  const { id = "" } = useParams();
  const { t } = usePrefs();
  const nav = useNavigate();
  const [session, setSession] = useState<LecturerSession | null>(null);
  const [step, setStep] = useState<2 | 3>(2);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<"" | "upload" | "save" | "start">("");
  const [err, setErr] = useState("");
  const [over, setOver] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const adopt = useCallback((s: LecturerSession) => {
    setSession(s);
    setDrafts(s.slides.map((x) => ({ n: x.n, title: x.title, titleUr: x.titleUr, summary: x.summary, summaryUr: x.summaryUr })));
  }, []);

  useEffect(() => {
    api<{ session: LecturerSession }>(`/api/sessions/${id}`).then((r) => adopt(r.session), (e) => setErr(t(errKey(e))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adopt]);
  useEffect(() => {
    document.title = `${t("newSession")} · Attentive`;
  }, [t]);

  if (session && session.status !== "draft") return <Navigate to={`/lecturer/sessions/${id}`} replace />;

  async function upload(file: File | undefined) {
    if (!file) return;
    setErr("");
    if (file.size > 50 * 1024 * 1024) return setErr(t("err_file_too_large"));
    setBusy("upload");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ session: LecturerSession }>(`/api/sessions/${id}/slides/upload`, { form, timeout: 120_000 });
      adopt(r.session);
    } catch (e) {
      setErr(t(errKey(e)));
    }
    setBusy("");
  }

  const patch = (n: number, key: keyof Draft, value: string) => setDrafts((d) => d.map((x) => (x.n === n ? { ...x, [key]: value } : x)));
  const addSlide = () => setDrafts((d) => [...d, { n: (d.at(-1)?.n ?? 0) + 1, title: "", titleUr: "", summary: "", summaryUr: "" }]);
  const removeSlide = (n: number) => setDrafts((d) => d.filter((x) => x.n !== n));

  async function save(): Promise<boolean> {
    setErr("");
    if (drafts.length === 0 || drafts.some((d) => !d.title.trim())) {
      setErr(t("err_invalid_input"));
      return false;
    }
    setBusy("save");
    try {
      const r = await api<{ session: LecturerSession }>(`/api/sessions/${id}/slides`, { method: "PUT", body: { slides: drafts.map((d) => ({ ...d, title: d.title.trim() })) } });
      adopt(r.session);
      setBusy("");
      return true;
    } catch (e) {
      setErr(t(errKey(e)));
      setBusy("");
      return false;
    }
  }

  async function start() {
    setBusy("start");
    setErr("");
    try {
      await api(`/api/sessions/${id}/start`, { body: {} });
      nav(`/lecturer/sessions/${id}`);
    } catch (e) {
      setErr(t(errKey(e)));
      setBusy("");
    }
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(session?.code ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard can be blocked: the code is on screen anyway */
    }
  };

  return (
    <Desk>
      <Hero a="newSession1" b="newSession2" small />
      <Steps current={step} />
      {err && (
        <div className="err" role="alert">
          {err}
        </div>
      )}
      {step === 2 && (
        <>
          <div
            className={`drop${over ? " over" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void upload(e.dataTransfer.files[0]);
            }}
          >
            <span className="bigic" style={{ background: "transparent", border: "2px dashed var(--line)", color: "var(--text)" }}>
              <FileUp size={40} aria-hidden />
            </span>
            <h2 className="h2">{t("dropTitle")}</h2>
            <span className="sub">{t("dropSub")}</span>
            <input ref={fileRef} type="file" accept="application/pdf,.pdf" className="sr-only" id="pdf" aria-label={t("chooseFile")} onChange={(e) => void upload(e.target.files?.[0])} />
            <button type="button" className={`btn line sm${busy === "upload" ? " busy" : ""}`} aria-disabled={busy === "upload" ? "true" : undefined} onClick={() => busy !== "upload" && fileRef.current?.click()}>
              {t("chooseFile")}
            </button>
            <Live>{busy === "upload" && <span className="sub">{t("uploading")}</span>}</Live>
          </div>
          <section className="panel" aria-labelledby="sl-edit">
            <h2 id="sl-edit" style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700 }}>
              {drafts.length ? t("slidesFound", { n: drafts.length }) : t("noSlidesYet")}
            </h2>
            {drafts.map((d) => (
              <div className="slide-edit" key={d.n}>
                <span className="num" aria-hidden>
                  {d.n}
                </span>
                <div style={{ display: "grid", gap: 10 }}>
                  <Field label={t("slideTitleLabel")}>{(p) => <input {...p} value={d.title} onChange={(e) => patch(d.n, "title", e.target.value)} maxLength={160} />}</Field>
                  <Field label={t("slideSummaryLabel")}>{(p) => <input {...p} value={d.summary} onChange={(e) => patch(d.n, "summary", e.target.value)} maxLength={300} />}</Field>
                  <div>
                    <button type="button" className="btn sm line" onClick={() => removeSlide(d.n)} aria-label={`${t("delete")}: ${t("slide")} ${d.n}`}>
                      <Trash2 size={16} aria-hidden /> {t("delete")}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div className="row2">
              <button type="button" className="btn sm line" onClick={addSlide}>
                <Plus size={16} aria-hidden /> {t("slide")}
              </button>
              <button
                type="button"
                className={`btn${busy === "save" ? " busy" : ""}`}
                aria-disabled={busy === "save" || drafts.length === 0 ? "true" : undefined}
                onClick={async () => {
                  if (busy || drafts.length === 0) return;
                  if (await save()) setStep(3);
                }}
              >
                {busy === "save" ? t("saving") : t("continue")}
              </button>
            </div>
          </section>
        </>
      )}
      {step === 3 && session && (
        <div className="panel" style={{ alignItems: "center", textAlign: "center", padding: 44 }}>
          <span className="meta">{t("tellStudents")}</span>
          <div className="code" dir="ltr" aria-label={session.code.split("").join(" ")}>
            {session.code}
          </div>
          <span className="sub">{t("noNameNeeded")}</span>
          <div className="row2" style={{ justifyContent: "center" }}>
            <button type="button" className="btn line" onClick={copy}>
              <Copy size={18} aria-hidden /> {copied ? t("copied") : t("copyCode")}
            </button>
            <button type="button" className={`btn${busy === "start" ? " busy" : ""}`} aria-disabled={busy === "start" ? "true" : undefined} onClick={() => busy !== "start" && void start()}>
              <Play size={18} aria-hidden /> {t("startLecture")}
            </button>
          </div>
          <button type="button" className="btn sm line" onClick={() => setStep(2)}>
            {t("step2")}
          </button>
        </div>
      )}
    </Desk>
  );
}
