import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, type Lecturer } from "./api";

type State = { status: "loading" } | { status: "out" } | { status: "in"; lecturer: Lecturer };
interface AuthCtx {
  state: State;
  signIn: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const Ctx = createContext<AuthCtx | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    api<{ lecturer: Lecturer }>("/api/auth/me").then(
      (r) => setState({ status: "in", lecturer: r.lecturer }),
      (e) => setState(e instanceof ApiError && e.status === 0 ? { status: "out" } : { status: "out" }),
    );
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const r = await api<{ lecturer: Lecturer }>("/api/auth/login", { body: { email, password } });
    setState({ status: "in", lecturer: r.lecturer });
  }, []);
  const register = useCallback(async (name: string, email: string, password: string) => {
    const r = await api<{ lecturer: Lecturer }>("/api/auth/register", { body: { name, email, password } });
    setState({ status: "in", lecturer: r.lecturer });
  }, []);
  const signOut = useCallback(async () => {
    await api("/api/auth/logout", { body: {} }).catch(() => undefined);
    setState({ status: "out" });
  }, []);

  const value = useMemo(() => ({ state, signIn, register, signOut }), [state, signIn, register, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Maps a server error code to the translation key for its message. */
export const errKey = (e: unknown) => (e instanceof ApiError ? (e.code === "network" ? "err_network" : `err_${e.code}`) : "err_server_error");
