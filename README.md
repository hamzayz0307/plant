# Yaprak

Plant app: scan a plant, learn its care, keep it alive in *your* rooms.

## What it does

| # | Function | Where |
|---|----------|-------|
| 1 | App shell, EN/TR, example plants | all screens |
| 2 | **Identify** a plant from a photo: name, match %, alternatives, care, pet/child safety | Scan → Identify |
| 3 | **My Garden**: save plants with nickname, notes, remove | My Garden |
| 4 | **Sign-in**: email + password, forgot password, language saved per account | first screen |
| 5 | **Rooms**: window direction, light, air, radiator, balcony. Care and watering adjust to the room | Rooms, plant page |
| 6 | **Will it survive at my place?** Scan before buying, see the best room | Scan → Before buying |
| 7 | **Watering**: schedule per plant, "Watered" button, Today list, reminder on open, rain skips balcony plants | My Garden, Profile → City |
| 8 | **Sick plant check** with a health log per plant | Scan → Sick plant, plant page |
| 9 | **Plant-sitter link**: share a page, no app needed, sitter ticks "Watered" | Profile |
| 10 | **Pet-safe mode**, daily AI limit (15 scans), feedback | Profile |

## Two modes

- **On this device** (no Supabase keys): works right away. Garden saved on the phone, scans give demo results.
- **Cloud** (Supabase keys added in Vercel): accounts, data saved online, real Gemini scans.

Nothing else changes. The app picks the mode by itself.

---

## Setup, step by step

### A. Put it online now (Vercel, on-device mode)

1. Go to **vercel.com** and sign in.
2. Top right: click **Add New…** → **Project**.
3. Find **plant** in the list → click **Import**.
4. Framework Preset should say **Vite**. Don't change anything.
5. Click **Deploy**. Wait about 1 minute.
6. Click **Continue to Dashboard** → click the link under **Domains**. Open it on your phone.

### B. Connect Supabase (when you have a free project slot)

The free plan allows 2 active projects. To free one: Supabase dashboard → open an old project → **Project Settings** (gear, bottom left) → **General** → scroll down → **Pause project**.

**1. Create the project**
1. **supabase.com/dashboard** → **New project**.
2. Name: `yaprak`. Database password: click **Generate a password** and save it somewhere.
3. Region: **Central EU (Frankfurt)**. Click **Create new project**. Wait ~2 minutes.

**2. Create the tables**
1. Left menu → **SQL Editor**.
2. Top left → **+** → **Create a new snippet**.
3. Open `supabase/migrations/001_init.sql` in GitHub → copy everything → paste.
4. Bottom right → **Run**. It should say *Success. No rows returned*.

**3. Sign-in settings**
1. Left menu → **Authentication** → **Sign In / Providers** → **Email**.
2. For testing with friends: turn **Confirm email** off → **Save**.
3. Left menu → **URL Configuration**.
4. **Site URL**: paste your Vercel link (e.g. `https://plant-xxx.vercel.app`) → **Save**.
5. **Redirect URLs** → **Add URL** → paste the same link → **Save URLs**.

**4. The AI function**
1. Left menu → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `plant-ai`.
3. Delete the sample code. Open `supabase/functions/plant-ai/index.ts` in GitHub → copy all → paste.
4. Bottom right → **Deploy function**.
5. Left menu (under Edge Functions) → **Secrets** → **Add new secret**:
   - Name `GEMINI_API_KEY`, Value: your key from Google AI Studio → **Save**.

**5. Connect Vercel to Supabase**
1. Supabase → **Project Settings** → **API Keys** → copy the **anon public** key.
2. Supabase → **Project Settings** → **Data API** → copy the **Project URL**.
3. Vercel → your **plant** project → **Settings** → **Environment Variables**.
4. Add `VITE_SUPABASE_URL` = Project URL. Click **Save**.
5. Add `VITE_SUPABASE_ANON_KEY` = anon key. Click **Save**.
6. Top menu → **Deployments** → on the newest one click **⋯** → **Redeploy**.

Done. Open the app: it now shows the sign-in screen.
Note: plants saved in on-device mode stay on that phone; they don't move into the new account.

---

## For developers

```bash
npm install
cp .env.example .env.local   # optional: add Supabase keys
npm run dev
```

- `src/lib/backend.js`: one interface, cloud (Supabase) and local implementations
- `src/lib/care.js`: room fit, watering schedule, rain skip
- `src/lib/weather.js`: Open-Meteo (free, no key)
- `supabase/migrations/001_init.sql`: tables, row-level security, sitter + limit functions
- `supabase/functions/plant-ai/index.ts`: Gemini identify + health, daily limit (`DAILY_AI_LIMIT`, default 15)

Optional Edge Function secrets: `GEMINI_MODEL` (default `gemini-2.5-flash`), `DAILY_AI_LIMIT`.
