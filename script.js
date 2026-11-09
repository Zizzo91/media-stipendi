// ========================================
// CONFIGURAZIONE
// ========================================
const CONFIG = {
    startYear: 2015,
    endYear: 2060,
    storageKey: 'salary_data_v2'
};

// ========================================
// SUPABASE (cloud) — sincronizzazione
// ========================================
let supabaseConfig = window && window.SUPABASE_CONFIG ? window.SUPABASE_CONFIG : null;
let supabaseSdk = null;

function getSupabaseSdk() {
    if (supabaseSdk) return supabaseSdk;
    if (!supabaseConfig || !window.supabase || !window.supabase.createClient) return null;
    supabaseSdk = window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
        auth: { persistSession: false, autoRefreshToken: true, flowType: "pkce" }
    });
    return supabaseSdk;
}

// ========================================
// LOGIN PIN 6 CIFRE (il PIN è la password dell'account Supabase)
// ========================================
const PIN_LEN = 6;
let pinBuffer = '';

function injectLoginScreen() {
    if (document.getElementById('loginScreen')) return;
    let dots = '';
    for (let i = 0; i < PIN_LEN; i++) dots += `<div class="pin-dot" id="ldot${i}"></div>`;
    const keys = ['1','2','3','4','5','6','7','8','9','✕','0','⌫'];
    const padHTML = keys.map(k => {
        if (k === '✕') return `<button type="button" class="pin-btn" onclick="pinPadClear()">✕</button>`;
        if (k === '⌫') return `<button type="button" class="pin-btn" onclick="pinPadBackspace()">⌫</button>`;
        return `<button type="button" class="pin-btn" onclick="pinPad('${k}')">${k}</button>`;
    }).join('');
    const ls = document.createElement('div');
    ls.id = 'loginScreen';
    ls.className = 'login-screen';
    ls.innerHTML = `
        <div class="login-card">
            <div class="login-icon"><i class="fa-solid fa-lock"></i></div>
            <h2 id="loginTitle">Accesso protetto</h2>
            <p class="login-sub">Inserisci il PIN a 6 cifre</p>
            <div id="loginDots" class="pin-dots">${dots}</div>
            <div id="loginError" class="login-error"></div>
            <div class="pin-pad">${padHTML}</div>
        </div>`;
    document.body.appendChild(ls);
}

function showLoginScreen() {
    const ls = document.getElementById('loginScreen');
    if (ls) ls.classList.remove('hidden');
    const lo = document.getElementById('logoutBtn');
    if (lo) lo.style.display = 'none';
}
function hideLoginScreen() {
    const ls = document.getElementById('loginScreen');
    if (ls) ls.classList.add('hidden');
    const lo = document.getElementById('logoutBtn');
    if (lo) lo.style.display = 'inline-block';
}

function pinPad(d) {
    if (pinBuffer.length >= PIN_LEN) return;
    pinBuffer += d;
    updateLoginDots();
    if (pinBuffer.length === PIN_LEN) setTimeout(() => doPinLogin(), 180);
}
function pinPadBackspace() { pinBuffer = pinBuffer.slice(0, -1); updateLoginDots(); hideLoginError(); }
function pinPadClear()      { pinBuffer = ''; updateLoginDots(); hideLoginError(); }
function updateLoginDots() {
    for (let i = 0; i < PIN_LEN; i++) {
        const el = document.getElementById('ldot' + i);
        if (el) el.classList.toggle('filled', i < pinBuffer.length);
    }
}
function showLoginError(msg) { const el = document.getElementById('loginError'); if (el) el.textContent = msg; }
function hideLoginError()    { const el = document.getElementById('loginError'); if (el) el.textContent = ''; }

async function doPinLogin() {
    const sdk = getSupabaseSdk();
    const email = (supabaseConfig && supabaseConfig.pinEmail || '').trim().toLowerCase();
    if (!email) { showLoginError('Config mancante (pinEmail).'); return; }
    if (!sdk)   { showLoginError('SDK non disponibile.'); return; }
    const password = pinBuffer; pinBuffer = ''; updateLoginDots();
    const title = document.getElementById('loginTitle');
    if (title) title.textContent = 'Verifica...';
    hideLoginError();
    try {
        let { data, error } = await sdk.auth.signInWithPassword({ email, password });
        if (error && /invalid login credentials/i.test(error.message || '')) {
            const su = await sdk.auth.signUp({ email, password });
            if (su.error) {
                if (title) title.textContent = 'Accesso protetto';
                const m = (su.error.message || '').toLowerCase();
                if (/rate limit|troppi tentativi|email.*limit/i.test(m)) {
                    showLoginError('Limite momentaneo di Supabase: riprova tra circa un\'ora con lo stesso PIN.');
                    return;
                }
                if (/weak_password|8 character|too short|almeno 8/i.test(m)) {
                    showLoginError('Supabase richiede una password più lunga: imposta \'Minimum password length\' a 6 nel pannello Auth.');
                    return;
                }
                if (/already registered/i.test(m)) showLoginError('PIN errato.');
                else showLoginError(su.error.message || 'Errore');
                return;
            }
            if (!su.data || !su.data.session) {
                if (title) title.textContent = 'Accesso protetto';
                showLoginError('Account creato: verifica l\'email di conferma, poi riprova con lo stesso PIN.');
                return;
            }
            data = su.data;
        }
        if (error) { if (title) title.textContent = 'Accesso protetto'; showLoginError(error.message || 'Errore'); return; }
        hideLoginScreen();
        await startApp();
    } catch (e) {
        if (title) title.textContent = 'Accesso protetto';
        showLoginError(e && e.message ? e.message : 'Errore');
    }
}

async function logout() {
    const sdk = getSupabaseSdk();
    try { if (sdk) await sdk.auth.signOut(); } catch (e) {}
    window.location.reload();
}

