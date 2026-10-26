import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { displayName } from "../lib/plants.js";
import { roomFit, wateringDays } from "../lib/care.js";
import { CareGrid, FitPill, Reasons, Safety } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";
import { dueText } from "./Garden.jsx";

export function formatDate(ms, lang) {
  if (!ms) return "—";
  try { return new Date(ms).toLocaleDateString(lang === "tr" ? "tr-TR" : "en-GB", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return new Date(ms).toDateString(); }
}

export default function PlantDetail({ id }) {
  const { t, lang, plants, rooms, roomOf, statusOf, actions, weather, backend, profile } = useApp();
  const fromStore = plants.find(p => p.id === id);
  const p = fromStore;

  const [notes, setNotes] = useState(p?.notes || "");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState([]);

  useEffect(() => {
    if (!fromStore) return;
    backend.listHealth(id).then(setHealth).catch(() => setHealth([]));
  }, [id, fromStore?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!p) return null;
  const room = roomOf(p);
  const s = statusOf(p);
  const d = dueText(t, s);
  const fit = room && p.needs ? roomFit(p.needs, room, { weather }) : null;

  async function moveTo(roomId) {
    try { await actions.updatePlant(p.id, { roomId: roomId || null }); }
    catch { actions.toast(t("errSave")); }
  }
  async function saveNotes() {
    setBusy(true);
    try { await actions.updatePlant(p.id, { notes }); actions.toast(t("notesSaved")); }
    catch { actions.toast(t("errSave")); }
    setBusy(false);
  }
  async function remove() {
    setBusy(true);
    try { await actions.deletePlant(p.id); actions.closePlant(); actions.toast(t("removed")); }
    catch { actions.toast(t("errSave")); setBusy(false); }
  }

  return (
    <section className="screen">
      <button className="back" onClick={actions.closePlant}><I.Back />{t("gardenTitle")}</button>
      <div className="hero-photo">
        {p.photo ? <img src={p.photo} alt={displayName(p)} /> : <I.Leaf size={72} />}
      </div>
      <header className="screen-head">
        <h1>{displayName(p)}</h1>
        {p.nickname && p.commonName && <span className="muted">{p.commonName}</span>}
      </header>

      {profile?.petSafe && p.toxicity?.pets && <div className="note bad"><I.Paw />{t("petSafeWarn")}</div>}

      {(
        <div className="water-card">
          <div>
            <div className="big">{d.text}</div>
            <div className="sub">{t("lastWatered")}: {p.lastWatered ? formatDate(p.lastWatered, lang) : t("never")}{s.rain ? ` · ${t("rainSkip")}` : ""}</div>
          </div>
          <button className="btn btn-sm btn-water" onClick={() => actions.water(p)}><I.Drop />{t("wateredBtn")}</button>
        </div>
      )}

      <div className="label">
        <div className="hdr"><span>{t("specimen")}</span><span>Yaprak</span></div>
        <div className="sci latin">{p.scientificName}</div>
        <dl>
          <dt>{t("family")}</dt><dd>{p.family || "—"}</dd>
          <dt>{t("added")}</dt><dd>{formatDate(p.createdAt, lang)}</dd>
          <dt>{t("confidenceLbl")}</dt><dd>{p.confidence != null ? t("matchPct", p.confidence) : "—"}</dd>
          <dt>{t("room")}</dt><dd>{room ? room.name : t("noRoom")}</dd>
        </dl>
      </div>
      {p.description && <p>{p.description}</p>}

      {(
        <div className="field">
          <label htmlFor="move-room">{t("changeRoom")}</label>
          <select id="move-room" value={p.roomId || ""} onChange={e => moveTo(e.target.value)}>
            <option value="">{t("noRoom")}</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}

      {fit && (
        <div className="room-fit">
          <div className="hd"><b>{t("roomFit")}</b><FitPill t={t} verdict={fit.verdict} /></div>
          <Reasons t={t} reasons={fit.reasons} />
        </div>
      )}

      <h3>{room ? t("careForRoom", room.name) : t("care")}</h3>
      <CareGrid t={t} plant={p} roomDays={room ? wateringDays(p, room) : null} roomName={room?.name} />

      <h3>{t("safety")}</h3>
      <Safety t={t} plant={p} />

      {(
        <>
          <h3>{t("healthLog")}</h3>
          {health.length >= 2 && (() => {
            const first = health[health.length - 1];
            const latest = health[0];
            const trend = latest.result?.trend;
            return (
              <div className="progress">
                <div className="row-between" style={{ alignItems: "center" }}>
                  <b>{t("progress")}</b>
                  {trend && <span className={`trend trend-${trend}`}>{t(`trend.${trend}`)}</span>}
                </div>
                <div className="ba">
                  {[[first, t("firstCheck")], [latest, t("latestCheck")]].map(([h, label]) => (
                    <figure key={h.id}>
                      {h.photo ? <img src={h.photo} alt="" /> : <span className="ph" />}
                      <figcaption><b>{label}</b> · {formatDate(h.createdAt, lang)}</figcaption>
                    </figure>
                  ))}
                </div>
              </div>
            );
          })()}
          {p.recheckAt && (
            <p className={p.recheckAt <= Date.now() ? "note warn" : "muted small"}>
              {p.recheckAt <= Date.now() ? t("recheckDue") : t("recheckOn", formatDate(p.recheckAt, lang))}
            </p>
          )}
          {health.length === 0
            ? <p className="muted small">{t("noHealth")}</p>
            : (
              <ul className="timeline">
                {health.map(h => (
                  <li key={h.id}>
                    {h.photo ? <img src={h.photo} alt="" /> : <span className="ph" />}
                    <div>
                      <div className="when">{formatDate(h.createdAt, lang)}</div>
                      <div className="what">{h.result?.healthy ? t("healthy") : (h.result?.problems?.[0]?.name || t("healthTitle"))}</div>
                      {h.result?.urgency && !h.result.healthy && <span className={`urg urg-${h.result.urgency}`}>{t(`urgency.${h.result.urgency}`)}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          <button className="btn btn-secondary" onClick={() => actions.checkHealthOf(p.id)}><I.Pulse />{p.recheckAt && p.recheckAt <= Date.now() ? t("checkAgain") : t("runHealth")}</button>

          <div className="field">
            <label htmlFor="notes">{t("notes")}</label>
            <textarea id="notes" placeholder={t("notesPh")} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
          <button className="btn btn-secondary" disabled={busy || notes === (p.notes || "")} onClick={saveNotes}>{t("saveNotes")}</button>

          {confirm ? (
            <div className="confirm">
              <p>{t("confirmRemove", displayName(p))}</p>
              <div className="btn-row">
                <button className="btn btn-ghost" onClick={() => setConfirm(false)}>{t("keep")}</button>
                <button className="btn btn-danger" disabled={busy} onClick={remove}>{t("yesRemove")}</button>
              </div>
            </div>
          ) : <button className="btn btn-ghost" onClick={() => setConfirm(true)}>{t("remove")}</button>}
        </>
      )}
    </section>
  );
}
