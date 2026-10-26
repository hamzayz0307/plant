import { useMemo, useState } from "react";
import { useApp } from "../App.jsx";
import { displayName } from "../lib/plants.js";
import { tipsFor, weekKey } from "../lib/tips.js";
import { roomFit } from "../lib/care.js";
import { Ring } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";

export function dueText(t, s) {
  if (s.rain && !s.due) return { text: t("rainSkip"), cls: "due" };
  if (s.daysLeft < 0) return { text: t("overdue", -s.daysLeft), cls: "late" };
  if (s.daysLeft === 0) return { text: t("dueToday"), cls: "due" };
  return { text: t("dueIn", s.daysLeft), cls: "" };
}

// healthy | water | attention, plus what the two rings need
function plantState(p, { statusOf, roomOf, weather }) {
  const s = statusOf(p);
  const room = roomOf(p);
  const fit = room && p.needs ? roomFit(p.needs, room, { weather }) : null;
  const attention = !!p.recheckAt || fit?.verdict === "bad";
  const water = s.due;
  return { s, status: attention ? "attention" : water ? "water" : "healthy", attention, water, recheckDue: p.recheckAt && p.recheckAt <= Date.now() };
}

function Photo({ plant, className }) {
  return plant.photo
    ? <img className={className} src={plant.photo} alt="" />
    : <span className={`${className}-empty ph-empty`}><I.Leaf size={40} /></span>;
}