// ========================================
// AVVIO APP
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator)
        window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));

    injectLoginScreen();
    getSupabaseSdk();
    await checkInitialAuth();
    initYearSelectors();
    setInitialDate();
    enhanceUI();
    setupEventListeners();
    setupCurrencyFormatter();
});

// ─── Tastiera fisica durante il login PIN (opzionale: aggiuntiva al tastierino/touch) ───
document.addEventListener('keydown', function(e){
  const ls = document.getElementById('loginScreen');
  if (!ls || ls.classList.contains('hidden')) return;
  const tag = document.activeElement && document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.repeat) return; // ignora la ripetizione di un tasto tenuto premuto
  if (/^[0-9]$/.test(e.key)) { e.preventDefault(); pinPad(e.key); }
  else if (e.key === 'Backspace') { e.preventDefault(); pinPadBackspace(); }
  else if (e.key === 'Escape') { e.preventDefault(); pinPadClear(); }
  else if (e.key === 'Enter' && pinBuffer.length > 0) { e.preventDefault(); doPinLogin(); }
});

async function checkInitialAuth() {
    const sdk = getSupabaseSdk();
    if (!sdk) { showLoginScreen(); return false; }
    try {
        const { data } = await sdk.auth.getSession();
        if (data.session) { hideLoginScreen(); setSyncStatus('ready'); return true; }
    } catch (e) {}
    showLoginScreen();
    setSyncStatus('local');
    return false;
}

// Avvio completo dopo login (carica cloud e aggiorna tutto)
async function startApp() {
    await loadData();
    initYearSelectors();
    setInitialDate();
    enhanceUI();
    setupEventListeners();
    setupCurrencyFormatter();
    updateUI(true);
}

const MENSILITA = [
    { id: '01', name: 'Gen', full: 'Gennaio' },
    { id: '02', name: 'Feb', full: 'Febbraio' },
    { id: '03', name: 'Mar', full: 'Marzo' },
    { id: '04', name: 'Apr', full: 'Aprile' },
    { id: '05', name: 'Mag', full: 'Maggio' },
    { id: '06', name: 'Giu', full: 'Giugno' },
    { id: '14', name: '14ª', full: 'Quattordicesima', extra: true },
    { id: '07', name: 'Lug', full: 'Luglio' },
    { id: '08', name: 'Ago', full: 'Agosto' },
    { id: '09', name: 'Set', full: 'Settembre' },
    { id: '10', name: 'Ott', full: 'Ottobre' },
    { id: '11', name: 'Nov', full: 'Novembre' },
    { id: '12', name: 'Dic', full: 'Dicembre' },
    { id: '13', name: '13ª', full: 'Tredicesima', extra: true }
];

let state = {
    view: { year: 2026, monthId: '01' },
    salaries: {},
    theme: 'light'
};

let mChart = null;
let cChart = null;
let yChart = null; let cachedFileSHA = null;

// ========================================
// MIGRAZIONE DATI (numeri puri -> {amount, note})
// ========================================
function migrateSalaries() {
    if (!state.salaries) return;
    Object.keys(state.salaries).forEach(year => {
        const yearData = state.salaries[year];
        if (!yearData) return;
        Object.keys(yearData).forEach(monthId => {
            const entry = yearData[monthId];
            // Se è un numero puro o stringa numerica, converti in oggetto
            if (typeof entry === 'number') {
                yearData[monthId] = { amount: entry, note: '' };
            } else if (typeof entry === 'string') {
                const n = parseFloat(entry);
                yearData[monthId] = { amount: isNaN(n) ? null : n, note: '' };
            }
            // Se è già oggetto {amount, note}, non toccare
        });
    });
}

// ========================================
// ENHANCE UI
// ========================================
function enhanceUI() {
    injectEnhancementStyles();
    injectSyncBadge();
    injectNoteAndDeleteControls();
    injectTableVariationColumn();
    injectKpiIcons();
    injectLogoutButton();
    setSyncStatus('local');
}

function injectLogoutButton() {
    const container = document.querySelector('.navbar .year-selector-container');
    if (!container || document.getElementById('logoutBtn')) return;
    const btn = document.createElement('button');
    btn.id = 'logoutBtn';
    btn.className = 'icon-btn';
    btn.title = 'Esci';
    btn.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i>';
    btn.style.display = 'none';
    btn.onclick = logout;
    container.appendChild(btn);
}

