// What Yaprak knows about a plant's home, sent with a sick-plant photo.
// This is the edge over photo-only apps: the AI can weigh light, watering habits and weather.

import { roomLight, wateringDays } from "./care.js";

const DAY = 864e5;
export const FREE_HEALTH_PER_MONTH = 5;

export function waterTimes(plant) {
  const list = Array.isArray(plant.waterLog) ? plant.waterLog : [];
  const times = list.map(x => (typeof x === "number" ? x : Date.parse(x))).filter(Number.isFinite);
  if (plant.lastWatered && !times.includes(plant.lastWatered)) times.push(plant.lastWatered);
  return [...new Set(times)].sort((a, b) => b - a).slice(0, 12); // newest first
}

export function appendWater(plant, when = Date.now()) {
  return [when, ...waterTimes(plant)].slice(0, 12);
}

const LIGHT_WORDS = ["low", "medium", "bright", "direct sun"];

/** Plain data for the AI. Everything is optional. */
export function buildContext({ plant, room, weather, lastCheck, now = Date.now() }) {
  if (!plant) return null;
  const times = waterTimes(plant);
  const gaps = times.slice(0, -1).map((t, i) => Math.round((t - times[i + 1]) / DAY)).filter(g => g > 0);
  const avgGap = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;

  return {
    plant: {
      name: plant.nickname || plant.commonName,
      scientificName: plant.scientificName || null,
      inGardenDays: plant.createdAt ? Math.max(0, Math.round((now - plant.createdAt) / DAY)) : null,
      needs: plant.needs || null,
    },
    room: room ? {
      name: room.name,
      placement: room.placement,
      windowFaces: room.window,
      light: LIGHT_WORDS[roomLight(room)],
      air: room.humidity,
      radiatorNearby: !!room.radiator,
    } : null,
    watering: {
      recommendedEveryDays: wateringDays(plant, room, new Date(now).getMonth()),
      lastWateredDaysAgo: times.length ? Math.round((now - times[0]) / DAY) : null,
      ownerWatersEveryDays: avgGap,
      timesLogged: times.length,
    },
    weather: weather ? { rainLast24hMm: weather.rainLast24, nightLowNext3DaysC: weather.minNext } : null,
    month: new Date(now).toLocaleString("en", { month: "long" }),
    previousCheck: lastCheck ? {
      daysAgo: Math.round((now - lastCheck.createdAt) / DAY),
      summary: lastCheck.result?.summary || "",
      problems: (lastCheck.result?.problems || []).map(p => p.name),
      healthy: !!lastCheck.result?.healthy,
    } : null,
  };
}

/** Short chips that show the user what Yaprak took into account. */
export function contextChips(t, ctx) {
  if (!ctx) return [];
  const chips = [];
  if (ctx.room) chips.push(`${ctx.room.name} · ${t(`windowDirs.${ctx.room.windowFaces}`)}`);
  if (ctx.watering.lastWateredDaysAgo != null) chips.push(t("ctxWatered", ctx.watering.lastWateredDaysAgo));
  if (ctx.watering.ownerWatersEveryDays) chips.push(t("ctxHabit", ctx.watering.ownerWatersEveryDays));
  if (ctx.room?.radiatorNearby) chips.push(t("radiatorLbl"));
  if (ctx.weather?.rainLast24hMm > 0) chips.push(t("ctxRain", ctx.weather.rainLast24hMm));
  if (ctx.previousCheck) chips.push(t("ctxPrev", ctx.previousCheck.daysAgo));
  return chips;
}

export const monthKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 7);
