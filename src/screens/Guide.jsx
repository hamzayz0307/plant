import { useState } from "react";
import * as I from "../components/icons.jsx";

const STEP_ICONS = [I.Scan, I.Home, I.Drop, I.Pulse, I.Leaf, I.Link];
const DONE_KEY = "yaprak.onboarded";

export function needsOnboarding() {
  try { return localStorage.getItem(DONE_KEY) !== "1"; } catch { return false; }
}
function markOnboarded() {
  try { localStorage.setItem(DONE_KEY, "1"); } catch { /* ignore */ }
}

/** First-run tour: one step per screen, skippable. */
export function Onboarding({ t, onDone }) {
  const steps = t("guideSteps");
  const [i, setI] = useState(0);
  const last = i === steps.length - 1;
  const Icon = STEP_ICONS[i] || I.Leaf;
  const finish = () => { markOnboarded(); onDone(); };

  return (
    <div className="onboard" role="dialog" aria-modal="true" aria-label={t("howTo")}>
      <div className="onboard-inner">
        <div className="row-between" style={{ alignItems: "center" }}>
          <span className="muted small">{i + 1} / {steps.length}</span>
          <button className="link-btn" onClick={finish}>{t("guideSkip")}</button>
        </div>
        <div className="onboard-art"><Icon size={56} /></div>
        <div className="stack">
          <h1>{steps[i].title}</h1>
          <p className="onboard-body">{steps[i].body}</p>
        </div>
        <div className="dots" aria-hidden="true">
          {steps.map((_, k) => <span key={k} className={k === i ? "on" : ""} />)}
        </div>
        <div className="btn-row">
          <button className="btn btn-ghost" disabled={i === 0} onClick={() => setI(i - 1)}>{t("back")}</button>
          <button className="btn btn-primary" onClick={() => (last ? finish() : setI(i + 1))}>{last ? t("guideStart") : t("guideNext")}</button>
        </div>
      </div>
    </div>
  );
}

/** Full guide, opened from Profile. */
export function GuidePage({ t, onBack }) {
  const steps = t("guideSteps");
  return (
    <section className="screen">
      <button className="back" onClick={onBack}><I.Back />{t("profileTitle")}</button>
      <header className="screen-head">
        <h1>{t("howTo")}</h1>
        <p className="muted">{t("howToSub")}</p>
      </header>
      <ol className="guide-list">
        {steps.map((s, k) => {
          const Icon = STEP_ICONS[k] || I.Leaf;
          return (
            <li key={k}>
              <span className="ic"><Icon size={22} /></span>
              <div>
                <b>{s.title}</b>
                <p>{s.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