function injectEnhancementStyles() {
    if (document.getElementById('enhancements-css')) return;
    const css = `
      .sync-badge{display:inline-flex;align-items:center;gap:.5rem;padding:0 12px;height:32px;border:1px solid var(--navbar-border);border-radius:980px;font-size:12px;font-weight:500;cursor:default;background:rgba(255,255,255,.08);color:rgba(245,245,247,.88)}
      .sync-dot{width:.45rem;height:.45rem;border-radius:50%;flex-shrink:0}
      .sync-local .sync-dot{background:#8e8e93}
      .sync-ready .sync-dot{background:#0a84ff}
      .sync-syncing .sync-dot{background:#ffd60a;animation:pulse 1s infinite}
      .sync-synced .sync-dot{background:#30d158}
      .sync-error .sync-dot{background:#ff453a}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      .note-wrap{margin-top:1.25rem;text-align:left}
      .note-label{display:block;margin-bottom:.5rem;color:var(--text-muted);font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
      #noteInput{
        width:100%;min-height:84px;resize:vertical;
        border:1px solid var(--border-soft);border-radius:14px;padding:14px 16px;
        background:var(--surface-2);color:var(--text);font-family:inherit;
        font-size:15px;line-height:1.5;letter-spacing:-.01em;
        transition:border-color .3s,box-shadow .3s,background .3s;
      }
      #noteInput:focus{outline:none;border-color:var(--primary);background:var(--card-bg);box-shadow:0 0 0 4px var(--primary-light)}
      #noteInput::placeholder{color:var(--text-muted);opacity:.8}
      .btn-danger{flex:1 1 0;background:rgba(255,59,48,.10);color:var(--danger);box-shadow:none}
      .btn-danger:hover{background:rgba(255,59,48,.17)}
      .btn-secondary{flex:1 1 0;background:var(--surface-2);color:var(--text);box-shadow:none}
      .btn-secondary:hover{background:var(--border-soft)}
      .var-badge{display:inline-flex;align-items:center;padding:3px 9px;border-radius:980px;font-weight:600;font-size:12px;border:1px solid transparent;font-variant-numeric:tabular-nums}
      .var-pos{color:var(--success);background:rgba(52,199,89,.12)}
      .var-neg{color:var(--danger);background:rgba(255,59,48,.10)}
      .var-neu{color:var(--text-muted);background:var(--surface-2)}
      .kpi-icon{font-size:15px;color:var(--text-muted);margin-bottom:auto}
      .kpi-card--feature .kpi-icon{color:rgba(255,255,255,.72)}
      .toast-sync{
        position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(14px);
        background:rgba(29,29,31,.92);border:1px solid rgba(255,255,255,.12);
        -webkit-backdrop-filter:blur(20px) saturate(180%);backdrop-filter:blur(20px) saturate(180%);
        color:#f5f5f7;padding:12px 20px;border-radius:980px;font-size:14px;font-weight:500;
        letter-spacing:-.01em;box-shadow:0 12px 40px rgba(0,0,0,.28);
        opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;z-index:9999;white-space:nowrap;
      }
      .toast-sync.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(max-width:480px){.toast-sync{white-space:normal;text-align:center;max-width:88vw}}
    `;
    const style = document.createElement('style');
    style.id = 'enhancements-css';
    style.textContent = css;
    document.head.appendChild(style);

    // Toast sync dedicato
    if (!document.getElementById('toastSync')) {
        const ts = document.createElement('div');
        ts.id = 'toastSync';
        ts.className = 'toast-sync';
        document.body.appendChild(ts);
    }
}

function injectSyncBadge() {
    if (document.getElementById('syncBadge')) return;
    const container = document.querySelector('.navbar .year-selector-container');
    if (!container) return;
    const badge = document.createElement('div');
    badge.id = 'syncBadge';
    badge.className = 'sync-badge sync-local';
    badge.title = 'Stato sincronizzazione Supabase';
    const dot = document.createElement('span');
    dot.className = 'sync-dot';
    dot.id = 'syncDot';
    const text = document.createElement('span');
    text.id = 'syncText';
    text.textContent = 'Locale';
    badge.appendChild(dot);
    badge.appendChild(text);
    container.appendChild(badge);
}

function setSyncStatus(status, extraText = '') {
    const badge = document.getElementById('syncBadge');
    const text = document.getElementById('syncText');
    if (!badge || !text) return;
    badge.classList.remove('sync-local','sync-ready','sync-syncing','sync-synced','sync-error');
    const map = {
        local:   ['sync-local',   'Locale'],
        ready:   ['sync-ready',   'Pronto'],
        syncing: ['sync-syncing', 'Sync…'],
        synced:  ['sync-synced',  extraText ? `Sync OK (${extraText})` : 'Sync OK'],
        error:   ['sync-error',   extraText ? `Errore (${extraText})` : 'Errore']
    };
    const [cls, label] = map[status] || map.local;
    badge.classList.add(cls);
    text.textContent = label;
}

function showSyncToast(msg) {
    const t = document.getElementById('toastSync');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3500);
}

function injectNoteAndDeleteControls() {
    if (!document.getElementById('noteInput')) {
        const inputSection = document.querySelector('.input-section');
        if (inputSection) {
            const wrap = document.createElement('div');
            wrap.className = 'note-wrap';
            wrap.innerHTML = `
              <label for="noteInput" class="note-label">
                <i class="fa-solid fa-pen-to-square" style="margin-right:4px;"></i> Note aggiuntive
              </label>
              <textarea id="noteInput" placeholder="Es. Bonus, rimborsi, straordinari..."></textarea>
            `;
            inputSection.insertBefore(wrap, document.querySelector('.form-actions'));
        }
    }
    const actions = document.querySelector('.form-actions');
    if (actions && !document.getElementById('btnDeleteMonth')) {
        actions.style.gap = '1rem';
        const delBtn = document.createElement('button');
        delBtn.id = 'btnDeleteMonth';
        delBtn.className = 'btn btn-danger';
        delBtn.type = 'button';
        delBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Cancella mese';
        actions.appendChild(delBtn);
    }
}

function injectTableVariationColumn() {
    const table = document.getElementById('salaryTable');
    if (!table) return;
    const headRow = table.querySelector('thead tr');
    if (headRow && !headRow.querySelector('th[data-col="var"]')) {
        const th = document.createElement('th');
        th.setAttribute('data-col', 'var');
        th.textContent = 'Var %';
        headRow.insertBefore(th, headRow.children[2] || null);
    }
}

function injectKpiIcons() {
    const cards = document.querySelectorAll('.kpi-card');
    if (!cards || !cards.length) return;
    const icons = ['fa-calendar-check','fa-chart-line','fa-trophy','fa-wand-magic-sparkles','fa-list-check'];
    cards.forEach((card, idx) => {
        if (card.querySelector('.kpi-icon')) return;
        const div = document.createElement('div');
        div.className = 'kpi-icon';
        div.innerHTML = `<i class="fa-solid ${icons[idx] || 'fa-circle-info'}"></i>`;
        card.insertBefore(div, card.firstChild);
    });
}

