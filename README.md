# Media Stipendi

Web app per il calcolo della media stipendi, con sincronizzazione cloud su **Supabase** e login PIN a 6 cifre.

Visita il sito: https://zizzo91.github.io/media-stipendi/

## Setup

Il progetto usa **Supabase** come backend (progetto `gestione-conti`, ref `gfglazxhxxplhoteaahr`):
- configurazione pubblica in `config/supabase-config.js` (URL + anonKey + pinEmail)
- dati in schema `media_stipendi`, tabella `state` (una riga per utente: `salaries`/`view`/`theme` come JSONB)
- auth con il PIN = password dell'account `simone.marramao@hotmail.it`

## Keepalive (anti-pausa free tier)

Il workflow `.github/workflows/keepalive.yml` pinga le tre app consolidate (public gestione-conti, investimenti, media_stipendi). Servono le Actions variables `SUPABASE_URL` e `SUPABASE_ANON_KEY`.