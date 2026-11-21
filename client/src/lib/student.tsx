import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError, type PublicSession } from "./api";
import { usePrefs } from "./prefs";

type Load = "loading" | "ok" | "offline";
export interface Notice {
  kind: "ok" | "info";
  text: string;
  n?: number;
  actions?: boolean;
}
export interface Failure {
  n: number;
  kind: "pin" | "undo";
}

interface StudentCtx {
  code: string;
  session: PublicSession | null;
  load: Load;
  pinned: number[];
  sending: number | null;
  failed: Failure | null;
  notice: Notice | null;
  dialog: number | null;
  pin: (n: number) => Promise<void>;
  undo: (n: number) => Promise<void>;
  retry: () => void;
  cancel: () => void;
  refresh: () => Promise<void>;
  openComment: (n: number) => void;
  closeComment: () => void;
  sendComment: (n: number, text: string) => Promise<void>;
}
const Ctx = createContext<StudentCtx | null>(null);
export const useStudent = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("StudentProvider missing");
  return v;
};

// A student's own pins are remembered on their own device only. The server never learns who pinned.
const key = (code: string) => `att-pins:${code}`;
const loadPins = (code: string): number[] => {
  try {
    const v = JSON.parse(localStorage.getItem(key(code)) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
};
const savePins = (code: string, v: number[]) => {
  try {
    localStorage.setItem(key(code), JSON.stringify(v));
  } catch {
    /* blocked storage: pins still work for this visit */
  }
};

export function StudentProvider({ code, children }: { code: string; children: ReactNode }) {
  const { t } = usePrefs();
  const nav = useNavigate();
  const [session, setSession] = useState<PublicSession | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [pinned, setPinned] = useState<number[]>(() => loadPins(code));
  const [sending, setSending] = useState<number | null>(null);
  const [failed, setFailed] = useState<Failure | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dialog, setDialog] = useState<number | null>(null);
  const joined = useRef(false);

  const refresh = useCallback(async () => {
    try {
      let data;
      if (!joined.current && !sessionStorage.getItem(`att-joined:${code}`)) {
        data = await api<{ session: PublicSession }>(`/api/s/${encodeURIComponent(code)}/join`, { method: "POST", body: {} });
        sessionStorage.setItem(`att-joined:${code}`, "1");
      } else {
        data = await api<{ session: PublicSession }>(`/api/s/${encodeURIComponent(code)}/state`);
      }
      joined.current = true;
      setSession(data.session);
      setLoad("ok");
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) nav("/", { replace: true });
      else setLoad("offline");
    }
  }, [code, nav]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 4000);
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    return () => {
      clearInterval(timer);
      window.removeEventListener("online", onOnline);
    };
  }, [refresh]);

  const save = (v: number[]) => {
    setPinned(v);
    savePins(code, v);
  };
  const base = `/api/s/${encodeURIComponent(code)}`;

  const pin = useCallback(
    async (n: number) => {
      if (sending !== null || pinned.includes(n)) return;
      setSending(n);
      setFailed(null);
      setNotice(null);
      try {
        await api(`${base}/pin`, { body: { slide: n } });
        save([...pinned, n]);
        setSending(null);
        setNotice({ kind: "ok", n, text: t("successMsg", { n }), actions: true });
      } catch {
        setSending(null);
        setFailed({ n, kind: "pin" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sending, pinned, base, t],
  );

  const undo = useCallback(
    async (n: number) => {
      setSending(n);
      setFailed(null);
      try {
        await api(`${base}/unpin`, { body: { slide: n } });
        save(pinned.filter((x) => x !== n));
        setSending(null);
        setNotice({ kind: "info", n, text: t("undone", { n }) });
      } catch {
        setSending(null);
        setFailed({ n, kind: "undo" });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pinned, base, t],
  );

  const sendComment = useCallback(
    async (n: number, text: string) => {
      await api(`${base}/comment`, { body: { slide: n, text } });
      setDialog(null);
      setNotice({ kind: "info", text: t("commentSent") });
    },
    [base, t],
  );

  const value = useMemo<StudentCtx>(
    () => ({
      code,
      session,
      load,
      pinned,
      sending,
      failed,
      notice,
      dialog,
      pin,
      undo,
      retry: () => failed && (failed.kind === "pin" ? void pin(failed.n) : void undo(failed.n)),
      cancel: () => {
        setFailed(null);
        setNotice({ kind: "info", text: t("cancelled") });
      },
      refresh,
      openComment: setDialog,
      closeComment: () => setDialog(null),
      sendComment,
    }),
    [code, session, load, pinned, sending, failed, notice, dialog, pin, undo, refresh, sendComment, t],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
