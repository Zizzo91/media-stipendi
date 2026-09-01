# media-stipendi

## Descrizione
Progressive Web App per il tracciamento degli stipendi mensili con sincronizzazione cloud su **Supabase**, protetta da **login PIN a 6 cifre** (server-side). Supporta dark mode, note per mese, grafici (Chart.js), confronto anni, KPI e progetto annua.

## Struttura
```
media-stipendi/
├── index.html                    — UI principale (Chart.js, FontAwesome); schermata login PIN
├── manifest.json                 — PWA manifest
├── sw.js                         — Service Worker (pass-through, niente cache contenuti)
├── config/
│   └── supabase-config.js        — window.SUPABASE_CONFIG {url, anonKey, pinEmail} (pubblico, committato)
├── style.css                     — Stili custom + dark mode + login screen + PIN pad
├── script.js                     — Logica principale (auth Supabase + sincronizzazione cloud)
├── salary_backup.json            — ⚠️ gitignored: backup locale (origine del seed/migrazione)
└── .github/workflows/keepalive.yml — Anti-pausa free tier (URL e anon key da Actions variables)
```

## Stack
- HTML/CSS/JS vanilla, Chart.js
- PWA con Service Worker (pass-through)
- Backend: **Supabase** (Postgres + Auth + RLS) — SDK `supabase-js` CDN UMD (global `window.supabase`).

## Login
- **PIN 6 cifre**: il PIN è la PASSWORD dell'account Supabase (`config/supabase-config.js → pinEmail`). Il codice non contiene mai il PIN: vive solo su Supabase (hashed), mai in repo, non clonabile.
- Primo accesso su un dispositivo: se l'utente non esiste ancora viene creato (`signUp`); con "Conferma email" attiva serve cliccare la mail di conferma una volta, poi reinserire lo stesso PIN.
- Se appare "email rate limit exceeded" → NON riprovare: attendere ~1 ora (quota oraria) e riprovare con lo stesso PIN.
- **Sessione persistente**: dopo il login il dispositivo resta autorizzato (localStorage `sb-<ref>-auth-token`, refresh automatico) → niente PIN nelle aperture successive.
- Senza sessione valida l'app mostra la schermata di login a schermo intero; il server rifiuta comunque le richieste anon (RLS).

## Database (Supabase, progetto `gfglazxhxxplhoteaahr`, schema `media_stipendi`)
- `media_stipendi.state(user_id uuid PK → auth.users, salaries jsonb, view jsonb, theme text, last_update timestamptz, updated_at)` — **una riga per utente**, struttura dati: `{salaries: {'2015': {'01': {amount, note}, ...}}, view: {year, monthId}, theme}` (dati migrati da salary_backup.json)
- RLS: solo ruolo `authenticated` legge/scrive la propria riga (`auth.uid()`); l'anon ha policy `using(false)` per il keepalive (200 senza dati)
- Salvataggi: ogni mutazione scrive su localStorage (cache/mirror) e fa upsert della propria riga `state` su Supabase via SDK `.schema('media_stipendi')`

## Note operative
- Keepalive generico: le Actions variables del repo `SUPABASE_URL` e `SUPABASE_ANON_KEY` vanno impostate su GitHub (Settings → Secrets and variables → Actions → Variables), altrimenti il workflow si salta con un warning.
- **Segreti**: `config/supabase-config.js` è committato perché serve a GitHub Pages, ma contiene SOLO dati pubblici (url, anon key, `pinEmail` = email di login). `service_role` e `db_password` stanno SOLO in `Config Utility/` — mai nel repo/progetto pubblico. I dati stipendi (`salary_backup.json`) non devono MAI essere committati.