// ========================================
// NORMALIZZATORI
// ========================================
function normalizeEntry(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'number') return { amount: entry, note: '' };
    if (typeof entry === 'object') {
        const amount = (typeof entry.amount === 'number') ? entry.amount : (entry.amount ? parseFloat(entry.amount) : null);
        const note = entry.note ? String(entry.note) : '';
        return { amount: (isNaN(amount) ? null : amount), note };
    }
    const n = parseFloat(entry);
    return isNaN(n) ? null : { amount: n, note: '' };
}

function getAmount(entry) {
    const e = normalizeEntry(entry);
    return e && typeof e.amount === 'number' ? e.amount : null;
}

function getNote(entry) {
    const e = normalizeEntry(entry);
    return e ? (e.note || '') : '';
}

function fmtPercent(p) {
    const sign = p > 0 ? '+' : '';
    return `${sign}${p.toFixed(1)}%`;
}

function isSmallScreen() {
    return window.matchMedia && window.matchMedia('(max-width: 480px)').matches;
}

// ========================================
// CARICAMENTO DATI (cloud Supabase -> fallback locale)
// ========================================
async function loadData() {
    const sdk = getSupabaseSdk();
    let loadedFromCloud = false;

    if (sdk) {
        try {
            const { data: sData } = await sdk.auth.getSession();
            if (sData.session) {
                const { data: sessionUser } = await sdk.auth.getUser();
                if (sessionUser && sessionUser.user) {
                    const { data, error } = await sdk
                        .from('media_stipendi_state')
                        .select('salaries,view,theme,last_update')
                        .eq('user_id', sessionUser.user.id)
                        .maybeSingle();
                    if (!error && data) {
                        if (data.salaries && typeof data.salaries === 'object') state.salaries = data.salaries;
                        if (data.view && typeof data.view === 'object') state.view = data.view;
                        if (typeof data.theme === 'string') state.theme = data.theme;
                        migrateSalaries();
                        localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
                        if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
                        else document.body.removeAttribute('data-theme');
                        const d = data.last_update ? new Date(data.last_update) : null;
                        const timeStr = d ? d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
                        setSyncStatus('synced', timeStr);
                        console.log("✅ Dati caricati da Supabase");
                        loadedFromCloud = true;
                    }
                }
            }
        } catch (e) {
            console.warn("Supabase offline o errore rete, uso dati locali:", e);
        }
    }

    if (!loadedFromCloud) {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            try {
                state = JSON.parse(saved);
                migrateSalaries();
            } catch (e) {}
        }
        if (!sdk || !(await isSessionValid())) setSyncStatus('local');
    }

    if (!state.view) state.view = { year: 2026, monthId: '01' };
    if (!state.salaries) state.salaries = {};
    if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
}

async function isSessionValid() {
    const sdk = getSupabaseSdk();
    if (!sdk) return false;
    try {
        const { data } = await sdk.auth.getSession();
        return !!(data.session);
    } catch (e) { return false; }
}

// ========================================
// SALVATAGGIO DATI (locale + cloud Supabase)
// ========================================
function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    syncToCloud();
}

