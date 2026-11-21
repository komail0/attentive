import { Link, Route, Routes } from "react-router-dom";
import { Hero, SkipLink, TopBar } from "./components/ui";
import Join from "./pages/Join";
import After from "./pages/student/After";
import Help from "./pages/student/Help";
import MyPins from "./pages/student/MyPins";
import Slides from "./pages/student/Slides";
import StudentLayout from "./pages/student/StudentLayout";
import { usePrefs } from "./lib/prefs";

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
      <Route path="*" element={<NotFound />} />
    </Routes>
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
