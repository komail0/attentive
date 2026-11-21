import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import en from "../i18n/en.json";
import ur from "../i18n/ur.json";

export type Lang = "en" | "ur";
export type Theme = "dark" | "light";
type Strings = Record<string, string>;
const STR: Record<Lang, Strings> = { en: en as Strings, ur: ur as Strings };

const read = (k: string, d: string) => {
  try {
    return localStorage.getItem(k) ?? d;
  } catch {
    return d;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* storage can be blocked: the choice just lasts for this visit */
  }
};

interface Prefs {
  lang: Lang;
  size: number;
  theme: Theme;
  t: (key: string, vars?: Record<string, string | number>) => string;
  toggleLang: () => void;
  cycleSize: () => void;
  toggleTheme: () => void;
}
const Ctx = createContext<Prefs | null>(null);
export const usePrefs = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("PrefsProvider missing");
  return v;
};

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(read("att-lang", "en") === "ur" ? "ur" : "en");
  const [size, setSize] = useState(Math.min(2, Math.max(0, Number(read("att-size", "0")) || 0)));
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme === "light" ? "light" : "dark"));

  useEffect(() => {
    const h = document.documentElement;
    h.lang = lang;
    h.dir = lang === "ur" ? "rtl" : "ltr";
    h.dataset.size = String(size);
    h.dataset.theme = theme;
    write("att-lang", lang);
    write("att-size", String(size));
    write("att-theme", theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#28272C" : "#F4EFE1");
  }, [lang, size, theme]);

  const t = useCallback(
    (key: string, vars: Record<string, string | number> = {}) => {
      let s = STR[lang][key] ?? STR.en[key] ?? key;
      for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
      return s;
    },
    [lang],
  );

  const value = useMemo<Prefs>(
    () => ({
      lang,
      size,
      theme,
      t,
      toggleLang: () => setLang((l) => (l === "en" ? "ur" : "en")),
      cycleSize: () => setSize((s) => (s + 1) % 3),
      toggleTheme: () => setTheme((x) => (x === "dark" ? "light" : "dark")),
    }),
    [lang, size, theme, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Slide text in the chosen language, falling back to the original when no translation was given. */
export const slideTitle = (s: { title: string; titleUr?: string }, lang: Lang) => (lang === "ur" && s.titleUr ? s.titleUr : s.title);
export const slideSummary = (s: { summary: string; summaryUr?: string }, lang: Lang) => (lang === "ur" && s.summaryUr ? s.summaryUr : s.summary);
