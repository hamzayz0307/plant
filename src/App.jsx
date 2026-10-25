import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { backend } from "./lib/backend.js";
import { guessLang, makeT } from "./lib/i18n.js";
import { getWeather } from "./lib/weather.js";
import { waterStatus } from "./lib/care.js";
import { displayName } from "./lib/plants.js";
import * as I from "./components/icons.jsx";
import Garden from "./screens/Garden.jsx";
import PlantDetail from "./screens/PlantDetail.jsx";
import Scan from "./screens/Scan.jsx";
import Rooms from "./screens/Rooms.jsx";
import Profile from "./screens/Profile.jsx";
import { AuthScreen, NewPasswordScreen } from "./screens/Auth.jsx";
import SitterPage from "./screens/Sitter.jsx";

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const sitterToken = new URLSearchParams(location.search).get("sitter");
  if (sitterToken) return <SitterPage token={sitterToken} />;
  return <Main />;
}

function rememberLang(lang) {
  try { localStorage.setItem("yaprak.lang", lang); } catch { /* ignore */ }
}

function Main() {
  const [lang, setLang] = useState(guessLang);
  const t = useMemo(() => makeT(lang), [lang]);
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [recovery, setRecovery] = useState(false);

  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  useEffect(() => {
    let alive = true;
    backend.auth.getUser().then(u => { if (alive) setUser(u); }).catch(() => alive && setUser(null));
    const off = backend.auth.onChange((event, u) => {
      setUser(u);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });
    return () => { alive = false; off(); };
  }, []);

  const changeLang = useCallback(l => { setLang(l); rememberLang(l); }, []);

  if (user === undefined) return <div className="splash"><span className="spinner" /></div>;
  if (!user) return <AuthScreen t={t} lang={lang} setLang={changeLang} />;
  if (recovery) return <NewPasswordScreen t={t} onDone={() => setRecovery(false)} />;
  return <Shell key={user.id} user={user} t={t} lang={lang} setLang={changeLang} />;
}

const EMPTY_SCAN = { mode: "identify", status: "idle", photo: null, result: null, error: null, attachTo: null };