export default function Garden() {
  const { t, lang, plants, roomOf, statusOf, weather, actions, profile, healthUsage } = useApp();
  const [filter, setFilter] = useState(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");

  const empty = plants.length === 0;
  const all = plants
    .map(p => ({ p, ...plantState(p, { statusOf, roomOf, weather }) }));
  const q = query.trim().toLocaleLowerCase(lang);
  const found = q
    ? all.filter(({ p }) => [p.nickname, p.commonName, p.scientificName].some(x => (x || "").toLocaleLowerCase(lang).includes(q)))
    : all;
  const listed = found.filter(x =>
    !filter || (filter === "attention" ? x.attention : filter === "water" ? x.water : !x.attention && !x.water));

  const stLabel = { healthy: t("stHealthy"), water: t("stWater"), attention: t("stAttention") };

  return (
    <section className="screen">
      <header className="plants-head">
        <h1>{t("myPlants")}</h1>
        <div style={{ display: "flex", gap: 4 }}>
          {!empty && <button className="icon-btn" aria-label={t("search")} aria-pressed={searching}
            onClick={() => { setSearching(v => !v); setQuery(""); }}><I.Search /></button>}
          <button className="icon-btn boxed" aria-label={t("addNew")} onClick={actions.startIdentify}><I.Plus size={20} /></button>
        </div>
      </header>

      {searching && !empty && (
        <input className="search" type="search" autoFocus placeholder={t("searchPh")} aria-label={t("searchPh")}
          value={query} onChange={e => setQuery(e.target.value)} />
      )}

      {empty ? (
        <div className="empty">
          <span className="empty-art" aria-hidden="true"><I.Leaf size={44} /></span>
          <h2>{t("emptyTitle")}</h2>
          <p className="muted">{t("emptySub")}</p>
          <button className="btn btn-primary" onClick={actions.startIdentify}><I.Scan size={20} />{t("emptyBtn")}</button>
          <button className="link-btn" onClick={actions.openGuide}>{t("howTo")}</button>
        </div>
      ) : <>
      <p className="serif-sub">{t("allPlants")}</p>

      <div className="shelf" aria-label={t("allPlants")}>
        {found.map(({ p, status }) => (
          <button key={p.id} className="shelf-card" onClick={() => actions.openPlant(p.id)}>
            <Photo plant={p} className="ph" />
            <span className="meta">
              <span className={`st st-${status}`}>{stLabel[status]}</span>
              <span className="nm">{displayName(p)}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="sick-strip">
        <span className="ic" aria-hidden="true"><I.Pulse size={20} /></span>
        <div>
          <b>{t("heroTitle")}</b>
          <small>
            {healthUsage && healthUsage.limit != null
              ? t("freeLeft", Math.max(0, healthUsage.limit - healthUsage.used), healthUsage.limit)
              : t("subHealth")}
          </small>
        </div>
        <button className="btn" onClick={() => actions.checkHealthOf(null)}>{t("checkShort")}</button>
      </div>
      </>}

      <TipCard />

      {!empty && <>
      <div className="pills" role="group" aria-label={t("gStatus")}>
        {["healthy", "water", "attention"].map(f => (
          <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(v => (v === f ? null : f))}>
            {stLabel[f]}
          </button>
        ))}
      </div>

      {listed.length === 0 && <p className="muted center">{t("noMatch")}</p>}
      </>}

      {!empty &&
      <ul className="pcards">
        {listed.map(({ p, s, attention, water, recheckDue }) => {
          const daysLeft = Math.max(0, s.daysLeft);
          const late = s.daysLeft < 0 ? -s.daysLeft : 0;
          return (
            <li key={p.id} className="pcard">
              <button className="pcard-photo" onClick={() => actions.openPlant(p.id)}>
                <Photo plant={p} className="ph" />
                {profile?.petSafe && p.toxicity?.pets && <span className="badge bad">{t("notPetSafe")}</span>}
                <span className="nm">{displayName(p)}</span>
              </button>

              <div className="gauge">
                <span className="gauge-label">{t("gStatus")}</span>
                <Ring value={attention ? 0.35 : 1} color={attention ? "var(--bad)" : "var(--ok)"}
                  label={`${t("gStatus")}: ${attention ? t("stAttention") : t("stHealthy")}`}>
                  {attention ? t("stAttention") : t("stHealthy")}
                </Ring>
                {recheckDue && (
                  <button className="water-chip" style={{ background: "var(--bad)" }} onClick={() => actions.checkHealthOf(p.id)}>
                    <I.Pulse size={12} />{t("checkShort")}
                  </button>
                )}
              </div>

              <div className="gauge">
                <span className="gauge-label">{t("gNext")}</span>
                <Ring value={s.days ? daysLeft / s.days : 0} color={late ? "var(--bad)" : "var(--sky)"}
                  label={`${t("gNext")}: ${daysLeft} ${t("daysUnit", daysLeft)}`}>
                  <span className="big">{daysLeft}</span>{t("daysUnit", daysLeft)}
                </Ring>
                {water
                  ? <button className="water-chip" onClick={() => actions.water(p)}><I.Drop size={12} />{t("wateredBtn")}</button>
                  : s.rain ? <span className="gauge-note rain">{t("rainSkip")}</span> : null}
                {late > 0 && <span className="gauge-note late">{t("lateShort", late)}</span>}
              </div>
            </li>
          );
        })}
      </ul>
      }
    </section>
  );
}

function TipCard() {
  const { t, lang, plants, roomOf, weather, profile } = useApp();
  const tips = useMemo(() => tipsFor({ plants, roomOf, weather, profile, lang }), [plants, roomOf, weather, profile, lang]);
  const week = weekKey();
  const [hidden, setHidden] = useState(() => {
    try { return localStorage.getItem("yaprak.tipHidden") === String(week); } catch { return false; }
  });
  const [i, setI] = useState(0);
  if (hidden || tips.length === 0) return null;
  const tip = tips[i % tips.length];

  function hide() {
    setHidden(true);
    try { localStorage.setItem("yaprak.tipHidden", String(week)); } catch { /* ignore */ }
  }

  return (
    <aside className="tip" aria-label={t("tipTitle")}>
      <div className="tip-head">
        <span className="tip-label"><I.Sun size={14} />{tip.personal ? t("tipForYou") : t("tipTitle")}</span>
        <button className="icon-btn sm" aria-label={t("tipHide")} title={t("tipHide")} onClick={hide}><I.X /></button>
      </div>
      <p>{tip.text}</p>
      {tips.length > 1 && <button className="link-btn tip-next" onClick={() => setI(i + 1)}>{t("tipNext")} →</button>}
    </aside>
  );
}
