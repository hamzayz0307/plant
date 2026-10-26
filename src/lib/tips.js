// "Tip of the week": built on the device from the user's own plants, rooms, season and weather.
// No AI call, so it costs nothing and works offline.

import { roomLight, wateringDays } from "./care.js";
import { waterTimes } from "./context.js";
import { displayName } from "./plants.js";

const DAY = 864e5;
export const weekKey = (now = Date.now()) => Math.floor((now / DAY + 3) / 7); // weeks start on Monday

const L = (en, tr) => ({ en, tr });

function personal({ plants, roomOf, weather, profile, month }) {
  const out = [];
  const heating = month >= 10 || month <= 2 || (month === 9);
  for (const p of plants) {
    const room = roomOf(p);
    const name = displayName(p);
    const needs = p.needs || {};

    if (room && room.radiator && heating && needs.humidity !== "low" && room.placement !== "balcony") {
      out.push({ id: `rad-${p.id}`, ...L(
        `Heating season in ${room.name}. Dry radiator air turns ${name}'s leaf tips brown. Move it about 1 m away or set a bowl of water nearby.`,
        `${room.name} için kalorifer sezonu başladı. Kuru hava ${name} yapraklarının uçlarını kahverengileştirir. Kaloriferden 1 m uzağa al ya da yanına su dolu bir kap koy.`) });
    }
    if (room && (needs.light === "bright" || needs.light === "direct") && roomLight(room) === 0) {
      out.push({ id: `dark-${p.id}`, ...L(
        `${name} gets too little light in ${room.name}. Move it within 1 m of your brightest window, especially in winter.`,
        `${name}, ${room.name} içinde az ışık alıyor. Evin en aydınlık penceresine 1 m yakın bir yere taşı, kışın ışık daha da azalır.`) });
    }
    const times = waterTimes(p);
    if (times.length >= 3) {
      const gaps = times.slice(0, -1).map((t, i) => (t - times[i + 1]) / DAY);
      const avg = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
      const rec = wateringDays(p, room, month);
      if (avg > 0 && avg < rec * 0.7) {
        out.push({ id: `over-${p.id}`, ...L(
          `You water ${name} about every ${avg} days; ${rec} is enough. Before watering, push a finger 3 cm into the soil: if it's damp, wait.`,
          `${name} için önerilen ${rec} günde bir, sen ${avg} günde bir suluyorsun. Sulamadan önce parmağını toprağa 3 cm sok: nemliyse bekle.`) });
      }
    }
    if (room && room.placement === "balcony") {
      const min = Number.isFinite(needs.minTemp) ? needs.minTemp : 10;
      const low = weather && Number.isFinite(weather.minNext) ? Math.round(weather.minNext) : null;
      if ((low != null && low < min + 3) || (low == null && heating && min >= 10)) {
        out.push({ id: `cold-${p.id}`, ...L(
          low != null
            ? `Nights are dropping to ${low} °C. ${name} dislikes anything below ${min} °C, so it's time to bring it inside.`
            : `Cold nights are coming. ${name} dislikes anything below ${min} °C, so plan to bring it inside.`,
          low != null
            ? `Geceler ${low} °C'ye düşüyor. ${name} ${min} °C altını sevmez, içeri alma zamanı.`
            : `Soğuk geceler geliyor. ${name} ${min} °C altını sevmez, içeri almayı planla.`) });
      }
    }
    if (profile?.petSafe && p.toxicity?.pets) {
      out.push({ id: `pet-${p.id}`, ...L(
        `${name} is toxic to cats and dogs. Keep it on a high shelf and pick up fallen leaves.`,
        `${name} kedi ve köpekler için zehirli. Yüksek bir rafa koy, düşen yaprakları topla.`) });
    }
  }
  return out;
}

function seasonal(month) {
  if (month === 11 || month <= 1) return [{ id: "s-winter", ...L(
    "Plants grow slowly in winter: water less and skip fertiliser until spring. Don't leave water sitting in the saucer.",
    "Kışın bitkiler yavaş büyür: sulamayı azalt, ilkbahara kadar gübre verme. Saksı tabağında su bekletme.") }];
  if (month >= 2 && month <= 4) return [
    { id: "s-repot", ...L(
      "Spring is repotting time. If roots poke out of the drainage hole, move the plant to a pot one size bigger.",
      "İlkbahar saksı değiştirme zamanı. Kökler saksının dibinden çıkıyorsa bir boy büyük saksıya al.") },
    { id: "s-feed", ...L(
      "Growing season has started: give liquid fertiliser once a month until autumn.",
      "Büyüme mevsimi başladı: sonbahara kadar ayda bir sıvı gübre ver.") }];
  if (month >= 5 && month <= 7) return [{ id: "s-summer", ...L(
    "In summer, water balcony plants early in the morning or in the evening. Midday water drops can scorch leaves.",
    "Yazın balkon bitkilerini sabah erken ya da akşam sula. Öğle sıcağında yapraktaki su damlaları yanık yapabilir.") }];
  return [{ id: "s-autumn", ...L(
    "Nights are getting cooler. Bring tropical balcony plants inside before nights drop below 10 °C.",
    "Geceler serinliyor. Balkondaki tropik bitkileri gece sıcaklığı 10 °C'nin altına inmeden içeri al.") }];
}

const GENERAL = [
  { id: "g-dust", ...L("Wipe the leaves with a damp cloth once a month. Dust blocks light.", "Yaprakları ayda bir nemli bezle sil. Toz ışığı keser.") },
  { id: "g-turn", ...L("Give the pot a quarter turn each time you water so the plant doesn't lean towards the window.", "Her sulamada saksıyı çeyrek tur çevir, bitki pencereye doğru eğilmesin.") },
  { id: "g-water", ...L("Use room-temperature water. Cold tap water shocks the roots.", "Oda sıcaklığında su kullan. Soğuk musluk suyu kökleri şoka sokar.") },
  { id: "g-yellow", ...L("One yellow leaf at the bottom now and then is normal. Yellowing at the top is worth a health check.", "Alttan ara sıra bir yaprağın sararması normaldir. Üst yapraklar sararıyorsa sağlık kontrolü yap.") },
  { id: "g-drain", ...L("Every pot needs a drainage hole. Standing water rots roots.", "Her saksının dibinde delik olmalı. Biriken su kökleri çürütür.") },
  { id: "g-new", ...L("Keep a new plant away from the others for 1–2 weeks. It can bring pests from the shop.", "Yeni aldığın bitkiyi 1-2 hafta diğerlerinden ayrı tut. Dükkândan zararlı getirebilir.") },
];

/** Tips in the order to show them: personal first, then the season, then general (rotated weekly). */
export function tipsFor({ plants, roomOf, weather, profile, lang, now = Date.now() }) {
  const month = new Date(now).getMonth();
  const w = weekKey(now);
  const general = GENERAL.map((_, i) => GENERAL[(i + w) % GENERAL.length]);
  return [...personal({ plants, roomOf, weather, profile, month }), ...seasonal(month), ...general]
    .map(tip => ({ id: tip.id, text: tip[lang] || tip.en, personal: !tip.id.startsWith("s-") && !tip.id.startsWith("g-") }));
}