async function syncToCloud() {
    const sdk = getSupabaseSdk();
    if (!sdk) { setSyncStatus('local'); return; }
    const { data: sessionData } = await sdk.auth.getSession();
    if (!sessionData.session) { setSyncStatus('local'); return; }

    setSyncStatus('syncing');

    try {
        const { data: { user } } = await sdk.auth.getUser();
        if (!user) { setSyncStatus('local'); return; }
        const row = {
            user_id: user.id,
            salaries: state.salaries || {},
            view: state.view || { year: 2026, monthId: '01' },
            theme: state.theme || 'light',
            last_update: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        const { error } = await sdk
            .from('media_stipendi_state')
            .upsert(row, { onConflict: 'user_id' });

        if (error) {
            if (/rate limit|troppi tentativi/i.test(error.message || '')) {
                setSyncStatus('error', 'rate limit');
                showSyncToast('⚠️ Limite momentaneo Supabase: riprova tra circa un\'ora.');
                return;
            }
            console.error("Errore Sync:", error.message);
            setSyncStatus('error', error.message);
            showSyncToast(`❌ Sync fallito: ${error.message}`);
            return;
        }
        const timeStr = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        setSyncStatus('synced', timeStr);
        showSyncToast(`✅ Salvato su cloud alle ${timeStr}`);
    } catch (error) {
        console.error("Errore Sync:", error);
        setSyncStatus('error');
        showSyncToast('❌ Sync fallito: errore di rete');
    }
}

// ========================================
// INIZIALIZZAZIONE UI
// ========================================
function setInitialDate() {
    if (!localStorage.getItem(CONFIG.storageKey)) {
        const now = new Date();
        state.view.year = now.getFullYear();
        state.view.monthId = (now.getMonth() + 1).toString().padStart(2, '0');
    }
}

function initYearSelectors() {
    const picker = document.getElementById('yearPicker');
    if (!picker) return;
    picker.innerHTML = '';
    const cmp1 = document.getElementById('cmpYear1');
    const cmp2 = document.getElementById('cmpYear2');
    if (cmp1) cmp1.innerHTML = '';
    if (cmp2) cmp2.innerHTML = '';

    for (let y = CONFIG.startYear; y <= CONFIG.endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + (y === new Date().getFullYear() ? ' (Corrente)' : '');
        picker.appendChild(opt);

        if (cmp1) {
            const opt1 = opt.cloneNode(true);
            opt1.textContent = y;
            cmp1.appendChild(opt1);
        }
        if (cmp2) {
            const opt2 = opt.cloneNode(true);
            opt2.textContent = y;
            cmp2.appendChild(opt2);
        }
    }
}

function updateUI(resetComparison = false) {
    renderMonthGrid();
    renderForm();
    renderKPIs();
    renderTable();
    updateYtdBadge();
    document.getElementById('yearPicker').value = state.view.year;
    if (resetComparison) {
        document.getElementById('cmpYear1').value = state.view.year;
        document.getElementById('cmpYear2').value = state.view.year - 1;
    }
    updateCharts();
}

function updateYtdBadge() {
    const badge = document.getElementById('ytdBadge');
    if (!badge) return;
    if (!state || !state.salaries || !state.view) { badge.style.display = 'none'; return; }

    const currYear = state.view.year;
    const currYearData = state.salaries[currYear] || {};
    const filledMonths = MENSILITA.map(m => m.id).filter(mId => getAmount(currYearData[mId]) !== null);
    if (filledMonths.length === 0) { badge.style.display = 'none'; return; }

    const currTotal = filledMonths.reduce((sum, mId) => sum + getAmount(currYearData[mId]), 0);
    let bestPastTotal = 0;
    let bestPastYear = null;

    Object.keys(state.salaries).forEach(yStr => {
        const y = parseInt(yStr);
        if (y >= currYear) return;
        const pastData = state.salaries[y] || {};
        let pastTotal = 0, hasValidData = false;
        filledMonths.forEach(mId => {
            const amount = getAmount(pastData[mId]);
            if (amount !== null) { pastTotal += amount; hasValidData = true; }
        });
        if (hasValidData && pastTotal > bestPastTotal) { bestPastTotal = pastTotal; bestPastYear = y; }
    });

    if (bestPastTotal <= 0) { badge.style.display = 'none'; return; }

    const diff = currTotal - bestPastTotal;
    const pct = (diff / bestPastTotal) * 100;
    const diffFormatted = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(diff);

    let cls = 'ytd-badge ', icon = '', sign = '';
    if (diff > 0) { cls += 'pos'; icon = '<i class="fa-solid fa-arrow-trend-up"></i>'; sign = '+'; }
    else if (diff < 0) { cls += 'neg'; icon = '<i class="fa-solid fa-arrow-trend-down"></i>'; }
    else { cls += 'neu'; icon = '<i class="fa-solid fa-minus"></i>'; }

    badge.className = cls;
    if (diff === 0) {
        badge.innerHTML = `${icon} Pari al MAX (${bestPastYear})`;
    } else {
        badge.innerHTML = `${icon} ${sign}${Math.abs(pct).toFixed(1)}% (${diffFormatted}) vs MAX (${bestPastYear})`;
    }
    badge.title = `Totale attuale (stessi mesi): € ${currTotal.toLocaleString('it-IT', {minimumFractionDigits:2})}\nMax storico nello stesso periodo (${bestPastYear}): € ${bestPastTotal.toLocaleString('it-IT', {minimumFractionDigits:2})}`;
    badge.style.display = 'inline-flex';
}

// ========================================
// FORMATTAZIONE VALUTA INPUT
// ========================================
function setupCurrencyFormatter() {
    const displayInput = document.getElementById('salaryDisplay');
    const hiddenInput = document.getElementById('salaryInput');
    if (!displayInput || !hiddenInput) return;

    displayInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9.,]/g, '');
        value = value.replace(/\./g, ',');
        const parts = value.split(',');
        if (parts.length > 2) value = parts[0] + ',' + parts.slice(1).join('');
        if (value.includes(',')) {
            const dec = value.split(',')[1];
            if (dec.length > 2) value = value.split(',')[0] + ',' + dec.substring(0, 2);
        }
        const numForFormatting = value.replace(/,/g, '.');
        const parsed = parseFloat(numForFormatting);
        if (!isNaN(parsed) && value !== '') {
            if (value.endsWith(',') || (value.includes(',') && value.endsWith('0'))) {
                const intPart = parseInt(parts[0], 10).toLocaleString('it-IT');
                const decPart = parts.length > 1 ? ',' + parts[1] : '';
                displayInput.value = intPart + decPart;
            } else {
                displayInput.value = parsed.toLocaleString('it-IT');
            }
            hiddenInput.value = parsed;
        } else {
            displayInput.value = '';
            hiddenInput.value = '';
        }
        displayInput.size = Math.max(4, displayInput.value.length);
    });

    displayInput.addEventListener('focus', function() { this.select(); });
}

// ========================================
// RENDERING
// ========================================
function renderMonthGrid() {
    const grid = document.getElementById('monthGrid');
    const now = new Date();
    grid.innerHTML = '';
    MENSILITA.forEach(m => {
        const div = document.createElement('div');
        div.className = 'month-box';
        if (m.extra) div.classList.add('extra');
        if (state.view.monthId === m.id) div.classList.add('is-selected');
        if (getAmount(state.salaries[state.view.year]?.[m.id]) !== null) div.classList.add('has-data');
        if (state.view.year === now.getFullYear() && (now.getMonth() + 1).toString().padStart(2, '0') === m.id) div.classList.add('is-current-glob');
        div.textContent = m.name;
        div.onclick = () => { state.view.monthId = m.id; updateUI(); };
        grid.appendChild(div);
    });
}

function renderForm() {
    const mInfo = MENSILITA.find(m => m.id === state.view.monthId);
    document.getElementById('formTitle').textContent = `${mInfo.full} ${state.view.year}`;
    const entry = state.salaries[state.view.year]?.[state.view.monthId];
    const amount = getAmount(entry);
    const note = getNote(entry);
    const displayInput = document.getElementById('salaryDisplay');
    const hiddenInput = document.getElementById('salaryInput');
    const noteInput = document.getElementById('noteInput');
    if (amount !== null) {
        hiddenInput.value = amount;
        displayInput.value = amount.toLocaleString('it-IT', { maximumFractionDigits: 2 });
    } else {
        hiddenInput.value = '';
        displayInput.value = '';
    }
    displayInput.size = Math.max(4, displayInput.value.length);
    if (noteInput) noteInput.value = note || '';
}

