// Example plants, demo AI answers, and cleanup of AI answers.

export const EXAMPLES = [
  {
    id: "ex-monstera", example: true, scientificName: "Monstera deliciosa", family: "Araceae", wateringDays: 7, difficulty: "easy", confidence: 96,
    needs: { light: "bright", minTemp: 12, humidity: "high", placement: "indoor" },
    toxicity: { pets: true, kids: true },
    en: { commonName: "Swiss cheese plant", description: "A climbing tropical plant with large split leaves.",
      care: { water: "When the top 3 cm of soil is dry", light: "Bright, indirect light", soil: "Chunky, well-draining aroid mix", temperature: "18–27 °C", humidity: "Medium to high" },
      toxNote: "Sap and leaves irritate the mouth if chewed." },
    tr: { commonName: "Deve tabanı", description: "Büyük, yarıklı yaprakları olan tırmanıcı bir tropik bitki.",
      care: { water: "Toprağın üst 3 cm'i kuruyunca", light: "Parlak, dolaylı ışık", soil: "İri taneli, iyi drene olan karışım", temperature: "18–27 °C", humidity: "Orta ile yüksek" },
      toxNote: "Özsuyu ve yaprakları çiğnenirse ağzı tahriş eder." },
  },
  {
    id: "ex-spider", example: true, scientificName: "Chlorophytum comosum", family: "Asparagaceae", wateringDays: 5, difficulty: "easy", confidence: 93,
    needs: { light: "medium", minTemp: 8, humidity: "medium", placement: "both" },
    toxicity: { pets: false, kids: false },
    en: { commonName: "Spider plant", description: "Arching striped leaves that send out baby plantlets.",
      care: { water: "Keep lightly moist, never soggy", light: "Bright to medium indirect light", soil: "General potting mix", temperature: "13–27 °C", humidity: "Average room humidity" },
      toxNote: "Considered non-toxic to people and pets." },
    tr: { commonName: "Kurdele çiçeği", description: "Yavru fideler veren, kemerli çizgili yapraklar.",
      care: { water: "Hafif nemli tut, asla çamurlaşmasın", light: "Parlak ile orta dolaylı ışık", soil: "Genel saksı toprağı", temperature: "13–27 °C", humidity: "Normal oda nemi" },
      toxNote: "İnsanlar ve evcil hayvanlar için zehirsiz kabul edilir." },
  },
  {
    id: "ex-snake", example: true, scientificName: "Dracaena trifasciata", family: "Asparagaceae", wateringDays: 14, difficulty: "easy", confidence: 95,
    needs: { light: "low", minTemp: 10, humidity: "low", placement: "indoor" },
    toxicity: { pets: true, kids: true },
    en: { commonName: "Snake plant", description: "Stiff upright leaves that tolerate low light and dry soil.",
      care: { water: "Only when the soil is fully dry", light: "Low to bright indirect light", soil: "Cactus or sandy mix", temperature: "15–29 °C", humidity: "Low is fine" },
      toxNote: "Mildly toxic if eaten; can upset the stomach." },
    tr: { commonName: "Paşa kılıcı", description: "Az ışığa ve kuru toprağa dayanıklı, dik ve sert yapraklar.",
      care: { water: "Yalnızca toprak tamamen kuruyunca", light: "Az ile parlak dolaylı ışık", soil: "Kaktüs ya da kumlu karışım", temperature: "15–29 °C", humidity: "Düşük nem yeterli" },
      toxNote: "Yenirse hafif zehirli; mideyi bozabilir." },
  },
];

export function exampleAsPlant(ex, lang) {
  const t = ex[lang] || ex.en;
  return {
    ...ex, commonName: t.commonName, description: t.description, care: t.care,
    toxicity: { ...ex.toxicity, note: t.toxNote }, nickname: "", notes: "", photo: null,
    roomId: null, lastWatered: null, createdAt: null,
  };
}

export function demoIdentify(lang, hash = "") {
  // Pick by photo fingerprint: the same photo always gives the same demo answer.
  let n = 0;
  for (let i = 0; i < hash.length; i++) n = (n * 31 + hash.charCodeAt(i)) >>> 0;
  const ex = EXAMPLES[n % EXAMPLES.length];
  const p = exampleAsPlant(ex, lang);
  const others = EXAMPLES.filter(e => e !== ex).map(e => exampleAsPlant(e, lang));
  return {
    isPlant: true, demo: true,
    commonName: p.commonName, scientificName: p.scientificName, family: p.family, confidence: 88,
    alternatives: others.map((o, i) => ({ commonName: o.commonName, scientificName: o.scientificName, confidence: i ? 3 : 7 })),
    description: p.description, care: p.care, difficulty: p.difficulty, wateringDays: p.wateringDays,
    needs: p.needs, toxicity: p.toxicity,
  };
}

