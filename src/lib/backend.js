// One interface, two implementations:
//  - cloud: Supabase (accounts, database, Edge Function with Gemini)
//  - local: this device only, demo scan results (used until Supabase keys are set)
//
// Screens only talk to this interface, so switching is just adding the two env vars in Vercel.

import { createClient } from "@supabase/supabase-js";
import { demoHealth, demoIdentify, normalizeHealth, normalizeIdentify } from "./plants.js";
import { FREE_HEALTH_PER_MONTH, monthKey } from "./context.js";

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export class AiError extends Error {
  constructor(code, extra = {}) { super(code); this.code = code; Object.assign(this, extra); }
}

const DEFAULT_PROFILE = { lang: null, city: null, petSafe: false, reminders: false, plan: "free" };

function token(n = 24) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, b => "abcdefghijkmnpqrstuvwxyz23456789"[b % 32]).join("");
}

function newId() {
  return crypto.randomUUID ? crypto.randomUUID() : token(32);
}

function wait(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new AiError("cancelled")); });
  });
}

const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64url = s => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/"))));

const packRoom = r => (r ? { r: r.name, rm: [r.placement, r.window, r.light, r.humidity, r.radiator ? 1 : 0] } : {});

/* ------------------------------------------------------------------ */
/* Local (this device)                                                 */
/* ------------------------------------------------------------------ */

function createLocalBackend() {
  const KEY_ = "yaprak.data";
  const load = () => {
    try { return { profile: { ...DEFAULT_PROFILE }, plants: [], rooms: [], health: [], ...JSON.parse(localStorage.getItem(KEY_) || "{}") }; }
    catch { return { profile: { ...DEFAULT_PROFILE }, plants: [], rooms: [], health: [] }; }
  };
  let db = load();
  const persist = () => {
    try { localStorage.setItem(KEY_, JSON.stringify(db)); }
    catch { throw new Error("storage_full"); }
  };
  // One-time cleanup: plants saved from demo scan results (before real identification) are not real.
  if (!db.demoCleaned) {
    const fake = new Set(["Monstera deliciosa", "Chlorophytum comosum", "Dracaena trifasciata"]);
    const removed = new Set(db.plants.filter(p => fake.has(p.scientificName)).map(p => p.id));
    db.plants = db.plants.filter(p => !removed.has(p.id));
    db.health = db.health.filter(h => !removed.has(h.plantId));
    db.demoCleaned = true;
    try { persist(); } catch { /* ignore */ }
  }

  return {
    mode: "local",
    aiLimit: null,

    auth: {
      async getUser() { return { id: "local", email: null }; },
      onChange() { return () => {}; },
      async signIn() {}, async signUp() {}, async resetPassword() {}, async updatePassword() {}, async signOut() {},
    },

    async getProfile() { return { ...DEFAULT_PROFILE, ...db.profile }; },
    async saveProfile(patch) { db.profile = { ...db.profile, ...patch }; persist(); },

    async listPlants() { return [...db.plants].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); },
    async addPlant(p) { const plant = { ...p, id: newId(), createdAt: Date.now() }; db.plants.push(plant); persist(); return plant; },
    async updatePlant(id, patch) { db.plants = db.plants.map(p => p.id === id ? { ...p, ...patch } : p); persist(); },
    async deletePlant(id) { db.plants = db.plants.filter(p => p.id !== id); db.health = db.health.filter(h => h.plantId !== id); persist(); },

    async listRooms() { return [...db.rooms].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)); },
    async addRoom(r) { const room = { ...r, id: newId(), createdAt: Date.now() }; db.rooms.push(room); persist(); return room; },
    async updateRoom(id, patch) { db.rooms = db.rooms.map(r => r.id === id ? { ...r, ...patch } : r); persist(); },
    async deleteRoom(id) {
      db.rooms = db.rooms.filter(r => r.id !== id);
      db.plants = db.plants.map(p => p.roomId === id ? { ...p, roomId: null } : p);
      persist();
    },

    async listHealth(plantId) { return db.health.filter(h => h.plantId === plantId).sort((a, b) => b.createdAt - a.createdAt); },
    async addHealth(plantId, entry) { db.health.push({ ...entry, id: newId(), plantId, createdAt: Date.now() }); persist(); },

    async ai(mode, _photo, lang, signal, context = null) {
      if (mode === "health") {
        const m = monthKey();
        const used = db.healthUsage?.[m] || 0;
        if (db.profile.plan !== "plus" && used >= FREE_HEALTH_PER_MONTH) throw new AiError("health_limit", { limit: FREE_HEALTH_PER_MONTH });
        await wait(1100, signal);
        db.healthUsage = { [m]: used + 1 };
        persist();
        return normalizeHealth(demoHealth(lang, context));
      }
      await wait(1100, signal);
      return normalizeIdentify(demoIdentify(lang, _photo?.hash));
    },
    async aiUsage() { return null; },
    async healthUsage() {
      const plan = db.profile.plan || "free";
      return { used: db.healthUsage?.[monthKey()] || 0, limit: plan === "plus" ? null : FREE_HEALTH_PER_MONTH, plan };
    },

    // Sitter link without an account: the schedule travels inside the link itself.
    async createSitterLink({ days, note, plants, rooms }) {
      const expires = Date.now() + days * 864e5;
      const payload = {
        v: 1, note, expires,
        plants: plants.map(p => ({
          id: p.id, n: p.nickname || p.commonName, s: p.scientificName, w: p.wateringDays, lw: p.lastWatered || null,
          cw: p.care?.water || "", ...packRoom(rooms.find(r => r.id === p.roomId)),
        })),
      };
      return { url: `${location.origin}/?sitter=local#${b64url(JSON.stringify(payload))}`, expires };
    },
    async listSitterLinks() { return []; },
    async deleteSitterLink() {},

    async sendFeedback() { /* nowhere to send without a backend */ },
  };
}

