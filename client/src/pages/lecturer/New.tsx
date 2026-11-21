import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Field, Hero } from "../../components/ui";
import { api, type LecturerSession } from "../../lib/api";
import { errKey } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";
import { Steps } from "./Steps";

export default function NewSession() {
  const { t } = usePrefs();
  const nav = useNavigate();
  const [title, setTitle] = useState("");
  const [course, setCourse] = useState("");
  const [language, setLanguage] = useState<"both" | "en">("both");
  const [titleErr, setTitleErr] = useState("");
  const [formErr, setFormErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${t("newSession")} · Attentive`;
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) {
      setTitleErr(t("err_invalid_input"));
      document.getElementById("f-title")?.focus();
      return;
    }
    setTitleErr("");
    setBusy(true);
    try {
      const r = await api<{ session: LecturerSession }>("/api/sessions", { body: { title: title.trim(), course: course.trim(), language } });
      nav(`/lecturer/sessions/${r.session.id}/setup`);
    } catch (ex) {
      setFormErr(t(errKey(ex)));
      setBusy(false);
    }
  }

  return (
    <Desk>
      <Hero a="newSession1" b="newSession2" small />
      <Steps current={1} />
      <form className="panel" onSubmit={submit} noValidate style={{ maxWidth: "40rem" }}>
        <Field label={t("lectureTitle")} error={titleErr}>
          {(p) => <input {...p} id="f-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} />}
        </Field>
        <Field label={t("course")}>{(p) => <input {...p} value={course} onChange={(e) => setCourse(e.target.value)} maxLength={120} />}</Field>
        <div className="field" role="group" aria-labelledby="lang-l">
          <span id="lang-l" className="meta">
            {t("studentLang")}
          </span>
          <div className="seg" style={{ maxWidth: "24rem" }}>
            <button type="button" aria-pressed={language === "both"} onClick={() => setLanguage("both")}>
              {t("langBoth")}
            </button>
            <button type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>
              {t("langEn")}
            </button>
          </div>
        </div>
        {formErr && (
          <div className="err" role="alert">
            {formErr}
          </div>
        )}
        <div>
          <button type="submit" className={`btn${busy ? " busy" : ""}`} aria-disabled={busy ? "true" : undefined}>
            {busy ? t("saving") : t("continue")}
          </button>
        </div>
      </form>
    </Desk>
  );
}
