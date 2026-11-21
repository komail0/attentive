import { useEffect, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Desk } from "../../components/Desk";
import { Field, Hero } from "../../components/ui";
import { ApiError } from "../../lib/api";
import { errKey, useAuth } from "../../lib/auth";
import { usePrefs } from "../../lib/prefs";

export default function Login({ mode }: { mode: "signin" | "register" }) {
  const { t } = usePrefs();
  const { state, signIn, register } = useAuth();
  const nav = useNavigate();
  const reg = mode === "register";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errs, setErrs] = useState<{ name?: string; email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.title = `${reg ? t("lecRegister") : t("lecSignIn")} · Attentive`;
  }, [reg, t]);

  if (state.status === "in") return <Navigate to="/lecturer/sessions" replace />;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const next: typeof errs = {};
    if (reg && !name.trim()) next.name = t("err_invalid_input");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) next.email = t("err_invalid_input");
    if (reg ? password.length < 10 : !password) next.password = reg ? t("passwordHint") : t("err_invalid_input");
    setErrs(next);
    if (Object.keys(next).length) {
      document.getElementById(next.name ? "f-name" : next.email ? "f-email" : "f-password")?.focus();
      return;
    }
    setBusy(true);
    try {
      if (reg) await register(name.trim(), email.trim(), password);
      else await signIn(email.trim(), password);
      nav("/lecturer/sessions");
    } catch (ex) {
      setErrs({ form: t(errKey(ex)) });
      if (ex instanceof ApiError && ex.code === "email_taken") setErrs({ email: t("err_email_taken") });
      setBusy(false);
    }
  }

  return (
    <Desk signedIn={false}>
      <Hero a={reg ? "lecJoin1" : "lecWelcome1"} b={reg ? "lecJoin2" : "lecWelcome2"} small />
      <form className="authcard" onSubmit={submit} noValidate>
        <p className="sub">{t("lecAuthSub")}</p>
        {reg && (
          <Field label={t("fullName")} error={errs.name}>
            {(p) => <input {...p} id="f-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />}
          </Field>
        )}
        <Field label={t("email")} error={errs.email}>
          {(p) => <input {...p} id="f-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />}
        </Field>
        <Field label={t("password")} error={errs.password}>
          {(p) => <input {...p} id="f-password" type="password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={reg ? "new-password" : "current-password"} />}
        </Field>
        {reg && <span className="fine">{t("passwordHint")}</span>}
        {errs.form && (
          <div className="err" role="alert">
            {errs.form}
          </div>
        )}
        <button type="submit" className={`btn wide${busy ? " busy" : ""}`} aria-disabled={busy ? "true" : undefined}>
          {busy ? t("saving") : reg ? t("lecRegister") : t("lecSignIn")}
        </button>
        <p className="fine">
          {reg ? (
            <Link to="/lecturer/login">{t("lecHave")}</Link>
          ) : (
            <Link to="/lecturer/register">{t("lecNew")}</Link>
          )}
        </p>
      </form>
    </Desk>
  );
}