/* ------------------------------------------------------------------ */
/* Cloud (Supabase)                                                    */
/* ------------------------------------------------------------------ */

const plantFromRow = r => ({
  id: r.id, nickname: r.nickname || "", commonName: r.common_name, scientificName: r.scientific_name || "",
  family: r.family || "", confidence: r.confidence, description: r.description || "", care: r.care || {},
  needs: r.needs || {}, difficulty: r.difficulty, wateringDays: r.watering_days, toxicity: r.toxicity || {},
  photo: r.photo || null, notes: r.notes || "", roomId: r.room_id, lastWatered: r.last_watered ? Date.parse(r.last_watered) : null,
  waterLog: Array.isArray(r.water_log) ? r.water_log.map(x => Date.parse(x)).filter(Number.isFinite) : [],
  recheckAt: r.recheck_at ? Date.parse(r.recheck_at) : null,
  lang: r.lang, createdAt: Date.parse(r.created_at),
});

const PLANT_COLS = {
  nickname: "nickname", commonName: "common_name", scientificName: "scientific_name", family: "family",
  confidence: "confidence", description: "description", care: "care", needs: "needs", difficulty: "difficulty",
  wateringDays: "watering_days", toxicity: "toxicity", photo: "photo", notes: "notes", roomId: "room_id",
  lastWatered: "last_watered", lang: "lang", waterLog: "water_log", recheckAt: "recheck_at",
};
function plantToRow(p) {
  const row = {};
  for (const [k, col] of Object.entries(PLANT_COLS)) {
    if (p[k] === undefined) continue;
    if ((k === "lastWatered" || k === "recheckAt") && p[k]) row[col] = new Date(p[k]).toISOString();
    else if (k === "waterLog") row[col] = (p[k] || []).map(x => new Date(x).toISOString());
    else row[col] = p[k];
  }
  return row;
}

const roomFromRow = r => ({
  id: r.id, name: r.name, placement: r.placement, window: r.window, light: r.light,
  humidity: r.humidity, radiator: r.radiator, createdAt: Date.parse(r.created_at),
});
const roomToRow = r => {
  const row = {};
  for (const k of ["name", "placement", "window", "light", "humidity", "radiator"]) if (r[k] !== undefined) row[k] = r[k];
  return row;
};

