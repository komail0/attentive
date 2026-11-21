import { Keyboard, ShieldCheck } from "lucide-react";
import { useEffect } from "react";
import { Hero } from "../../components/ui";
import { usePrefs } from "../../lib/prefs";

export default function Help() {
  const { t } = usePrefs();
  useEffect(() => {
    document.title = `${t("tabHelp")} · Attentive`;
  }, [t]);
  const block = (icon: React.ReactNode, h: string, keys: string[]) => (
    <section className="card" aria-labelledby={h}>
      <div className="cardhead">
        <span className="cic">{icon}</span>
        <h2 className="h2" id={h}>
          {t(h)}
        </h2>
      </div>
      <ul className="clean">
        {keys.map((k) => (
          <li key={k}>{t(k)}</li>
        ))}
      </ul>
    </section>
  );
  return (
    <>
      <Hero a="h_how" b="h_works" small />
      {block(<ShieldCheck size={22} aria-hidden />, "helpAnonTitle", ["helpAnon1", "helpAnon2", "helpAnon3"])}
      {block(<Keyboard size={22} aria-hidden />, "helpKeyTitle", ["helpKey1", "helpKey2", "helpKey3"])}
    </>
  );
}