function Shell({ user, t, lang, setLang }) {
  const [profile, setProfile] = useState(null);
  const [plants, setPlants] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [weather, setWeather] = useState(null);
  const [tab, setTabState] = useState(() => {
    const h = location.hash.slice(1);
    return ["garden", "scan", "rooms", "profile"].includes(h) ? h : "garden";
  });
  const [detailId, setDetailId] = useState(null);
  const [scan, setScan] = useState(EMPTY_SCAN);
  const [toastMsg, setToastMsg] = useState(null);
  const toastTimer = useRef();

  const toast = useCallback(msg => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 2400);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [p, r] = await Promise.all([backend.listPlants(), backend.listRooms()]);
      setPlants(p); setRooms(r); setLoadError(false);
    } catch { setLoadError(true); }
  }, []);

  // First load
  useEffect(() => {
    (async () => {
      try {
        const prof = await backend.getProfile();
        setProfile(prof);
        if (prof.lang && prof.lang !== lang) setLang(prof.lang);
        else if (!prof.lang) backend.saveProfile({ lang }).catch(() => {});
      } catch { setProfile({ lang, city: null, petSafe: false, reminders: false }); }
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Weather, only needed for balcony / garden rooms
  const hasBalcony = rooms.some(r => r.placement === "balcony");
  const city = profile?.city;
  useEffect(() => {
    if (!hasBalcony || !city) { setWeather(null); return; }
    getWeather(city).then(setWeather).catch(() => setWeather(null));
  }, [hasBalcony, city?.lat, city?.lon]); // eslint-disable-line react-hooks/exhaustive-deps

  const roomOf = useCallback(p => rooms.find(r => r.id === p.roomId) || null, [rooms]);
  const statusOf = useCallback(p => waterStatus(p, roomOf(p), weather), [roomOf, weather]);
  const dueCount = plants.filter(p => statusOf(p).due).length;

  // Reminder notification when the app opens (once a day)
  useEffect(() => {
    if (!profile?.reminders || !plants.length || !("Notification" in window) || Notification.permission !== "granted") return;
    const day = new Date().toDateString();
    let last = null;
    try { last = localStorage.getItem("yaprak.notified"); } catch { /* ignore */ }
    if (dueCount > 0 && last !== day) {
      try {
        new Notification(t("notifTitle"), { body: t("notifBody", dueCount), icon: "/leaf.svg", tag: "yaprak-water" });
        localStorage.setItem("yaprak.notified", day);
      } catch { /* some phones only allow notifications from an installed app */ }
    }
  }, [profile?.reminders, plants.length, dueCount, t]);

  const setTab = useCallback(next => {
    setTabState(next); setDetailId(null);
    window.scrollTo({ top: 0 });
  }, []);

  const actions = useMemo(() => ({
    refresh,
    toast,
    openPlant: id => { setDetailId(id); setTabState("garden"); window.scrollTo({ top: 0 }); },
    closePlant: () => setDetailId(null),
    setTab,
    async updateProfile(patch) {
      setProfile(p => ({ ...p, ...patch }));
      if (patch.lang) setLang(patch.lang);
      try { await backend.saveProfile(patch); } catch { toast(t("errSave")); }
    },
    async addPlant(p) { const saved = await backend.addPlant(p); await refresh(); return saved; },
    async updatePlant(id, patch) {
      setPlants(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
      try { await backend.updatePlant(id, patch); } catch (e) { await refresh(); throw e; }
    },
    async deletePlant(id) { await backend.deletePlant(id); await refresh(); },
    async water(plant) {
      try {
        await actions.updatePlant(plant.id, { lastWatered: Date.now() });
        toast(t("wateredToast", displayName(plant)));
      } catch { toast(t("errSave")); }
    },
    async saveRoom(room) {
      if (room.id) await backend.updateRoom(room.id, room);
      else await backend.addRoom(room);
      await refresh();
    },
    async deleteRoom(id) { await backend.deleteRoom(id); await refresh(); },
    checkHealthOf(plantId) {
      setScan({ ...EMPTY_SCAN, mode: "health", attachTo: plantId });
      setTab("scan");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [refresh, toast, setTab, setLang, t]);

  const ctx = { t, lang, user, profile, plants, rooms, weather, roomOf, statusOf, actions, scan, setScan, backend };

  let screen;
  if (!profile) screen = <div className="splash" style={{ minHeight: "60vh" }}><span className="spinner" /></div>;
  else if (tab === "garden") screen = detailId ? <PlantDetail id={detailId} /> : <Garden />;
  else if (tab === "scan") screen = <Scan />;
  else if (tab === "rooms") screen = <Rooms />;
  else screen = <Profile />;

  const TabBtn = ({ id, label, Icon, badge }) => (
    <button className="tab" onClick={() => setTab(id)} aria-current={tab === id ? "page" : undefined}>
      <Icon />{badge ? <span className="dot">{badge}</span> : null}<span>{label}</span>
    </button>
  );

  return (
    <AppCtx.Provider value={ctx}>
      <main className="app">
        {loadError && <div className="error" style={{ marginBottom: 16 }}>{t("errLoad")}</div>}
        {screen}
      </main>
      <div className="tabbar">
        <nav aria-label="Main">
          <TabBtn id="garden" label={t("tabGarden")} Icon={I.Garden} badge={dueCount || null} />
          <button className="tab tab-scan" onClick={() => setTab("scan")} aria-current={tab === "scan" ? "page" : undefined}>
            <span className="fab"><I.Scan /></span><span>{t("tabScan")}</span>
          </button>
          <TabBtn id="rooms" label={t("tabRooms")} Icon={I.Home} />
          <TabBtn id="profile" label={t("tabProfile")} Icon={I.User} />
        </nav>
      </div>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}
