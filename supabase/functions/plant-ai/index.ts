// Yaprak AI: plant identification and health check with Gemini.
// Deploy:  supabase functions deploy plant-ai
// Secrets: supabase secrets set GEMINI_API_KEY=your-key
//          (optional) supabase secrets set GEMINI_MODEL=gemini-2.5-flash DAILY_AI_LIMIT=15
//
// Request:  POST { mode: "identify" | "health", image: "<base64 JPEG>", lang: "en" | "tr" }
//           with the signed-in user's token in the Authorization header (the app does this).
// Response: JSON in the shape the app expects (see src/lib/plants.js normalize functions).

import { createClient } from "jsr:@supabase/supabase-js@2";

const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";
const LIMIT = Number(Deno.env.get("DAILY_AI_LIMIT") ?? "15");
const FREE_HEALTH = Number(Deno.env.get("FREE_HEALTH_PER_MONTH") ?? "5");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

function identifyPrompt(language: string) {
  return `You are a botanist helping someone identify a plant from a photo they took.
Write every text value in ${language}. Keep scientificName and family in Latin.
Reply with only one JSON object in exactly this shape:
{"isPlant": true, "commonName": "", "scientificName": "Genus species", "family": "", "confidence": 0,
 "alternatives": [{"commonName": "", "scientificName": "", "confidence": 0}],
 "description": "", "care": {"water": "", "light": "", "soil": "", "temperature": "", "humidity": ""},
 "difficulty": "easy", "wateringDays": 7,
 "needs": {"light": "medium", "minTemp": 10, "humidity": "medium", "placement": "indoor"},
 "toxicity": {"pets": false, "kids": false, "note": ""}}
Rules:
- confidence is 0-100. Be honest: lower it when the photo is blurry, distant, or the plant is not distinctive.
- Up to 3 alternatives, most likely first, each a different species from the main answer.
- description: one sentence about what the plant is.
- Each care value: short practical advice for a home, under 12 words. Temperatures in °C.
- difficulty: exactly one of easy, medium, hard. wateringDays: whole number of days between waterings in a typical home.
- needs.light: one of low, medium, bright, direct. needs.minTemp: lowest safe night temperature in °C.
- needs.humidity: one of low, medium, high. needs.placement: indoor (house plant), both, or outdoor (garden/balcony plant).
- toxicity.pets: true if toxic to cats or dogs. toxicity.kids: true if harmful when eaten by a child. note: one short sentence.
- If no plant is visible, return {"isPlant": false} and nothing else.`;
}

function healthPrompt(language: string, context: unknown) {
  const ctx = context && typeof context === "object"
    ? `\nWhat the owner's app knows about this plant's home (facts, not guesses; use them to rank causes):\n${JSON.stringify(context).slice(0, 4000)}\n`
    : "";
  return `You are a plant doctor. Look at this photo of a plant and find disease, pests, or care problems.
Write every text value in ${language}.${ctx}
Reply with only one JSON object in exactly this shape:
{"isPlant": true, "healthy": false, "urgency": "medium", "summary": "", "contextNote": "", "trend": null,
 "problems": [{"name": "", "likelihood": 0, "signs": "", "cause": "", "fix": ["", ""]}]}
Rules:
- healthy: true only if you see no clear problem. Then problems is an empty array and summary says what looks good.
- urgency: low, medium, or high (high = the plant may die within days without action).
- summary: one sentence describing what you see.
- Up to 3 problems, most likely first. likelihood 0-100.
- signs: what in the photo points to it. cause: why it happens, one sentence. fix: 2-5 short steps a beginner can do at home.
- Prefer common causes (watering, light, pests like spider mites, mealybugs, fungus gnats) over rare diseases.
- contextNote: one sentence linking the home facts (room light, how often the owner waters vs. recommended, radiator, weather) to the main cause. Name the specific facts. Empty string if there are no home facts or they don't matter.
- Make the fix steps specific to the home facts when you can (e.g. "move it from the north bedroom to a brighter window").
- trend: only if previousCheck is given, compare with it: "better", "same" or "worse". Otherwise null.
- If no plant is visible, return {"isPlant": false} and nothing else.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // 1. Who is asking?
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData?.user) return json({ error: "not_signed_in" }, 401);

  // 2. Check the request
  let body: { mode?: string; image?: string; lang?: string; context?: unknown };
  try { body = await req.json(); } catch { return json({ error: "bad_json" }, 400); }
  const mode = body.mode === "health" ? "health" : "identify";
  if (!body.image || typeof body.image !== "string" || body.image.length > 8_000_000) {
    return json({ error: "missing_image" }, 400);
  }
  const language = body.lang === "tr" ? "Turkish" : "English";

  // 3. Daily limit
  const { data: usage, error: usageError } = await admin.rpc("bump_ai_usage", { p_user: userData.user.id, p_limit: LIMIT });
  if (usageError) return json({ error: "usage_check_failed" }, 500);
  if (!usage?.allowed) return json({ error: "daily_limit", limit: LIMIT }, 429);

  // 3b. Free plan: limited sick-plant checks per month
  if (mode === "health") {
    const { data: profile } = await admin.from("profiles").select("plan").eq("id", userData.user.id).maybeSingle();
    if ((profile?.plan ?? "free") !== "plus") {
      const { data: h, error: hError } = await admin.rpc("bump_health_usage", { p_user: userData.user.id, p_limit: FREE_HEALTH });
      if (hError) return json({ error: "usage_check_failed" }, 500);
      if (!h?.allowed) return json({ error: "health_limit", limit: FREE_HEALTH }, 402);
    }
  }

  // 4. Ask Gemini
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) return json({ error: "missing_gemini_key" }, 500);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: mode === "health" ? healthPrompt(language, body.context) : identifyPrompt(language) },
            { inline_data: { mime_type: "image/jpeg", data: body.image } },
          ],
        }],
        // temperature 0: as repeatable as possible for the same photo
        generationConfig: { responseMimeType: "application/json", temperature: 0 },
      }),
    });
    if (!res.ok) return json({ error: "ai_failed", status: res.status }, 502);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    const parsed = JSON.parse(text);
    return json(parsed);
  } catch (_e) {
    return json({ error: "ai_failed" }, 502);
  }
});