function renderKPIs() {
    const yearData = state.salaries[state.view.year] || {};
    const values = Object.values(yearData).map(e => getAmount(e)).filter(v => typeof v === 'number');
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? (total / 12) : 0;

    const avgPerPaycheck = values.length ? (total / values.length) : 0;
    let typicalMonths = 13;
    let maxPastMonths = 0;
    Object.keys(state.salaries).forEach(y => {
        if (parseInt(y) < state.view.year) {
            const pastVals = Object.values(state.salaries[y]).map(e => getAmount(e)).filter(v => typeof v === 'number');
            if (pastVals.length > maxPastMonths) maxPastMonths = pastVals.length;
        }
    });
    if (maxPastMonths >= 12 && maxPastMonths <= 14) typicalMonths = maxPastMonths;
    let forecast = total;
    if (values.length > 0 && values.length < typicalMonths) {
        forecast = total + (avgPerPaycheck * (typicalMonths - values.length));
    }

    const euro0 = { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0 };
    document.getElementById('kpiTotal').textContent = total.toLocaleString('it-IT', euro0);
    document.getElementById('kpiAvg').textContent = avg.toLocaleString('it-IT', euro0);
    document.getElementById('kpiMax').textContent = values.length ? Math.max(...values).toLocaleString('it-IT', euro0) : '€ 0';
    const kpiForecastEl = document.getElementById('kpiForecast');
    if (kpiForecastEl) {
        kpiForecastEl.textContent = values.length > 0
            ? forecast.toLocaleString('it-IT', euro0)
            : '-';
    }
    document.getElementById('kpiCount').textContent = `${values.length} / 14`;
}