function createCloudBackend() {
  const sb = createClient(URL_, KEY);
  const must = ({ data, error }) => { if (error) throw error; return data; };
  const uid = async () => (await sb.auth.getUser()).data.user?.id;

  return {
    mode: "cloud",
    aiLimit: 15,
    client: sb,

    auth: {
      async getUser() { return (await sb.auth.getSession()).data.session?.user ?? null; },
      onChange(cb) {
        const { data } = sb.auth.onAuthStateChange((event, session) => cb(event, session?.user ?? null));
        return () => data.subscription.unsubscribe();
      },
      async signIn(email, password) { must(await sb.auth.signInWithPassword({ email, password })); },
      async signUp(email, password) {
        const data = must(await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin } }));
        return { needsConfirm: !data.session };
      },
      async resetPassword(email) { must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin })); },
      async updatePassword(password) { must(await sb.auth.updateUser({ password })); },
      async signOut() { await sb.auth.signOut(); },
    },

    async getProfile() {
      const row = must(await sb.from("profiles").select("*").maybeSingle());
      if (!row) return { ...DEFAULT_PROFILE };
      return { lang: row.lang, city: row.city, petSafe: row.pet_safe, reminders: row.reminders, plan: row.plan || "free" };
    },
    async saveProfile(patch) {
      const row = { id: await uid() };
      if ("lang" in patch) row.lang = patch.lang;
      if ("city" in patch) row.city = patch.city;
      if ("petSafe" in patch) row.pet_safe = patch.petSafe;
      if ("reminders" in patch) row.reminders = patch.reminders;
      must(await sb.from("profiles").upsert(row));
    },

    async listPlants() { return must(await sb.from("plants").select("*").order("created_at", { ascending: false })).map(plantFromRow); },
    async addPlant(p) { return plantFromRow(must(await sb.from("plants").insert({ ...plantToRow(p), user_id: await uid() }).select().single())); },
    async updatePlant(id, patch) { must(await sb.from("plants").update(plantToRow(patch)).eq("id", id)); },
    async deletePlant(id) { must(await sb.from("plants").delete().eq("id", id)); },

    async listRooms() { return must(await sb.from("rooms").select("*").order("created_at")).map(roomFromRow); },
    async addRoom(r) { return roomFromRow(must(await sb.from("rooms").insert({ ...roomToRow(r), user_id: await uid() }).select().single())); },
    async updateRoom(id, patch) { must(await sb.from("rooms").update(roomToRow(patch)).eq("id", id)); },
    async deleteRoom(id) { must(await sb.from("rooms").delete().eq("id", id)); },

    async listHealth(plantId) {
      return must(await sb.from("health_checks").select("*").eq("plant_id", plantId).order("created_at", { ascending: false }))
        .map(r => ({ id: r.id, plantId: r.plant_id, photo: r.photo, result: r.result, createdAt: Date.parse(r.created_at) }));
    },
    async addHealth(plantId, entry) {
      must(await sb.from("health_checks").insert({ plant_id: plantId, user_id: await uid(), photo: entry.photo, result: entry.result }));
    },

    async ai(mode, photo, lang, signal, context = null) {
      const session = (await sb.auth.getSession()).data.session;
      if (!session) throw new AiError("auth");
      let res;
      try {
        res = await fetch(`${URL_}/functions/v1/plant-ai`, {
          method: "POST", signal,
          headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ mode, image: photo.base64, lang, context }),
        });
      } catch (e) {
        if (e.name === "AbortError") throw new AiError("cancelled");
        throw new AiError("network");
      }
      const body = await res.json().catch(() => ({}));
      if (res.status === 401) throw new AiError("auth");
      if (res.status === 429) throw new AiError("limit", { limit: body.limit || 15 });
      if (res.status === 402) throw new AiError("health_limit", { limit: body.limit || FREE_HEALTH_PER_MONTH });
      if (!res.ok) throw new AiError("ai");
      return mode === "health" ? normalizeHealth(body) : normalizeIdentify(body);
    },
    async aiUsage() {
      const today = new Date().toISOString().slice(0, 10);
      const row = must(await sb.from("ai_usage").select("count").eq("day", today).maybeSingle());
      return { used: row?.count || 0, limit: 15 };
    },
    async healthUsage() {
      const [prof, usage] = await Promise.all([
        sb.from("profiles").select("plan").maybeSingle(),
        sb.from("health_usage").select("count").eq("month", monthKey()).maybeSingle(),
      ]);
      const plan = prof.data?.plan || "free";
      return { used: usage.data?.count || 0, limit: plan === "plus" ? null : FREE_HEALTH_PER_MONTH, plan };
    },

    async createSitterLink({ days, note }) {
      const t = token();
      const expires = Date.now() + days * 864e5;
      must(await sb.from("sitter_links").insert({ token: t, note, expires_at: new Date(expires).toISOString(), user_id: await uid() }));
      return { url: `${location.origin}/?sitter=${t}`, expires };
    },
    async listSitterLinks() {
      return must(await sb.from("sitter_links").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }))
        .map(r => ({ id: r.id, url: `${location.origin}/?sitter=${r.token}`, note: r.note, expires: Date.parse(r.expires_at) }));
    },
    async deleteSitterLink(id) { must(await sb.from("sitter_links").delete().eq("id", id)); },

    async sendFeedback(message) { must(await sb.from("feedback").insert({ message, user_id: await uid() })); },
  };
}

/* ------------------------------------------------------------------ */
/* Sitter page (works without signing in)                              */
/* ------------------------------------------------------------------ */

export async function loadSitterView(tokenValue) {
  if (tokenValue === "local") {
    try {
      const p = JSON.parse(unb64url(location.hash.slice(1)));
      if (!p || p.expires < Date.now()) return null;
      return {
        snapshot: true, note: p.note || "",
        plants: p.plants.map(x => ({
          id: x.id, name: x.n, scientificName: x.s, wateringDays: x.w, lastWatered: x.lw,
          careWater: x.cw, roomName: x.r || "", room: x.rm ? { placement: x.rm[0], window: x.rm[1], light: x.rm[2], humidity: x.rm[3], radiator: !!x.rm[4] } : null, photo: null,
        })),
      };
    } catch { return null; }
  }
  if (!backend.client) return null;
  const { data, error } = await backend.client.rpc("get_sitter_view", { p_token: tokenValue });
  if (error || !data) return null;
  return {
    snapshot: false, note: data.note || "",
    plants: (data.plants || []).map(x => ({
      id: x.id, name: x.name, scientificName: x.scientific_name, wateringDays: x.watering_days,
      lastWatered: x.last_watered ? Date.parse(x.last_watered) : null, careWater: x.care_water,
      roomName: x.room_name, room: x.room, photo: x.photo,
    })),
  };
}

export async function sitterMarkWatered(tokenValue, plantId) {
  if (tokenValue === "local") return;
  const { error } = await backend.client.rpc("sitter_mark_watered", { p_token: tokenValue, p_plant_id: plantId });
  if (error) throw error;
}

export const backend = URL_ && KEY ? createCloudBackend() : createLocalBackend();
