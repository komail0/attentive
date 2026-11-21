import type { ReactNode } from "react";
import { Link, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Hero, SkipLink, TopBar } from "./components/ui";
import { AuthProvider, useAuth } from "./lib/auth";
import { usePrefs } from "./lib/prefs";
import Join from "./pages/Join";
import Dashboard from "./pages/lecturer/Dashboard";
import Login from "./pages/lecturer/Login";
import NewSession from "./pages/lecturer/New";
import Report from "./pages/lecturer/Report";
import Sessions from "./pages/lecturer/Sessions";
import Setup from "./pages/lecturer/Setup";
import { api, type LecturerSession } from "./lib/api";
import { useEffect, useState } from "react";
import After from "./pages/student/After";
import Help from "./pages/student/Help";
import MyPins from "./pages/student/MyPins";
import Slides from "./pages/student/Slides";
import StudentLayout from "./pages/student/StudentLayout";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Join />} />
      <Route path="/s/:code" element={<StudentLayout />}>
        <Route index element={<Slides />} />
        <Route path="pins" element={<MyPins />} />
        <Route path="help" element={<Help />} />
        <Route path="after" element={<After />} />
      </Route>
      <Route path="/lecturer/*" element={<LecturerApp />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** Everything under /lecturer shares one sign-in state. */
function LecturerApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route index element={<Entry />} />
        <Route path="login" element={<Login mode="signin" />} />
        <Route path="register" element={<Login mode="register" />} />
        <Route path="sessions" element={<Gate><Sessions /></Gate>} />
        <Route path="new" element={<Gate><NewSession /></Gate>} />
        <Route path="sessions/:id" element={<Gate><SessionHome /></Gate>} />
        <Route path="sessions/:id/setup" element={<Gate><Setup /></Gate>} />
        <Route path="sessions/:id/report" element={<Gate><Report /></Gate>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AuthProvider>
  );
}

function Entry() {
  const { state } = useAuth();
  if (state.status === "loading") return <Loading />;
  return <Navigate to={state.status === "in" ? "/lecturer/sessions" : "/lecturer/login"} replace />;
}

function Gate({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  if (state.status === "loading") return <Loading />;
  if (state.status === "out") return <Navigate to="/lecturer/login" replace />;
  return <>{children}</>;
}

/** Sends the lecturer to the right place for the session's stage: setup, live dashboard or report. */
function SessionHome() {
  const { id = "" } = useParams();
  const [status, setStatus] = useState<LecturerSession["status"] | "missing" | null>(null);
  useEffect(() => {
    api<{ session: LecturerSession }>(`/api/sessions/${id}`).then(
      (r) => setStatus(r.session.status),
      () => setStatus("missing"),
    );
  }, [id]);
  if (status === null) return <Loading />;
  if (status === "missing") return <NotFound />;
  if (status === "draft") return <Navigate to={`/lecturer/sessions/${id}/setup`} replace />;
  if (status === "ended") return <Navigate to={`/lecturer/sessions/${id}/report`} replace />;
  return <Dashboard />;
}

function Loading() {
  const { t } = usePrefs();
  return (
    <div className="app">
      <main className="body" id="main">
        <p className="sub" role="status">
          {t("loading")}
        </p>
      </main>
    </div>
  );
}

function NotFound() {
  const { t } = usePrefs();
  return (
    <div className="app">
      <SkipLink />
      <TopBar />
      <main className="body" id="main" tabIndex={-1}>
        <Hero a="h_nf1" b="h_nf2" small />
        <h2 className="h2">{t("notFoundTitle")}</h2>
        <p className="sub">{t("notFoundText")}</p>
        <Link className="btn" to="/">
          {t("goHome")}
        </Link>
      </main>
    </div>
  );
}
