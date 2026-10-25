// Room fit, watering schedule and weather adjustments.
// Pure functions: easy to test and to reuse in the sitter page.

const DAY = 24 * 60 * 60 * 1000;
const LIGHT = { low: 0, medium: 1, bright: 2, direct: 3 };

export function lightFromWindow(dir) {
  return { S: "bright", W: "bright", E: "medium", N: "low", none: "low" }[dir] || "medium";
}

// How much light a room really gives, on the 0-3 scale.
export function roomLight(room) {
  let v = LIGHT[room.light] ?? 1;
  if (room.placement === "balcony" && (room.window === "S" || room.window === "W")) v = 3;
  else if (room.placement === "balcony") v = Math.max(v, 2);
  return v;
}

function isWinter(month) { return month >= 10 || month <= 2; } // Nov–Mar (0-based months)
function isSummer(month) { return month >= 4 && month <= 8; }  // May–Sep

/**
 * How well a plant fits a room.
 * needs: { light: low|medium|bright|direct, minTemp: °C, humidity: low|medium|high, placement: indoor|both|outdoor }
 * weather (optional): { minNext: °C }
 * Returns { verdict: "good"|"ok"|"bad", reasons: [{ level, key, arg? }] }
 */
export function roomFit(needs, room, { month = new Date().getMonth(), weather = null } = {}) {
  const reasons = [];
  if (!needs || !room) return { verdict: "ok", reasons };
  const need = LIGHT[needs.light] ?? 1;
  const have = roomLight(room);
  const diff = have - need;

  if (diff <= -2) reasons.push({ level: "bad", key: "tooDark" });
  else if (diff === -1) reasons.push({ level: "ok", key: "bitDark" });
  else if (diff >= 2) reasons.push({ level: "bad", key: "tooBright" });
  else if (diff === 1 && need <= 1) reasons.push({ level: "ok", key: "bitBright" });
  else reasons.push({ level: "good", key: "lightGood" });

  if (needs.humidity === "high") {
    if (room.humidity === "dry") reasons.push({ level: "ok", key: "dryAir" });
    else if (room.humidity === "humid") reasons.push({ level: "good", key: "humidGood" });
  }
  if (room.radiator && room.placement !== "balcony" && needs.humidity !== "low" && isWinter(month)) {
    reasons.push({ level: "ok", key: "radiator" });
  }

  if (room.placement === "balcony") {
    const minTemp = Number.isFinite(needs.minTemp) ? needs.minTemp : 10;
    const nightLow = weather && Number.isFinite(weather.minNext) ? weather.minNext : null;
    if (nightLow != null && nightLow < minTemp) reasons.push({ level: "bad", key: "coldBalcony" });
    else if (nightLow == null && isWinter(month) && minTemp >= 10) reasons.push({ level: "bad", key: "coldBalcony" });
    else if (nightLow != null && nightLow < minTemp + 4) reasons.push({ level: "ok", key: "coldSoon", arg: Math.round(nightLow) });
    if (needs.placement === "indoor") reasons.push({ level: "ok", key: "indoorOnly" });
  } else if (needs.placement === "outdoor") {
    reasons.push({ level: have >= 2 ? "ok" : "bad", key: "outdoorPlant" });
  }

  const verdict = reasons.some(r => r.level === "bad") ? "bad" : reasons.some(r => r.level === "ok") ? "ok" : "good";
  return { verdict, reasons };
}

const RANK = { good: 2, ok: 1, bad: 0 };
export function bestRoom(needs, rooms, opts) {
  let best = null;
  for (const room of rooms) {
    const fit = roomFit(needs, room, opts);
    const score = RANK[fit.verdict] * 10 - fit.reasons.filter(r => r.level !== "good").length;
    if (!best || score > best.score) best = { room, fit, score };
  }
  return best;
}

// Watering interval adjusted for the room and season.
export function wateringDays(plant, room, month = new Date().getMonth()) {
  let d = Number(plant.wateringDays) || 7;
  if (room) {
    const light = roomLight(room);
    if (light >= 2) d *= 0.85;
    if (light === 0) d *= 1.3;
    if (room.placement === "balcony" && isSummer(month)) d *= 0.7;
    if (room.radiator && isWinter(month)) d *= 0.85;
    if (room.humidity === "humid") d *= 1.15;
  }
  if (!room || room.placement !== "balcony") {
    if (isWinter(month)) d *= 1.2; // slower growth indoors in winter
  }
  return Math.max(1, Math.round(d));
}

function startOfDay(ms) { const d = new Date(ms); d.setHours(0, 0, 0, 0); return d.getTime(); }

/**
 * Watering status for today.
 * weather (optional): { rainLast24: mm } – counts as watering for balcony plants when ≥ 3 mm.
 * Returns { days, nextDue, daysLeft, due, rain }
 */
export function waterStatus(plant, room, weather, now = Date.now()) {
  const days = wateringDays(plant, room, new Date(now).getMonth());
  let last = plant.lastWatered ? new Date(plant.lastWatered).getTime() : null;
  let rain = false;
  if (room && room.placement === "balcony" && weather && weather.rainLast24 >= 3) {
    const rainTime = now - DAY / 2;
    if (!last || rainTime > last) { last = rainTime; rain = true; }
  }
  if (!last) return { days, nextDue: startOfDay(now), daysLeft: 0, due: true, rain };
  const nextDue = startOfDay(last) + days * DAY;
  const daysLeft = Math.round((nextDue - startOfDay(now)) / DAY);
  return { days, nextDue, daysLeft, due: daysLeft <= 0, rain };
}
