import { useState } from "react";
import { useApp } from "../App.jsx";
import { EXAMPLES, displayName, exampleAsPlant } from "../lib/plants.js";
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
  if (p.example) return { s: { ...s, daysLeft: p.wateringDays, days: p.wateringDays, due: false }, status: "healthy", attention: false, water: false };
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

  const showExamples = plants.length === 0;
  const all = (showExamples ? EXAMPLES.map(e => exampleAsPlant(e, lang)) : plants)
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
          <button className="icon-btn" aria-label={t("search")} aria-pressed={searching}
            onClick={() => { setSearching(v => !v); setQuery(""); }}><I.Search /></button>
          <button className="icon-btn boxed" aria-label={t("addNew")} onClick={() => actions.setTab("scan")}><I.Plus size={20} /></button>
        </div>
      </header>

      {searching && (
        <input className="search" type="search" autoFocus placeholder={t("searchPh")} aria-label={t("searchPh")}
          value={query} onChange={e => setQuery(e.target.value)} />
      )}

      <p className="serif-sub">{t("allPlants")}</p>

      {showExamples && <div className="note"><I.Info /><span>{t("examplesNote")}</span></div>}

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

      <div className="pills" role="group" aria-label={t("gStatus")}>
        {["healthy", "water", "attention"].map(f => (
          <button key={f} className="pill" aria-pressed={filter === f} onClick={() => setFilter(v => (v === f ? null : f))}>
            {stLabel[f]}
          </button>
        ))}
      </div>

      {listed.length === 0 && <p className="muted center">{t("noMatch")}</p>}

      <ul className="pcards">
        {listed.map(({ p, s, attention, water, recheckDue }) => {
          const daysLeft = Math.max(0, s.daysLeft);
          const late = s.daysLeft < 0 ? -s.daysLeft : 0;
          return (
            <li key={p.id} className="pcard">
              <button className="pcard-photo" onClick={() => actions.openPlant(p.id)}>
                <Photo plant={p} className="ph" />
                {p.example && <span className="badge">{t("example")}</span>}
                {!p.example && profile?.petSafe && p.toxicity?.pets && <span className="badge bad">{t("notPetSafe")}</span>}
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
    </section>
  );
}
