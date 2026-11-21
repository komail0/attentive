import { LogOut, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { usePrefs } from "../lib/prefs";
import { Logo } from "./Logo";
import { Controls, SkipLink } from "./ui";

/** Laptop and tablet shell for the lecturer: brand, navigation, controls and sign out. */
export function Desk({ children, signedIn = true }: { children: ReactNode; signedIn?: boolean }) {
  const { t } = usePrefs();
  const { signOut } = useAuth();
  const nav = useNavigate();
  return (
    <div className="desk">
      <SkipLink />
      <header className="dnav">
        <Link className="brand" to={signedIn ? "/lecturer/sessions" : "/lecturer"}>
          <Logo />
          <span>Attentive</span>
        </Link>
        {signedIn ? (
          <nav className="links" aria-label={t("navLabel")}>
            <NavLink className="nav-l" to="/lecturer/sessions" end>
              {t("navSessions")}
            </NavLink>
            <NavLink className="nav-l" to="/lecturer/new">
              {t("newSession")}
            </NavLink>
          </nav>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        <Controls />
        {signedIn && (
          <>
            <Link className="btn sm" to="/lecturer/new">
              <Plus size={16} aria-hidden /> {t("newSession")}
            </Link>
            <button
              type="button"
              className="btn sm line"
              onClick={async () => {
                await signOut();
                nav("/lecturer");
              }}
            >
              <LogOut size={16} aria-hidden /> {t("signOut")}
            </button>
          </>
        )}
      </header>
      <main className="dbody" id="main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
