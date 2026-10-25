import { useEffect, useMemo, useState } from "react";
import { loadSitterView, sitterMarkWatered } from "../lib/backend.js";
import { guessLang, makeT } from "../lib/i18n.js";
import { waterStatus } from "../lib/care.js";
import { Segmented, Thumb } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";
import { dueText } from "./Garden.jsx";

// Public page for a plant-sitter. No sign-in, no app install.
export default function SitterPage({ token }) {
  const [lang, setLang] = useState(guessLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const [view, setView] = useState(undefined); // undefined = loading, null = expired
  const [ticks, setTicks] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`yaprak.sitter.${token}`) || "{}"); } catch { return {}; }
  });
  const [toast, setToast] = useState(null);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  useEffect(() => { loadSitterView(token).then(setView).catch(() => setView(null)); }, [token]);

  async function water(p) {
    const now = Date.now();
    try {
      await sitterMarkWatered(token, p.id);
      const next = { ...ticks, [p.id]: now };
      setTicks(next);
      try { localStorage.setItem(`yaprak.sitter.${token}`, JSON.stringify(next)); } catch { /* ignore */ }
      setToast(t("wateredToast", p.name));
      setTimeout(() => setToast(null), 2200);
    } catch {
      setToast(t("errSave"));
      setTimeout(() => setToast(null), 2200);
    }
  }

  const head = (
    <div className="row-between" style={{ alignItems: "center" }}>
      <h1>{t("sitterTitle")}</h1>
      <Segmented inline value={lang} onChange={l => { setLang(l); try { localStorage.setItem("yaprak.lang", l); } catch { /* ignore */ } }}
        label="Language" options={[{ value: "en", label: "EN" }, { value: "tr", label: "TR" }]} />
    </div>
  );

  if (view === undefined) return <main className="app no-nav"><div className="screen">{head}<p className="muted">{t("sitterLoading")}</p></div></main>;
  if (view === null) return <main className="app no-nav"><div className="screen">{head}<div className="error">{t("sitterExpired")}</div></div></main>;

  const rows = view.plants.map(p => {
    const lastWatered = Math.max(p.lastWatered || 0, ticks[p.id] || 0) || null;
    const s = waterStatus({ wateringDays: p.wateringDays, lastWatered }, p.room, null);
    return { p, s };
  }).sort((a, b) => a.s.daysLeft - b.s.daysLeft);

  return (
    <main className="app no-nav">
      <section className="screen">
        {head}
        <p className="muted">{t("sitterIntro")}</p>
        {view.note && <div className="note"><I.Info /><span>{view.note}</span></div>}
        {view.snapshot && <p className="muted small">{t("sitterSnapshot")}</p>}
        <ul className="plant-list">
          {rows.map(({ p, s }) => {
            const d = dueText(t, s);
            return (
              <li key={p.id} className="plant-row" style={{ gridTemplateColumns: "64px minmax(0,1fr)" }}>
                <Thumb plant={p} />
                <span className="meta">
                  <span className="name">{p.name}</span>
                  <span className="latin">{p.scientificName}</span>
                  <span className="line">
                    <span className={d.cls}><I.Drop />{d.text}</span>
                    {p.roomName && <span>{p.roomName}</span>}
                  </span>
                  {p.careWater && <span className="small muted">{p.careWater}</span>}
                  {s.due && <button className="btn btn-sm btn-water" style={{ marginTop: 8, width: "fit-content" }} onClick={() => water(p)}><I.Drop />{t("wateredBtn")}</button>}
                </span>
              </li>
            );
          })}
        </ul>
      </section>
      {toast && <div className="toast" role="status" style={{ bottom: "calc(24px + env(safe-area-inset-bottom, 0px))" }}>{toast}</div>}
    </main>
  );
}