function renderTable() {
    const tbody = document.querySelector('#salaryTable tbody');
    tbody.innerHTML = '';
    let prevAmount = null;
    MENSILITA.forEach(m => {
        const entry = state.salaries[state.view.year]?.[m.id];
        const amount = getAmount(entry);
        const note = getNote(entry);
        let varHtml = '<span class="var-badge var-neu">-</span>';
        if (!m.extra && amount !== null && prevAmount !== null && prevAmount !== 0) {
            const pct = ((amount - prevAmount) / prevAmount) * 100;
            const cls = pct > 0 ? 'var-pos' : (pct < 0 ? 'var-neg' : 'var-neu');
            varHtml = `<span class="var-badge ${cls}">${fmtPercent(pct)}</span>`;
        }
        if (!m.extra && amount !== null) prevAmount = amount;
        const noteIcon = note
            ? `<i class="fa-solid fa-note-sticky" title="${note.replaceAll('"','&quot;')}" style="margin-left:8px;color:var(--accent)"></i>`
            : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${m.full}</td>
          <td>${amount !== null ? amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '-'}${noteIcon}</td>
          <td>${varHtml}</td>
          <td>${amount !== null ? '<i class="fa-solid fa-check" style="color:var(--success)"></i>' : ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

// ========================================
// GRAFICI — stile Apple (Chart.js)
// ========================================
const CHART_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif';

function cssVar(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
}

function withAlpha(color, alpha) {
    const c = String(color || '').trim();
    if (c.startsWith('#')) {
        let hex = c.slice(1);
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        if (hex.length === 8) hex = hex.slice(0, 6);
        const n = parseInt(hex, 16);
        if (!isNaN(n)) {
            const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
    }
    if (c.startsWith('rgb(')) return c.replace('rgb(', 'rgba(').replace(')', `, ${alpha})`);
    if (c.startsWith('rgba(')) {
        const m = c.match(/rgba?\(([^)]+)\)/);
        if (m) return `rgba(${m[1].split(',').slice(0, 3).join(',')}, ${alpha})`;
    }
    return c;
}

function euroAxis(v) {
    const n = Number(v) || 0;
    if (Math.abs(n) >= 1000) {
        return '€ ' + (n / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 }) + 'k';
    }
    return '€ ' + n.toLocaleString('it-IT');
}

function appleTooltip(bg) {
    return {
        backgroundColor: bg,
        titleColor: '#f5f5f7',
        bodyColor: '#f5f5f7',
        footerColor: 'rgba(245,245,247,.72)',
        borderColor: 'rgba(255,255,255,.12)',
        borderWidth: 1,
        padding: 14,
        cornerRadius: 14,
        caretSize: 6,
        displayColors: false,
        titleFont: { size: 13, weight: '600', family: CHART_FONT },
        bodyFont: { size: 13, family: CHART_FONT },
        footerFont: { size: 12, family: CHART_FONT }
    };
}

function updateThemeIcon() {
    const icon = document.querySelector('#themeToggle i');
    if (!icon) return;
    icon.className = document.body.hasAttribute('data-theme') ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function updateCharts() {
    const primary = cssVar('--primary', '#0071e3');
    const tick = cssVar('--chart-tick', '#86868b');
    const grid = cssVar('--chart-grid', 'rgba(0,0,0,.07)');
    const barMuted = cssVar('--chart-bar-muted', '#d2d2d7');
    const chart2 = cssVar('--chart-2', '#64d2ff');
    const tooltipBg = cssVar('--chart-tooltip', '#1d1d1f');
    const text = cssVar('--text', '#1d1d1f');

    updateThemeIcon();

    if (window.Chart) {
        Chart.defaults.font.family = CHART_FONT;
        Chart.defaults.font.size = 12;
        Chart.defaults.color = tick;
    }

    const tickScale = {
        color: tick,
        font: { size: 11, family: CHART_FONT },
        maxRotation: 0
    };
    const yScale = {
        beginAtZero: true,
        grace: '6%',
        border: { display: false },
        grid: { color: grid, drawTicks: false },
        ticks: {
            color: tick,
            padding: 10,
            maxTicksLimit: 5,
            font: { size: 11, family: CHART_FONT },
            callback: euroAxis
        }
    };

    // --- 1. Andamento mensile (area chart) ---
    const ctxM = document.getElementById('monthlyChart').getContext('2d');
    const mData = MENSILITA.map(m => {
        const a = getAmount(state.salaries[state.view.year]?.[m.id]);
        return a !== null ? a : null;
    });
    const hM = ctxM.canvas.clientHeight || 320;
    const gradM = ctxM.createLinearGradient(0, 0, 0, hM);
    gradM.addColorStop(0, withAlpha(primary, 0.30));
    gradM.addColorStop(0.55, withAlpha(primary, 0.10));
    gradM.addColorStop(1, withAlpha(primary, 0.0));

    // Asse Y "zoommato" sui valori reali (stile Apple Stocks)
    const yScaleMonthly = { ...yScale, beginAtZero: false };
    const mValues = mData.filter(v => typeof v === 'number');
    if (mValues.length) {
        const mn = Math.min(...mValues);
        const mx = Math.max(...mValues);
        const pad = Math.max((mx - mn) * 0.30, mx * 0.05, 50);
        yScaleMonthly.min = Math.max(0, Math.floor((mn - pad) / 100) * 100);
        yScaleMonthly.max = Math.ceil((mx + pad) / 100) * 100;
    }

    if (mChart) mChart.destroy();
    mChart = new Chart(ctxM, {
        type: 'line',
        data: {
            labels: MENSILITA.map(m => m.name),
            datasets: [{
                label: 'Stipendio',
                data: mData,
                borderColor: primary,
                borderWidth: 2.5,
                borderCapStyle: 'round',
                borderJoinStyle: 'round',
                backgroundColor: gradM,
                fill: true,
                tension: 0.4,
                spanGaps: false,
                pointRadius: 0,
                pointHoverRadius: 5,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: primary,
                pointHoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            layout: { padding: { top: 8, right: 6, bottom: 0, left: 0 } },
            animation: { duration: 650, easing: 'easeOutQuart' },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: { ...tickScale, padding: 8, autoSkip: true, maxTicksLimit: isSmallScreen() ? 7 : 14 } },
                y: yScaleMonthly
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...appleTooltip(tooltipBg),
                    callbacks: {
                        label: c => c.parsed.y === null
                            ? 'Nessun dato'
                            : new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(c.parsed.y)
                    }
                }
            }
        }
    });

    // --- 2. Confronto storico totale ---
    const canvasY = document.getElementById('yearlyChart');
    const ctxY = canvasY.getContext('2d');
    let lastYearWithData = CONFIG.startYear;
    let firstYearWithData = null;
    Object.keys(state.salaries).forEach(yStr => {
        const hasData = Object.values(state.salaries[yStr] || {}).some(e => getAmount(e) !== null);
        if (!hasData) return;
        const y = parseInt(yStr);
        lastYearWithData = Math.max(lastYearWithData, y);
        firstYearWithData = firstYearWithData === null ? y : Math.min(firstYearWithData, y);
    });
    const maxYearToShow = Math.max(lastYearWithData, state.view.year, new Date().getFullYear());
    const startYearToShow = Math.max(CONFIG.startYear, Math.min(firstYearWithData ?? state.view.year, state.view.year, maxYearToShow));
    const years = [], totals = [];
    const currentViewYearTotal = Object.values(state.salaries[state.view.year] || {}).map(e => getAmount(e)).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
    for (let y = startYearToShow; y <= maxYearToShow; y++) {
        years.push(y);
        const yTot = Object.values(state.salaries[y] || {}).map(e => getAmount(e)).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
        totals.push(yTot);
    }
    const minBarWidth = 52;
    const scrollContainer = document.querySelector('.chart-wrapper-scrollable');
    const innerContainer = document.querySelector('.chart-scroll-inner');
    const totalWidth = Math.max(years.length * minBarWidth, scrollContainer ? scrollContainer.clientWidth : 800);
    if (innerContainer) innerContainer.style.width = `${totalWidth}px`;

    const hY = ctxY.canvas.clientHeight || 320;
    const gradSelected = ctxY.createLinearGradient(0, 0, 0, hY);
    gradSelected.addColorStop(0, primary);
    gradSelected.addColorStop(1, withAlpha(primary, 0.45));

    if (yChart) yChart.destroy();
    yChart = new Chart(ctxY, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Totale Annuo',
                data: totals,
                backgroundColor: years.map(y => y === state.view.year ? gradSelected : barMuted),
                hoverBackgroundColor: primary,
                borderRadius: 8,
                borderSkipped: false,
                maxBarThickness: 52,
                categoryPercentage: 0.62,
                barPercentage: 0.7
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 16, right: 8, bottom: 0, left: 0 } },
            animation: { duration: 650, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    ...appleTooltip(tooltipBg),
                    callbacks: {
                        label: ctx => `Totale: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y)}`,
                        afterLabel: ctx => {
                            if (parseInt(ctx.label) === state.view.year) return 'Anno selezionato';
                            const diff = ctx.parsed.y - currentViewYearTotal;
                            return `Vs ${state.view.year}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(diff)}`;
                        }
                    }
                }
            },
            scales: {
                x: { grid: { display: false }, border: { display: false }, ticks: tickScale },
                y: yScale
            }
        }
    });
    setTimeout(() => {
        const idx = years.indexOf(state.view.year);
        if (idx !== -1 && scrollContainer) scrollContainer.scrollLeft = (idx * minBarWidth) - (scrollContainer.clientWidth / 2) + (minBarWidth / 2);
    }, 100);

    // --- 3. Confronto diretto ---
    const ctxC = document.getElementById('comparisonChart');
    if (ctxC) {
        const y1 = parseInt(document.getElementById('cmpYear1').value) || state.view.year;
        const y2 = parseInt(document.getElementById('cmpYear2').value) || (state.view.year - 1);
        const d1 = MENSILITA.map(m => getAmount(state.salaries[y1]?.[m.id]) || 0);
        const d2 = MENSILITA.map(m => getAmount(state.salaries[y2]?.[m.id]) || 0);
        const monthLabels = MENSILITA.map(m => m.name);
        if (cChart) cChart.destroy();
        cChart = new Chart(ctxC.getContext('2d'), {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: `${y1}`,
                        data: d1,
                        backgroundColor: primary,
                        hoverBackgroundColor: primary,
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 22,
                        barPercentage: 0.6,
                        categoryPercentage: 0.72
                    },
                    {
                        label: `${y2}`,
                        data: d2,
                        backgroundColor: chart2,
                        hoverBackgroundColor: chart2,
                        borderRadius: 6,
                        borderSkipped: false,
                        maxBarThickness: 22,
                        barPercentage: 0.6,
                        categoryPercentage: 0.72
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                animation: { duration: 650, easing: 'easeOutQuart' },
                layout: { padding: { top: 8, right: 6, bottom: 0, left: 0 } },
                scales: {
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: { ...tickScale, autoSkip: isSmallScreen(), maxTicksLimit: isSmallScreen() ? 7 : 14, font: { size: 10, family: CHART_FONT } }
                    },
                    y: yScale
                },
                plugins: {
                    legend: {
                        position: 'top',
                        align: 'end',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            boxWidth: 8,
                            boxHeight: 8,
                            padding: 16,
                            color: text,
                            font: { size: 12, family: CHART_FONT }
                        }
                    },
                    tooltip: {
                        ...appleTooltip(tooltipBg),
                        callbacks: {
                            label: ctx => {
                                let l = (ctx.dataset.label || '') + ': ';
                                if (ctx.parsed.y !== null) l += new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y);
                                return l;
                            },
                            afterBody: items => {
                                if (!items || !items.length) return '';
                                const v1 = items[0].raw || 0;
                                const v2 = items[1] ? items[1].raw : 0;
                                return `\nDifferenza (${y1} - ${y2}):\n` + new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(v1 - v2);
                            }
                        }
                    }
                }
            }
        });
    }
}

