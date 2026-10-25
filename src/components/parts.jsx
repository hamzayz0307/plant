import * as I from "./icons.jsx";

export function Thumb({ plant, className = "thumb" }) {
  return plant?.photo
    ? <img className={className} src={plant.photo} alt="" />
    : <span className={`${className} thumb-ph`}><I.Leaf /></span>;
}

export function Segmented({ value, options, onChange, inline = false, label }) {
  return (
    <div className={`seg${inline ? " inline" : ""}`} role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Chips({ value, options, onChange, label }) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function Switch({ id, checked, onChange, label }) {
  return (
    <label className="switch">
      <input id={id} type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function CareGrid({ t, plant, roomDays, roomName }) {
  const c = plant.care || {};
  const item = (k, Icon, v, wide) => v ? (
    <div className={`care-item${wide ? " wide" : ""}`}>
      <span className="k"><Icon />{t(k)}</span>
      <span className="v">{v}</span>
    </div>
  ) : null;
  const water = roomDays && roomName ? `${c.water ? c.water + ". " : ""}${t("adjustedFor", roomDays, roomName)}` : c.water;
  return (
    <div className="care">
      {item("water", I.Drop, water, true)}
      {item("light", I.Sun, c.light)}
      {item("soil", I.Soil, c.soil)}
      {item("temperature", I.Temp, c.temperature)}
      {item("humidity", I.Mist, c.humidity)}
      {item("difficulty", I.Gauge, ["easy", "medium", "hard"].includes(plant.difficulty) ? t(`diff.${plant.difficulty}`) : "", true)}
    </div>
  );
}

export function Safety({ t, plant }) {
  const x = plant.toxicity || {};
  return (
    <div className="tox">
      <div className={`tox-row ${x.pets ? "bad" : "ok"}`}><I.Paw />{x.pets ? t("toxPets") : t("safePets")}</div>
      <div className={`tox-row ${x.kids ? "bad" : "ok"}`}><I.Child />{x.kids ? t("toxKids") : t("safeKids")}</div>
      {x.note && <p className="tox-note">{x.note}</p>}
    </div>
  );
}

export function FitPill({ t, verdict }) {
  const label = { good: t("fitGood"), ok: t("fitOk"), bad: t("fitBad") }[verdict];
  return <span className={`fit-pill fit-${verdict}`}>{label}</span>;
}

export function Reasons({ t, reasons }) {
  return (
    <ul className="reasons">
      {reasons.map((r, i) => <li key={i} className={r.level}>{t(`reasons.${r.key}`, r.arg)}</li>)}
    </ul>
  );
}

export function PhotoPicker({ t, onFile, hint }) {
  return (
    <label className="drop" htmlFor="photo">
      <I.Camera />
      <span className="lbl">{t("pickPhoto")}</span>
      <span className="muted small">{hint || t("pickHint")}</span>
      <input id="photo" type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }} />
    </label>
  );
}

export function HealthResult({ t, result }) {
  if (result.healthy) {
    return (
      <div className="card">
        <div className="health-head"><h2>{t("healthy")}</h2><span className="urg urg-low">{t("urgency.low")}</span></div>
        <p className="muted">{result.summary || t("healthyNote")}</p>
      </div>
    );
  }
  return (
    <>
      <div className="card">
        <h3>{t("healthTitle")}</h3>
        <div className="health-head"><h2>{result.problems[0]?.name || t("likely")}</h2><span className={`urg urg-${result.urgency}`}>{t(`urgency.${result.urgency}`)}</span></div>
        {result.summary && <p>{result.summary}</p>}
      </div>
      <h3>{t("likely")}</h3>
      <div className="stack">
        {result.problems.map((p, i) => (
          <div className="problem" key={i}>
            <div className="hd"><b>{p.name}</b><span className="pct">{p.likelihood}%</span></div>
            <dl>
              {p.signs && <><dt>{t("signs")}</dt><dd>{p.signs}</dd></>}
              {p.cause && <><dt>{t("cause")}</dt><dd>{p.cause}</dd></>}
              {p.fix.length > 0 && <><dt>{t("fix")}</dt><dd><ol>{p.fix.map((f, j) => <li key={j}>{f}</li>)}</ol></dd></>}
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
