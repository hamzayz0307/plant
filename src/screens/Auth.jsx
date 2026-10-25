import { useState } from "react";
import { backend } from "../lib/backend.js";
import { Segmented } from "../components/parts.jsx";
import * as I from "../components/icons.jsx";

function authError(t, e) {
  const m = (e?.message || "").toLowerCase();
  if (m.includes("invalid login") || m.includes("invalid credentials")) return t("authErrInvalid");
  if (m.includes("already registered") || m.includes("already exists")) return t("authErrExists");
  if (m.includes("password") && (m.includes("6") || m.includes("weak") || m.includes("short"))) return t("authErrWeak");
  return t("authErrGeneric");
}

export function AuthScreen({ t, lang, setLang }) {
  const [view, setView] = useState("signin"); // signin | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      if (view === "signin") await backend.auth.signIn(email.trim(), password);
      else if (view === "signup") {
        const r = await backend.auth.signUp(email.trim(), password);
        if (r?.needsConfirm) { setMsg({ ok: true, text: t("checkEmail") }); setView("signin"); }
      } else {
        await backend.auth.resetPassword(email.trim());
        setMsg({ ok: true, text: t("resetSent") });
      }
    } catch (err) {
      setMsg({ ok: false, text: authError(t, err) });
    }
    setBusy(false);
  }

  const title = { signin: t("signIn"), signup: t("signUp"), forgot: t("forgot") }[view];

  return (
    <main className="auth">
      <div className="row-between" style={{ alignItems: "center" }}>
        <div className="brand">
          <span className="mark"><I.Leaf size={30} /></span>
        </div>
        <Segmented inline value={lang} onChange={setLang} label="Language" options={[{ value: "en", label: "EN" }, { value: "tr", label: "TR" }]} />
      </div>
      <div className="brand">
        <h1>Yaprak</h1>
        <p className="muted">{t("authTagline")}</p>
      </div>

      <form className="stack" onSubmit={submit}>
        <h2>{title}</h2>
        <div className="field">
          <label htmlFor="email">{t("email")}</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {view !== "forgot" && (
          <div className="field">
            <label htmlFor="password">{t("password")}</label>
            <input id="password" type="password" autoComplete={view === "signup" ? "new-password" : "current-password"} required minLength={6}
              value={password} onChange={e => setPassword(e.target.value)} />
            {view === "signup" && <span className="hint">{t("passwordHint")}</span>}
          </div>
        )}
        {msg && <div className={msg.ok ? "note" : "error"}>{msg.text}</div>}
        <button className="btn btn-primary" disabled={busy}>{busy ? "…" : view === "forgot" ? t("sendReset") : title}</button>
      </form>

      <div className="stack center">
        {view === "signin" && <>
          <button className="link-btn" onClick={() => { setView("signup"); setMsg(null); }}>{t("noAccount")}</button>
          <button className="link-btn" onClick={() => { setView("forgot"); setMsg(null); }}>{t("forgot")}</button>
        </>}
        {view === "signup" && <button className="link-btn" onClick={() => { setView("signin"); setMsg(null); }}>{t("haveAccount")}</button>}
        {view === "forgot" && <button className="link-btn" onClick={() => { setView("signin"); setMsg(null); }}>{t("backToSignIn")}</button>}
      </div>
    </main>
  );
}

export function NewPasswordScreen({ t, onDone }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try { await backend.auth.updatePassword(password); onDone(); }
    catch (e2) { setErr(authError(t, e2)); setBusy(false); }
  }

  return (
    <main className="auth">
      <form className="stack" onSubmit={submit}>
        <h2>{t("newPassword")}</h2>
        <div className="field">
          <label htmlFor="new-password">{t("newPassword")}</label>
          <input id="new-password" type="password" autoComplete="new-password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
          <span className="hint">{t("passwordHint")}</span>
        </div>
        {err && <div className="error">{err}</div>}
        <button className="btn btn-primary" disabled={busy}>{t("setPassword")}</button>
      </form>
    </main>
  );
}