// ========================================
// EVENTI
// ========================================
function setupEventListeners() {
    document.getElementById('btnSave').onclick = () => {
        const amountStr = document.getElementById('salaryInput').value;
        const note = (document.getElementById('noteInput')?.value || '').trim();
        if (!state.salaries[state.view.year]) state.salaries[state.view.year] = {};
        if (amountStr === '' || amountStr === null) {
            delete state.salaries[state.view.year][state.view.monthId];
        } else {
            state.salaries[state.view.year][state.view.monthId] = {
                amount: parseFloat(amountStr),
                note: note
            };
        }
        saveData();
        updateUI(false);
        showToast('Dati salvati!');
    };

    const delBtn = document.getElementById('btnDeleteMonth');
    if (delBtn) {
        delBtn.onclick = () => {
            if (state.salaries[state.view.year]) delete state.salaries[state.view.year][state.view.monthId];
            const noteInput = document.getElementById('noteInput');
            if (noteInput) noteInput.value = '';
            saveData();
            updateUI(false);
            showToast('Mese cancellato!');
        };
    }

    document.getElementById('yearPicker').onchange = (e) => { state.view.year = parseInt(e.target.value); updateUI(true); };
    document.getElementById('prevYear').onclick = () => { if (state.view.year > CONFIG.startYear) { state.view.year--; updateUI(true); } };
    document.getElementById('nextYear').onclick = () => { if (state.view.year < CONFIG.endYear) { state.view.year++; updateUI(true); } };
    document.getElementById('cmpYear1').onchange = () => updateCharts();
    document.getElementById('cmpYear2').onchange = () => updateCharts();
    document.getElementById('btnPrevMonth').onclick = () => moveMonth(-1);
    document.getElementById('btnNextMonth').onclick = () => moveMonth(1);

    document.getElementById('themeToggle').onclick = () => {
        const isDark = document.body.hasAttribute('data-theme');
        if (isDark) { document.body.removeAttribute('data-theme'); state.theme = 'light'; }
        else { document.body.setAttribute('data-theme', 'dark'); state.theme = 'dark'; }
        saveData();
        updateCharts();
    };

    document.getElementById('exportBtn').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const dl = document.createElement('a');
        dl.setAttribute("href", dataStr);
        dl.setAttribute("download", "salary_backup.json");
        document.body.appendChild(dl);
        dl.click();
        dl.remove();
    };

    document.getElementById('importFile').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const imp = JSON.parse(event.target.result);
                if (!imp.salaries) throw new Error('Format');
                state = imp;
                migrateSalaries();
                saveData();
                updateUI(true);
                if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
                else document.body.removeAttribute('data-theme');
                showToast('Dati importati!');
            } catch (err) { showToast('File non valido!'); }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
}

function moveMonth(dir) {
    const idx = MENSILITA.findIndex(m => m.id === state.view.monthId);
    let newIdx = idx + dir;
    if (newIdx < 0) { newIdx = MENSILITA.length - 1; state.view.year--; }
    else if (newIdx >= MENSILITA.length) { newIdx = 0; state.view.year++; }
    if (state.view.year < CONFIG.startYear) state.view.year = CONFIG.startYear;
    if (state.view.year > CONFIG.endYear) state.view.year = CONFIG.endYear;
    state.view.monthId = MENSILITA[newIdx].id;
    updateUI(true);
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}