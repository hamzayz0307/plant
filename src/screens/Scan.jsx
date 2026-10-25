import { useState } from "react";
import { useApp } from "../App.jsx";
import { preparePhoto } from "../lib/photo.js";
import { bestRoom, roomFit } from "../lib/care.js";
import { displayName } from "../lib/plants.js";
import { CareGrid, FitPill, HealthResult, PhotoPicker, Reasons, Safety, Segmented } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";

let controller = null; // the running scan, so Stop works even after switching tabs

export default function Scan() {
  const { t, lang, scan, setScan, rooms, plants, weather, actions, backend, profile } = useApp();
  const { mode, status, photo, result, error } = scan;
  const [nickname, setNickname] = useState("");
  const [roomId, setRoomId] = useState("");
  const [attachId, setAttachId] = useState(scan.attachTo || "");
  const [saving, setSaving] = useState(false);

  const patch = p => setScan(s => ({ ...s, ...p }));

  function reset(nextMode = mode) {
    controller?.abort();
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    setScan(s => ({ mode: nextMode, status: "idle", photo: null, result: null, error: null, attachTo: nextMode === "health" ? s.attachTo : null }));
    setNickname(""); setRoomId("");
  }

  async function onFile(file) {
    reset();
    try {
      const prepared = await preparePhoto(file);
      patch({ photo: prepared, status: "ready", error: null });
    } catch {
      patch({ error: t("errRead") });
    }
  }

  async function run() {
    if (!photo || status === "thinking") return;
    const ctl = new AbortController();
    controller = ctl;
    patch({ status: "thinking", error: null, result: null });
    try {
      const r = await backend.ai(mode === "health" ? "health" : "identify", photo, lang, ctl.signal);
      if (ctl.signal.aborted) return;
      setScan(s => ({ ...s, status: "result", result: r }));
      if (mode !== "health" && r.isPlant && rooms.length) {
        const best = bestRoom(r.needs, rooms, { weather });
        if (best) setRoomId(best.room.id);
      }
      window.scrollTo({ top: 0 });
    } catch (e) {
      if (e.code === "cancelled" || ctl.signal.aborted) { patch({ status: "ready" }); return; }
      const msg = e.code === "limit" ? t("errLimit", e.limit) : e.code === "auth" ? t("errNotSignedIn") : t("errAi");
      patch({ status: "ready", error: msg });
    } finally {
      if (controller === ctl) controller = null;
    }
  }

  async function savePlant() {
    if (!result?.isPlant || saving) return;
    setSaving(true);
    try {
      await actions.addPlant({
        nickname: nickname.trim(),
        commonName: result.commonName, scientificName: result.scientificName, family: result.family,
        confidence: result.confidence, description: result.description, care: result.care, needs: result.needs,
        difficulty: result.difficulty, wateringDays: result.wateringDays, toxicity: result.toxicity,
        photo: photo?.thumb || null, notes: "", roomId: roomId || null, lastWatered: Date.now(), lang,
      });
      reset("identify");
      actions.setTab("garden");
      actions.toast(t("savedToGarden"));
    } catch {
      patch({ error: t("errSave") });
    }
    setSaving(false);
  }

  async function attachHealth() {
    if (!attachId || saving) return;
    setSaving(true);
    try {
      await backend.addHealth(attachId, { photo: photo?.thumb || null, result });
      const id = attachId;
      reset("identify");
      actions.openPlant(id);
      actions.toast(t("attached"));
    } catch {
      patch({ error: t("errSave") });
    }
    setSaving(false);
  }

  const modes = [
    { value: "identify", label: t("modeIdentify") },
    { value: "survive", label: t("modeSurvive") },
    { value: "health", label: t("modeHealth") },
  ];
  const sub = { identify: t("subIdentify"), survive: t("subSurvive"), health: t("subHealth") }[mode];
  const runLabel = { identify: t("identify"), survive: t("checkSurvive"), health: t("checkHealth") }[mode];

  const head = (
    <>
      <header className="screen-head"><h1>{t("scanTitle")}</h1></header>
      <Segmented value={mode} options={modes} onChange={m => { if (m !== mode) reset(m); }} label={t("scanTitle")} />
      <p className="muted">{sub}</p>
    </>
  );

  const photoView = photo && (
    <div className={`photo-frame${status === "thinking" ? " scanning" : ""}`}><img src={photo.previewUrl} alt="" /></div>
  );

  // 1. No photo yet
  if (!photo) {
    return (
      <section className="screen">
        {head}
        <PhotoPicker t={t} onFile={onFile} />
        {error && <div className="error">{error}</div>}
        <ul className="tips">{t("tips").map(x => <li key={x}><span className="dot" />{x}</li>)}</ul>
      </section>
    );
  }

  // 2. Working
  if (status === "thinking") {
    return (
      <section className="screen">
        {head}
        {photoView}
        <div className="thinking">
          <span className="msg"><span className="spinner" />{mode === "health" ? t("thinkingHealth") : t("thinking")}</span>
          <button className="link-btn" onClick={() => controller?.abort()}>{t("stop")}</button>
        </div>
      </section>
    );
  }

  // 3. Photo chosen, not run yet
  if (status !== "result" || !result) {
    return (
      <section className="screen">
        {head}
        {photoView}
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" onClick={run}><I.Leaf />{runLabel}</button>
        <button className="btn btn-ghost" onClick={() => reset()}>{t("another")}</button>
      </section>
    );
  }

  // 4. Results
  if (!result.isPlant) {
    return (
      <section className="screen">
        {head}
        {photoView}
        <div className="error">{t("notPlant")}</div>
        <button className="btn btn-primary" onClick={() => reset()}>{t("another")}</button>
      </section>
    );
  }

  const demo = result.demo && <div className="note"><I.Info /><span>{t("demoNote")}</span></div>;

  if (mode === "health") {
    return (
      <section className="screen">
        {photoView}
        {demo}
        <HealthResult t={t} result={result} />
        {plants.length > 0 && (
          <>
            <div className="field">
              <label htmlFor="attach">{t("attachTo")}</label>
              <select id="attach" value={attachId} onChange={e => setAttachId(e.target.value)}>
                <option value="">{t("attachPick")}</option>
                {plants.map(p => <option key={p.id} value={p.id}>{displayName(p)}</option>)}
              </select>
            </div>
            {error && <div className="error">{error}</div>}
            <button className="btn btn-primary" disabled={!attachId || saving} onClick={attachHealth}>{saving ? t("saving") : t("attachTo")}</button>
          </>
        )}
        <button className="btn btn-ghost" onClick={() => reset()}>{t("another")}</button>
      </section>
    );
  }

  const matchCard = (
    <div className="card">
      <h3>{t("bestMatch")}</h3>
      <div className="names"><h2>{result.commonName}</h2><span className="latin">{result.scientificName}</span></div>
      <div className="meter">
        <div className="bar" role="img" aria-label={t("matchPct", result.confidence)}><i style={{ width: `${result.confidence}%` }} /></div>
        <div className="lab"><span>{t("matchPct", result.confidence)}</span><span>{result.family}</span></div>
      </div>
      {result.confidence < 60 && <p className="muted small">{t("lowConfidence")}</p>}
      {result.description && <p>{result.description}</p>}
    </div>
  );

  const petWarn = profile?.petSafe && result.toxicity?.pets && <div className="note bad"><I.Paw />{t("petSafeWarn")}</div>;

  const saveForm = (
    <>
      <div className="field">
        <label htmlFor="nickname">{t("nickname")}</label>
        <input id="nickname" type="text" maxLength={60} placeholder={t("nicknamePh")} value={nickname} onChange={e => setNickname(e.target.value)} />
      </div>
      {rooms.length > 0 && (
        <div className="field">
          <label htmlFor="room">{t("putInRoom")}</label>
          <select id="room" value={roomId} onChange={e => setRoomId(e.target.value)}>
            <option value="">{t("noRoom")}</option>
            {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      )}
      {error && <div className="error">{error}</div>}
    </>
  );

  if (mode === "survive") {
    const fits = rooms.map(r => ({ room: r, fit: roomFit(result.needs, r, { weather }) }));
    const best = bestRoom(result.needs, rooms, { weather });
    return (
      <section className="screen">
        {photoView}
        {demo}
        {petWarn}
        {matchCard}
        <h2>{t("surviveTitle")}</h2>
        {rooms.length === 0 ? (
          <>
            <div className="note"><I.Info /><span>{t("noRoomsYet")}</span></div>
            <button className="btn btn-secondary" onClick={() => actions.setTab("rooms")}><I.Plus />{t("addRooms")}</button>
          </>
        ) : (
          <>
            <p className={best && best.fit.verdict !== "bad" ? "" : "muted"} style={{ fontWeight: 600 }}>
              {best && best.fit.verdict !== "bad" ? t("bestSpot", best.room.name) : t("noGoodSpot")}
            </p>
            <div className="stack">
              {fits.map(({ room, fit }) => (
                <div key={room.id} className={`room-fit${best && best.room.id === room.id && fit.verdict !== "bad" ? " best" : ""}`}>
                  <div className="hd"><b>{room.name}</b><FitPill t={t} verdict={fit.verdict} /></div>
                  <Reasons t={t} reasons={fit.reasons} />
                </div>
              ))}
            </div>
          </>
        )}
        <h3>{t("safety")}</h3>
        <Safety t={t} plant={result} />
        {saveForm}
        <button className="btn btn-primary" disabled={saving} onClick={savePlant}>{saving ? t("saving") : t("buyAnyway")}</button>
        <button className="btn btn-ghost" onClick={() => reset()}>{t("scanAgain")}</button>
      </section>
    );
  }

  const chosen = rooms.find(r => r.id === roomId);
  const fit = chosen ? roomFit(result.needs, chosen, { weather }) : null;
  return (
    <section className="screen">
      {photoView}
      {demo}
      {petWarn}
      {matchCard}
      {result.alternatives.length > 0 && (
        <>
          <h3>{t("couldBe")}</h3>
          <div className="list-box">
            {result.alternatives.map((a, i) => (
              <div className="alt" key={i}>
                <span className="n">{a.commonName} <span className="latin muted">{a.scientificName}</span></span>
                <span className="p">{a.confidence}%</span>
              </div>
            ))}
          </div>
        </>
      )}
      <h3>{t("care")}</h3>
      <CareGrid t={t} plant={result} />
      <h3>{t("safety")}</h3>
      <Safety t={t} plant={result} />
      {saveForm}
      {fit && (
        <div className="room-fit">
          <div className="hd"><b>{chosen.name}</b><FitPill t={t} verdict={fit.verdict} /></div>
          <Reasons t={t} reasons={fit.reasons} />
        </div>
      )}
      <button className="btn btn-primary" disabled={saving} onClick={savePlant}>{saving ? t("saving") : t("saveToGarden")}</button>
      <button className="btn btn-ghost" onClick={() => reset()}>{t("scanAgain")}</button>
    </section>
  );
}
