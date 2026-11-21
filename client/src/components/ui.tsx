import { ALargeSmall, BookOpen, CircleHelp, Languages, Moon, Pin, Presentation, Sun } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Shown } from "../lib/api";
import { usePrefs } from "../lib/prefs";
import { Logo } from "./Logo";

export function Controls() {
  const { t, size, theme, toggleLang, cycleSize, toggleTheme } = usePrefs();
  const sizeLabel = [t("textSizeNormal"), t("textSizeLarge"), t("textSizeXL")][size];
  return (
    <>
      <button type="button" className="ctl icon-only" onClick={toggleTheme} aria-label={theme === "dark" ? t("themeToLight") : t("themeToDark")} title={t("theme")}>
        {theme === "dark" ? <Sun size={20} aria-hidden /> : <Moon size={20} aria-hidden />}
      </button>
      <button type="button" className="ctl icon-only" onClick={cycleSize} aria-label={`Aa. ${sizeLabel}`} title={t("textSize")}>
        <ALargeSmall size={24} aria-hidden />
      </button>
      <button type="button" className="ctl" onClick={toggleLang} aria-label={`EN | اردو. ${t("langSwitch")}`}>
        <Languages size={18} aria-hidden />
        <span lang="en">EN</span> | <span lang="ur">اردو</span>
      </button>
    </>
  );
}

export function TopBar({ to = "/" }: { to?: string }) {
  return (
    <header className="nav">
      <Link className="brand" to={to}>
        <Logo />
        <span>Attentive</span>
      </Link>
      <Controls />
    </header>
  );
}

export function SkipLink() {
  const { t } = usePrefs();
  return (
    <a className="skip" href="#main">
      {t("skip")}
    </a>
  );
}

/** Giant two-colour headline from two translated words. */
export function Hero({ a, b, small = false, as: Tag = "h1" }: { a: string; b: string; small?: boolean; as?: "h1" | "p" }) {
  const { t } = usePrefs();
  return (
    <Tag className={`display${small ? " sm" : ""}`}>
      <span className="a">{t(a)}</span>
      {t(b) && <span className="b">{t(b)}</span>}
    </Tag>
  );
}

export function StudentTabs({ base }: { base: string }) {
  const { t } = usePrefs();
  const items = [
    { to: base, label: t("tabSlides"), icon: <Presentation size={22} aria-hidden />, end: true },
    { to: `${base}/pins`, label: t("tabPins"), icon: <Pin size={22} aria-hidden /> },
    { to: `${base}/help`, label: t("tabHelp"), icon: <CircleHelp size={22} aria-hidden /> },
  ];
  return (
    <nav className="tabs" aria-label={t("navLabel")}>
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className="tabi">
          {i.icon}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function AfterIcon() {
  return <BookOpen size={16} aria-hidden />;
}

/** Polite live region that is always in the page, so changes inside it are announced. */
export function Live({ children }: { children?: ReactNode }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

/** Modal bottom sheet with a focus trap, Escape to close and focus returned to the opener. */
export function Sheet({ titleId, onClose, children }: { titleId: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const root = ref.current!;
    const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button, [href], input, textarea, select, [tabindex]:not([tabindex="-1"])')).filter((el) => !el.hasAttribute("disabled"));
    (root.querySelector<HTMLElement>("textarea, input") ?? focusables()[0] ?? root).focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current();
      }
      if (e.key === "Tab") {
        const f = focusables();
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, []);
  return (
    <div className="dim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheetdlg" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <div className="grab" aria-hidden />
        {children}
      </div>
    </div>
  );
}

/** Label + input/textarea with an error that is linked to the field. */
export function Field({ label, error, id: idProp, children }: { label: string; error?: string; id?: string; children: (p: { id: string; "aria-invalid"?: "true"; "aria-describedby"?: string }) => ReactNode }) {
  const auto = useId();
  const id = idProp ?? auto;
  const errId = `${id}-err`;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, "aria-invalid": error ? "true" : undefined, "aria-describedby": error ? errId : undefined })}
      {error && (
        <div id={errId} className="err" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

/** Hand tally marks: four strokes struck through make five. Under 3 pins the server sends "few", shown as "a few". */
export function Tally({ shown, big = false }: { shown: Shown; big?: boolean }) {
  const { t } = usePrefs();
  if (shown === "none") return <span className="few">{t("noneYet")}</span>;
  if (shown === "few")
    return (
      <span className="few">
        <i aria-hidden />
        <i aria-hidden />
        <i aria-hidden />
        {t("aFew")}
      </span>
    );
  const full = Math.floor(shown / 5), rest = shown % 5;
  const group = (k: number, strike: boolean, key: string) => {
    const w = 6 + 5.5 * k;
    return (
      <svg key={key} viewBox={`0 0 ${w} 26`} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
        {Array.from({ length: k }, (_, i) => (
          <path key={i} d={`M${4 + 5.5 * i} 3v20`} />
        ))}
        {strike && <path className="strike" d={`M1 21L${w} 5`} />}
      </svg>
    );
  };
  return (
    <>
      <span className={`tally${big ? " big" : ""}`} role="img" aria-label={String(shown)}>
        {Array.from({ length: full }, (_, i) => group(4, true, `f${i}`))}
        {rest > 0 && group(rest, false, "r")}
      </span>
      <span className="tcount" aria-hidden>
        {shown}
      </span>
    </>
  );
}

export const shownText = (s: Shown, t: (k: string) => string) => (s === "none" ? t("noneYet") : s === "few" ? t("aFew") : String(s));
