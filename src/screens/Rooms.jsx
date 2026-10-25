import { useState } from "react";
import { useApp } from "../App.jsx";
import { lightFromWindow } from "../lib/care.js";
import { Segmented, Switch } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";

const NEW_ROOM = { name: "", placement: "indoor", window: "S", light: "bright", humidity: "normal", radiator: false };

export default function Rooms() {
  const { t, rooms, plants } = useApp();
  const [editing, setEditing] = useState(null);

  if (editing) return <RoomEditor room={editing} onDone={() => { setEditing(null); window.scrollTo({ top: 0 }); }} />;

  const count = id => plants.filter(p => p.roomId === id).length;
  const describe = r => [
    r.placement === "balcony" ? t("placementBalcony") : t("placementIndoor"),
    t(`windowDirs.${r.window}`),
    t(`lightLevels.${r.light}`),
  ].join(" · ");

  return (
    <section className="screen">
      <header className="screen-head">
        <h1>{t("roomsTitle")}</h1>
        <p className="muted">{t("roomsSub")}</p>
      </header>

      {rooms.length > 0 && (
        <div className="stack">
          {rooms.map(r => (
            <button key={r.id} className="room-card" onClick={() => setEditing(r)}>
              <span className="ic">{r.placement === "balcony" ? <I.Balcony /> : <I.Window />}</span>
              <span style={{ minWidth: 0 }}>
                <b>{r.name}</b>
                <small>{describe(r)}</small>
                <small style={{ display: "block" }}>{t("plantsInRoom", count(r.id))}</small>
              </span>
              <span className="chev"><I.Chev /></span>
            </button>
          ))}
        </div>
      )}

      <button className="dashed" onClick={() => setEditing({ ...NEW_ROOM })}><I.Plus />{t("addRoom")}</button>
    </section>
  );
}

function RoomEditor({ room, onDone }) {
  const { t, actions, plants } = useApp();
  const [r, setR] = useState(room);
  const [lightTouched, setLightTouched] = useState(!!room.id);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [err, setErr] = useState(null);
  const set = patch => setR(x => ({ ...x, ...patch }));

  function pickWindow(w) {
    set(lightTouched ? { window: w } : { window: w, light: lightFromWindow(w) });
  }

  async function save() {
    if (!r.name.trim()) return;
    setBusy(true); setErr(null);
    try {
      await actions.saveRoom({ ...r, name: r.name.trim(), radiator: r.placement === "balcony" ? false : r.radiator });
      actions.toast(t("roomSaved"));
      onDone();
    } catch { setErr(t("errSave")); setBusy(false); }
  }
  async function remove() {
    setBusy(true);
    try { await actions.deleteRoom(r.id); actions.toast(t("roomDeleted")); onDone(); }
    catch { setErr(t("errSave")); setBusy(false); }
  }

  const dirs = [["N", "c-n"], ["W", "c-w"], ["none", "c-none"], ["E", "c-e"], ["S", "c-s"]];

  return (
    <section className="screen">
      <button className="back" onClick={onDone}><I.Back />{t("roomsTitle")}</button>
      <h1>{r.id ? t("editRoom") : t("addRoom")}</h1>

      <div className="field">
        <label htmlFor="room-name">{t("roomName")}</label>
        <input id="room-name" type="text" maxLength={40} placeholder={t("roomNamePh")} value={r.name} onChange={e => set({ name: e.target.value })} />
      </div>

      <div className="field">
        <span className="lbl">{t("placement")}</span>
        <Segmented value={r.placement} onChange={v => set({ placement: v })} label={t("placement")}
          options={[{ value: "indoor", label: t("placementIndoor") }, { value: "balcony", label: t("placementBalcony") }]} />
      </div>

      <div className="field">
        <span className="lbl">{t("window")}</span>
        <div className="compass" role="group" aria-label={t("window")}>
          {dirs.map(([d, cls]) => (
            <button key={d} type="button" className={`chip ${cls}`} aria-pressed={r.window === d} onClick={() => pickWindow(d)}>
              {t(`windowDirs.${d}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="lbl">{t("lightLevel")}</span>
        <Segmented value={r.light} onChange={v => { setLightTouched(true); set({ light: v }); }} label={t("lightLevel")}
          options={["low", "medium", "bright"].map(v => ({ value: v, label: t(`lightLevels.${v}`) }))} />
        {!lightTouched && <span className="hint">{t("lightHint")}</span>}
      </div>

      <div className="field">
        <span className="lbl">{t("air")}</span>
        <Segmented value={r.humidity} onChange={v => set({ humidity: v })} label={t("air")}
          options={["dry", "normal", "humid"].map(v => ({ value: v, label: t(`airLevels.${v}`) }))} />
      </div>

      {r.placement === "indoor" && (
        <div className="group">
          <div className="group-row">
            <span className="t"><b>{t("radiatorLbl")}</b></span>
            <Switch id="radiator" checked={r.radiator} onChange={v => set({ radiator: v })} label={t("radiatorLbl")} />
          </div>
        </div>
      )}

      {err && <div className="error">{err}</div>}
      <button className="btn btn-primary" disabled={busy || !r.name.trim()} onClick={save}>{busy ? t("saving") : t("save")}</button>

      {r.id && (confirm ? (
        <div className="confirm">
          <p>{t("confirmDeleteRoom", r.name)}</p>
          <div className="btn-row">
            <button className="btn btn-ghost" onClick={() => setConfirm(false)}>{t("keep")}</button>
            <button className="btn btn-danger" disabled={busy} onClick={remove}>{t("delete")}</button>
          </div>
        </div>
      ) : <button className="btn btn-ghost" onClick={() => setConfirm(true)}>{t("deleteRoom")}</button>)}
      {r.id && <p className="muted small center">{t("plantsInRoom", plants.filter(p => p.roomId === r.id).length)}</p>}
    </section>
  );
}