function demoContextNote(tr, ctx) {
  if (!ctx) return "";
  const parts = [];
  const r = ctx.room;
  const w = ctx.watering;
  if (r && (r.light === "low" || r.light === "medium")) parts.push(tr ? `${r.name} az ışık alıyor` : `${r.name} gets little light`);
  if (w.ownerWatersEveryDays && w.ownerWatersEveryDays < w.recommendedEveryDays) {
    parts.push(tr ? `${w.ownerWatersEveryDays} günde bir sulanıyor (önerilen ${w.recommendedEveryDays})` : `it's watered every ${w.ownerWatersEveryDays} days (we suggest ${w.recommendedEveryDays})`);
  } else if (w.lastWateredDaysAgo != null && w.lastWateredDaysAgo <= 2) {
    parts.push(tr ? `${w.lastWateredDaysAgo} gün önce sulandı` : `it was watered ${w.lastWateredDaysAgo} days ago`);
  }
  if (!parts.length) return "";
  return tr ? `${parts.join(" ve ")}: bu, fazla sulamayı en olası neden yapıyor.` : `${parts.join(" and ")}: that makes overwatering the most likely cause.`;
}

export function demoHealth(lang, ctx = null) {
  const tr = lang === "tr";
  return {
    isPlant: true, demo: true, healthy: false, urgency: "medium",
    contextNote: demoContextNote(tr, ctx),
    trend: ctx?.previousCheck ? "better" : null,
    summary: tr ? "Alt yapraklar sararmış ve toprak ıslak görünüyor." : "Lower leaves are yellowing and the soil looks wet.",
    problems: [
      {
        name: tr ? "Fazla sulama" : "Overwatering", likelihood: 70,
        signs: tr ? "Yumuşak, sararan alt yapraklar" : "Soft, yellowing lower leaves",
        cause: tr ? "Toprak uzun süre ıslak kalınca kökler hava alamaz." : "Soil stays wet too long and the roots can't breathe.",
        fix: tr
          ? ["Toprağın üst 3 cm'i kuruyana kadar sulama", "Saksının dibinde delik olduğundan emin ol", "Kararmış, yumuşak kökleri kes"]
          : ["Stop watering until the top 3 cm is dry", "Make sure the pot has a drainage hole", "Trim black, mushy roots"],
      },
      {
        name: tr ? "Besin eksikliği" : "Nutrient deficiency", likelihood: 20,
        signs: tr ? "Damarlar yeşil kalırken yaprak sararır" : "Leaf yellows while veins stay green",
        cause: tr ? "Uzun süredir gübre verilmemiş olabilir." : "It may not have been fed for a long time.",
        fix: tr ? ["İlkbahar ve yazda ayda bir sıvı gübre ver"] : ["Feed with liquid fertiliser monthly in spring and summer"],
      },
    ],
  };
}

const str = v => (typeof v === "string" ? v.trim() : "");
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

export function normalizeIdentify(r) {
  if (!r || typeof r !== "object" || r.isPlant === false) return { isPlant: false };
  const care = r.care && typeof r.care === "object" ? r.care : {};
  const tox = r.toxicity && typeof r.toxicity === "object" ? r.toxicity : {};
  const needs = r.needs && typeof r.needs === "object" ? r.needs : {};
  return {
    isPlant: true,
    commonName: str(r.commonName) || str(r.scientificName),
    scientificName: str(r.scientificName),
    family: str(r.family),
    confidence: Math.round(clamp(num(r.confidence, 50), 0, 100)),
    alternatives: (Array.isArray(r.alternatives) ? r.alternatives : []).slice(0, 3)
      .map(a => ({ commonName: str(a?.commonName), scientificName: str(a?.scientificName), confidence: Math.round(clamp(num(a?.confidence, 0), 0, 100)) }))
      .filter(a => a.commonName || a.scientificName),
    description: str(r.description),
    care: { water: str(care.water), light: str(care.light), soil: str(care.soil), temperature: str(care.temperature), humidity: str(care.humidity) },
    difficulty: oneOf(r.difficulty, ["easy", "medium", "hard"], "medium"),
    wateringDays: Math.round(clamp(num(r.wateringDays, 7), 1, 60)),
    needs: {
      light: oneOf(needs.light, ["low", "medium", "bright", "direct"], "medium"),
      minTemp: Math.round(clamp(num(needs.minTemp, 10), -30, 30)),
      humidity: oneOf(needs.humidity, ["low", "medium", "high"], "medium"),
      placement: oneOf(needs.placement, ["indoor", "both", "outdoor"], "indoor"),
    },
    toxicity: { pets: !!tox.pets, kids: !!tox.kids, note: str(tox.note) },
    demo: !!r.demo,
  };
}

export function normalizeHealth(r) {
  if (!r || typeof r !== "object" || r.isPlant === false) return { isPlant: false };
  return {
    isPlant: true,
    healthy: !!r.healthy,
    urgency: oneOf(r.urgency, ["low", "medium", "high"], "low"),
    summary: str(r.summary),
    contextNote: str(r.contextNote),
    trend: oneOf(r.trend, ["better", "same", "worse"], null),
    problems: (Array.isArray(r.problems) ? r.problems : []).slice(0, 3).map(p => ({
      name: str(p?.name), likelihood: Math.round(clamp(num(p?.likelihood, 0), 0, 100)),
      signs: str(p?.signs), cause: str(p?.cause),
      fix: (Array.isArray(p?.fix) ? p.fix : []).map(str).filter(Boolean).slice(0, 5),
    })).filter(p => p.name),
    demo: !!r.demo,
  };
}

export const displayName = p => p.nickname || p.commonName || p.scientificName || "";
