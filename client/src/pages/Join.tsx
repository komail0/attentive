import { ShieldCheck, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Hero, SkipLink, TopBar } from "../components/ui";
import { api, ApiError } from "../lib/api";
import { usePrefs } from "../lib/prefs";

export default function Join() {
  const { t } = usePrefs();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [code, setCode] = useState((params.get("code") ?? "").toUpperCase().slice(0, 12));
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = `${t("joinTitle")} · Attentive`;
  }, [t]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const c = code.trim().toUpperCase();
    if (!c) {
      setErr(t("joinEmpty"));
      input.current?.focus();
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api(`/api/s/${encodeURIComponent(c)}/state`);
      nav(`/s/${encodeURIComponent(c)}`);
    } catch (ex) {
      setErr(ex instanceof ApiError && ex.status === 404 ? t("joinError") : t("joinNet"));
      setBusy(false);
      input.current?.focus();
    }
  }

  return (
    <div className="app">
      <SkipLink />
      <TopBar />
      <main className="body" id="main" tabIndex={-1}>
        <Hero a="h_join1" b="h_join2" small />
        <p className="sub">{t("joinSub")}</p>
        <form onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="field">
            <label htmlFor="code">{t("joinLabel")}</label>
            <input
              id="code"
              ref={input}
              className="code-input"
              dir="ltr"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder={t("joinPlaceholder")}
              autoComplete="off"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              maxLength={12}
              aria-invalid={err ? "true" : undefined}
              aria-describedby={err ? "code-err" : undefined}
            />
          </div>
          {err && (
            <div id="code-err" className="err" role="alert">
              <TriangleAlert className="ic warn" size={22} aria-hidden />
              <span>{err}</span>
            </div>
          )}
          <button type="submit" className={`btn wide${busy ? " busy" : ""}`} aria-disabled={busy ? "true" : undefined}>
            {busy ? t("joinChecking") : t("joinBtn")}
          </button>
          <p className="fine" style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <ShieldCheck size={18} aria-hidden className="ic" />
            <span>{t("joinNote")}</span>
          </p>
        </form>
        <p className="fine" style={{ marginTop: "auto" }}>
          <Link to="/lecturer" className="textlink">{t("lecturerLink")}</Link>
        </p>
      </main>
    </div>
  );
}
