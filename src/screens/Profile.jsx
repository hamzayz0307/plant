import { useEffect, useState } from "react";
import { useApp } from "../App.jsx";
import { findCity } from "../lib/weather.js";
import { Chips, Segmented, Switch } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";
import { formatDate } from "./PlantDetail.jsx";

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export default function Profile() {
  const { t, lang, user, profile, plants, rooms, actions, backend, weather } = useApp();
  const cloud = backend.mode === "cloud";

  const [cityInput, setCityInput] = useState(profile.city?.name || "");
  const [cityMsg, setCityMsg] = useState(null);
  const [notif, setNotif] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const [usage, setUsage] = useState(null);
  const [days, setDays] = useState(7);
  const [note, setNote] = useState("");
  const [links, setLinks] = useState([]);
  const [newLink, setNewLink] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    backend.aiUsage().then(setUsage).catch(() => {});
    backend.listSitterLinks().then(setLinks).catch(() => {});
  }, [backend]);

  async function saveCity(e) {
    e.preventDefault();
    const q = cityInput.trim();
    if (!q) { actions.updateProfile({ city: null }); setCityMsg(null); return; }
    setBusy("city");
    try {
      const place = await findCity(q);
      if (!place) setCityMsg({ bad: true, text: t("cityNotFound") });
      else { await actions.updateProfile({ city: place }); setCityInput(place.name); setCityMsg({ text: t("cityFound", place.name) }); }
    } catch { setCityMsg({ bad: true, text: t("errSave") }); }
    setBusy(null);
  }

  async function turnOnReminders() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission().catch(() => "denied");
    setNotif(p);
    if (p === "granted") actions.updateProfile({ reminders: true });
  }

  async function createLink() {
    setBusy("link");
    try {
      const link = await backend.createSitterLink({ days, note: note.trim(), plants, rooms });
      setNewLink(link);
      setLinks(await backend.listSitterLinks());
      if (await copyText(link.url)) actions.toast(t("copied"));
    } catch { actions.toast(t("errSave")); }
    setBusy(null);
  }

  async function revoke(id) {
    try { await backend.deleteSitterLink(id); setLinks(ls => ls.filter(l => l.id !== id)); }
    catch { actions.toast(t("errSave")); }
  }

  async function sendFeedback() {
    if (!feedback.trim()) return;
    setBusy("fb");
    try { await backend.sendFeedback(feedback.trim()); setFeedback(""); actions.toast(t("feedbackSent")); }
    catch { actions.toast(t("errSave")); }
    setBusy(null);
  }

  const remindersState = notif === "unsupported" ? t("remindersUnsupported")
    : notif === "denied" ? t("remindersBlocked")
    : notif === "granted" && profile.reminders ? t("remindersOn") : null;

  return (
    <section className="screen">
      <header className="screen-head"><h1>{t("profileTitle")}</h1></header>

      <div className="group">
        <div className="group-row">
          <span className="t">
            <b>{t("account")}</b>
            <small><span className={`status-dot${cloud ? "" : " local"}`} />{cloud ? user.email : t("onDevice")}</small>
          </span>
          {cloud && <button className="btn btn-sm btn-ghost" onClick={() => backend.auth.signOut()}>{t("signOut")}</button>}
        </div>
        {!cloud && <div className="group-row"><span className="t"><small>{t("onDeviceNote")}</small></span></div>}
        {usage && <div className="group-row"><span className="t"><small>{t("aiUsage", usage.used, usage.limit)}</small></span></div>}
      </div>

      <div className="group">
        <div className="group-row">
          <span className="t"><b>{t("language")}</b><small>{t("languageSub")}</small></span>
          <Segmented inline value={lang} onChange={l => actions.updateProfile({ lang: l })} label={t("language")}
            options={[{ value: "en", label: "EN" }, { value: "tr", label: "TR" }]} />
        </div>
        <div className="group-row">
          <span className="t"><b>{t("petSafe")}</b><small>{t("petSafeSub")}</small></span>
          <Switch id="pet-safe" checked={profile.petSafe} onChange={v => actions.updateProfile({ petSafe: v })} label={t("petSafe")} />
        </div>
        <div className="group-row">
          <span className="t"><b>{t("reminders")}</b><small>{remindersState || t("remindersSub")}</small></span>
          {notif === "granted"
            ? <Switch id="reminders" checked={profile.reminders} onChange={v => actions.updateProfile({ reminders: v })} label={t("reminders")} />
            : notif === "default" && <button className="btn btn-sm btn-secondary" onClick={turnOnReminders}><I.Bell />{t("turnOn")}</button>}
        </div>
        <form className="group-row col" onSubmit={saveCity}>
          <span className="t"><b>{t("city")}</b><small>{t("citySub")}</small></span>
          <div className="inline-form">
            <input id="city" type="text" placeholder={t("cityPh")} value={cityInput} onChange={e => setCityInput(e.target.value)} aria-label={t("city")} />
            <button className="btn btn-sm btn-secondary" disabled={busy === "city"}>{t("save")}</button>
          </div>
          {cityMsg && <small style={{ color: cityMsg.bad ? "var(--bad)" : "var(--muted)" }}>{cityMsg.text}</small>}
          {!cityMsg && weather && <small className="muted"><I.Cloud /> {t("cityFound", weather.place)}</small>}
        </form>
      </div>

      <div className="group">
        <div className="group-row col">
          <span className="t"><b><I.Link /> {t("sitter")}</b><small>{t("sitterSub")}</small></span>
          <div className="field">
            <span className="lbl">{t("sitterDays")}</span>
            <Chips value={days} onChange={setDays} label={t("sitterDays")} options={[3, 7, 14, 30].map(n => ({ value: n, label: t("days", n) }))} />
          </div>
          <div className="field">
            <label htmlFor="sitter-note">{t("sitterNote")}</label>
            <input id="sitter-note" type="text" maxLength={140} placeholder={t("sitterNotePh")} value={note} onChange={e => setNote(e.target.value)} />
          </div>
          {!cloud && <small className="muted">{t("localLinkNote")}</small>}
          <button className="btn btn-primary" disabled={busy === "link" || plants.length === 0} onClick={createLink}>{t("createLink")}</button>
          {newLink && (
            <>
              <div className="link-out">{newLink.url}</div>
              <button className="btn btn-sm btn-secondary" onClick={async () => actions.toast(await copyText(newLink.url) ? t("copied") : t("copyFail"))}>{t("copyLink")}</button>
            </>
          )}
        </div>
        {links.length > 0 && (
          <div className="group-row col">
            <h3>{t("activeLinks")}</h3>
            {links.map(l => (
              <div key={l.id} className="row-between" style={{ alignItems: "center" }}>
                <small className="muted">{t("expires", formatDate(l.expires, lang))}{l.note ? ` · ${l.note}` : ""}</small>
                <button className="btn btn-sm btn-ghost" onClick={() => revoke(l.id)}>{t("revoke")}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {cloud && (
        <div className="group">
          <div className="group-row col">
            <label htmlFor="feedback" className="t"><b>{t("feedback")}</b></label>
            <div className="field">
              <textarea id="feedback" placeholder={t("feedbackPh")} value={feedback} onChange={e => setFeedback(e.target.value)} />
            </div>
            <button className="btn btn-secondary" disabled={busy === "fb" || !feedback.trim()} onClick={sendFeedback}>{t("feedback")}</button>
          </div>
        </div>
      )}

      <p className="muted small center">{t("version")}</p>
    </section>
  );
}
