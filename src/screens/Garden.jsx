import { useState } from "react";
import { useApp } from "../App.jsx";
import { EXAMPLES, displayName, exampleAsPlant } from "../lib/plants.js";
import { Chips, Thumb } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";

export function dueText(t, s) {
  if (s.rain && !s.due) return { text: t("rainSkip"), cls: "due" };
  if (s.daysLeft < 0) return { text: t("overdue", -s.daysLeft), cls: "late" };
  if (s.daysLeft === 0) return { text: t("dueToday"), cls: "due" };
  return { text: t("dueIn", s.daysLeft), cls: "" };
}

export default function Garden() {
  const { t, lang, plants, rooms, roomOf, statusOf, actions, profile, healthUsage } = useApp();
  const [filter, setFilter] = useState("all");
  const showExamples = plants.length === 0;

  const due = plants
    .map(p => ({ p, s: statusOf(p) }))
    .filter(x => x.s.due)
    .sort((a, b) => a.s.daysLeft - b.s.daysLeft);
  const rechecks = plants.filter(p => p.recheckAt && p.recheckAt <= Date.now());

  const roomOptions = [{ value: "all", label: t("filterAll") }, ...rooms.map(r => ({ value: r.id, label: r.name }))];
  if (plants.some(p => !p.roomId) && rooms.length) roomOptions.push({ value: "none", label: t("noRoom") });

  const list = showExamples
    ? EXAMPLES.map(e => exampleAsPlant(e, lang))
    : plants.filter(p => filter === "all" || (filter === "none" ? !p.roomId : p.roomId === filter));

  return (
    <section className="screen">
      <header className="screen-head">
        <div className="row-between">
          <h1>{t("gardenTitle")}</h1>
          {!showExamples && <span className="muted small">{t("plantCount", plants.length)}</span>}
        </div>
      </header>

      <div className="hero">
        <div className="hero-text">
          <h2>{t("heroTitle")}</h2>
          <p>{t("heroSub")}</p>
        </div>
        <button className="btn btn-hero" onClick={() => actions.checkHealthOf(null)}><I.Pulse />{t("heroBtn")}</button>
        {healthUsage && healthUsage.limit != null && (
          <span className="hero-usage">{t("freeLeft", Math.max(0, healthUsage.limit - healthUsage.used), healthUsage.limit)}</span>
        )}
      </div>

      {!showExamples && (
        <div className="today" aria-label={t("today")}>
          <div className="today-head"><h3>{t("today")}</h3>{due.length > 0 && <span className="small">{t("needsWater")}: {due.length}</span>}</div>
          {rechecks.map(p => (
            <div className="today-item" key={`rc-${p.id}`}>
              <Thumb plant={p} />
              <button className="link-btn" style={{ textAlign: "left", padding: 0, color: "inherit", minWidth: 0 }} onClick={() => actions.openPlant(p.id)}>
                <span className="nm" style={{ display: "block" }}>{displayName(p)}</span>
                <span className="sub late">{t("recheckDue")}</span>
              </button>
              <button className="btn btn-sm btn-primary" onClick={() => actions.checkHealthOf(p.id)}><I.Pulse />{t("checkAgain")}</button>
            </div>
          ))}
          {due.length === 0 && rechecks.length === 0
            ? <p className="today-empty"><I.Check />{t("allGood")}</p>
            : due.map(({ p, s }) => {
              const d = dueText(t, s);
              return (
                <div className="today-item" key={p.id}>
                  <Thumb plant={p} />
                  <button className="link-btn" style={{ textAlign: "left", padding: 0, color: "inherit", minWidth: 0 }} onClick={() => actions.openPlant(p.id)}>
                    <span className="nm" style={{ display: "block" }}>{displayName(p)}</span>
                    <span className={`sub ${d.cls === "late" ? "late" : ""}`}>{d.text}{roomOf(p) ? ` · ${roomOf(p).name}` : ""}</span>
                  </button>
                  <button className="btn btn-sm btn-water" onClick={() => actions.water(p)}><I.Drop />{t("wateredBtn")}</button>
                </div>
              );
            })}
        </div>
      )}

      {showExamples && <div className="note"><I.Info /><span>{t("examplesNote")}</span></div>}

      {!showExamples && rooms.length > 0 && (
        <Chips value={filter} options={roomOptions} onChange={setFilter} label={t("tabRooms")} />
      )}

      <ul className="plant-list">
        {list.map(p => {
          const s = statusOf(p);
          const d = dueText(t, s);
          const room = roomOf(p);
          return (
            <li key={p.id}>
              <button className="plant-row" onClick={() => actions.openPlant(p.id)}>
                <Thumb plant={p} />
                <span className="meta">
                  <span className="name">
                    {displayName(p)}
                    {p.example && <span className="badge">{t("example")}</span>}
                    {profile?.petSafe && p.toxicity?.pets && <span className="badge bad">{t("notPetSafe")}</span>}
                  </span>
                  <span className="latin">{p.scientificName}</span>
                  <span className="line">
                    {p.example
                      ? <span><I.Drop />{t("waterEvery", p.wateringDays)}</span>
                      : <span className={d.cls}><I.Drop />{d.text}</span>}
                    {room && <span>{room.name}</span>}
                  </span>
                </span>
                <span className="chev"><I.Chev /></span>
              </button>
            </li>
          );
        })}
      </ul>

      <button className="dashed" onClick={() => actions.setTab("scan")}><I.Plus />{t("addPlant")}</button>
    </section>
  );
}
