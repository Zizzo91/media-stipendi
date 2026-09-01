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
        auth: { persistSession: true, autoRefreshToken: true, flowType: "pkce" }
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
            <div style="font-size:2.5rem;margin-bottom:.5rem;">🔒</div>
            <h2 id="loginTitle" style="font-size:1.3rem;font-weight:800;color:var(--text);margin-bottom:.25rem;">Accesso protetto</h2>
            <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1.25rem;">Inserisci il PIN a 6 cifre</p>
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
    await loadData();
    updateUI(true);
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
    btn.innerHTML = '🚪';
    btn.style.display = 'none';
    btn.onclick = logout;
    container.appendChild(btn);
}

function injectEnhancementStyles() {
    if (document.getElementById('enhancements-css')) return;
    const css = `
      .sync-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .6rem;border:1px solid var(--border);border-radius:999px;font-size:.85rem;cursor:default}
      .sync-dot{width:.6rem;height:.6rem;border-radius:50%;flex-shrink:0}
      .sync-local .sync-dot{background:#adb5bd}
      .sync-ready .sync-dot{background:var(--primary)}
      .sync-syncing .sync-dot{background:var(--accent);animation:pulse 1s infinite}
      .sync-synced .sync-dot{background:var(--success)}
      .sync-error .sync-dot{background:var(--danger)}
      @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      .note-wrap{margin-top:1rem;text-align:left}
      #noteInput{
        width:100%;min-height:72px;resize:vertical;
        border:1px solid var(--border);border-radius:8px;padding:.75rem;
        background:var(--bg);color:var(--text);font-family:inherit;
        font-size:.95rem;line-height:1.5;transition:border-color .3s,box-shadow .3s;
      }
      #noteInput:focus{outline:none;border-color:var(--primary);box-shadow:0 0 0 3px var(--primary-light)}
      #noteInput::placeholder{color:var(--text-muted);font-style:italic;opacity:.8}
      .btn-danger{background:var(--danger);color:#fff;flex-grow:1}
      .btn-secondary{background:var(--border);color:var(--text);flex-grow:1}
      .var-badge{display:inline-block;padding:.15rem .45rem;border-radius:999px;font-weight:700;font-size:.85rem;border:1px solid var(--border)}
      .var-pos{color:var(--success)}
      .var-neg{color:var(--danger)}
      .var-neu{color:var(--text-muted)}
      .kpi-icon{font-size:1.2rem;color:var(--text-muted);margin-bottom:.35rem}
      .toast-sync{position:fixed;bottom:80px;left:50%;transform:translateX(-50%) translateY(20px);background:var(--card);border:1px solid var(--border);color:var(--text);padding:.6rem 1.2rem;border-radius:999px;font-size:.85rem;opacity:0;transition:opacity .3s,transform .3s;pointer-events:none;z-index:9999;white-space:nowrap}
      .toast-sync.show{opacity:1;transform:translateX(-50%) translateY(0)}
      @media(max-width:480px){.form-actions{flex-direction:column}}
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
              <label for="noteInput" style="display:block;margin-bottom:.5rem;color:var(--text-muted);font-weight:600;font-size:.85rem;">
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
                        .schema('media_stipendi')
                        .from('state')
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
            .schema('media_stipendi')
            .from('state')
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

    document.getElementById('kpiTotal').textContent = total.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    document.getElementById('kpiAvg').textContent = avg.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    document.getElementById('kpiMax').textContent = values.length ? Math.max(...values).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '€ 0,00';
    const kpiForecastEl = document.getElementById('kpiForecast');
    if (kpiForecastEl) {
        kpiForecastEl.textContent = values.length > 0
            ? forecast.toLocaleString('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
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
          <td>${amount !== null ? amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '-'}${noteIcon}</td>
          <td>${varHtml}</td>
          <td>${amount !== null ? '<i class="fa-solid fa-check" style="color:var(--success)"></i>' : ''}</td>
        `;
        tbody.appendChild(tr);
    });
}

function updateCharts() {
    const styles = getComputedStyle(document.body);
    const accentColor = styles.getPropertyValue('--primary').trim();
    const mutedColor = styles.getPropertyValue('--text-muted').trim() || '#6c757d';

    // --- 1. Monthly Chart ---
    const ctxM = document.getElementById('monthlyChart').getContext('2d');
    const mData = MENSILITA.map(m => {
        const a = getAmount(state.salaries[state.view.year]?.[m.id]);
        return a !== null ? a : null;
    });
    if (mChart) mChart.destroy();
    mChart = new Chart(ctxM, {
        type: 'line',
        data: {
            labels: MENSILITA.map(m => m.name),
            datasets: [{ label: 'Stipendio', data: mData, borderColor: accentColor, backgroundColor: accentColor + '22', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false, interaction: { intersect: false, mode: 'index' }, spanGaps: false, scales: { y: { beginAtZero: true } } }
    });

    // --- 2. Yearly Chart ---
    const canvasY = document.getElementById('yearlyChart');
    const ctxY = canvasY.getContext('2d');
    let lastYearWithData = CONFIG.startYear;
    Object.keys(state.salaries).forEach(y => {
        if (Object.keys(state.salaries[y]).length > 0) lastYearWithData = Math.max(lastYearWithData, parseInt(y));
    });
    const maxYearToShow = Math.max(lastYearWithData, state.view.year, new Date().getFullYear());
    const years = [], totals = [];
    const currentViewYearTotal = Object.values(state.salaries[state.view.year] || {}).map(e => getAmount(e)).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
    for (let y = CONFIG.startYear; y <= maxYearToShow; y++) {
        years.push(y);
        const yTot = Object.values(state.salaries[y] || {}).map(e => getAmount(e)).filter(v => typeof v === 'number').reduce((a, b) => a + b, 0);
        totals.push(yTot);
    }
    const minBarWidth = 50;
    const scrollContainer = document.querySelector('.chart-wrapper-scrollable');
    const innerContainer = document.querySelector('.chart-scroll-inner');
    const totalWidth = Math.max(years.length * minBarWidth, scrollContainer ? scrollContainer.clientWidth : 800);
    if (innerContainer) innerContainer.style.width = `${totalWidth}px`;
    if (yChart) yChart.destroy();
    yChart = new Chart(ctxY, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{ label: 'Totale Annuo', data: totals, backgroundColor: years.map(y => y === state.view.year ? '#ff9f1c' : accentColor), borderRadius: 4 }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            layout: { padding: { top: 20, bottom: 0, left: 10, right: 10 } },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => `Totale: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y)}`,
                        afterLabel: ctx => {
                            if (parseInt(ctx.label) === state.view.year) return 'Anno Selezionato';
                            const diff = ctx.parsed.y - currentViewYearTotal;
                            return `Vs ${state.view.year}: ${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(diff)}`;
                        }
                    }
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
    setTimeout(() => {
        const idx = years.indexOf(state.view.year);
        if (idx !== -1 && scrollContainer) scrollContainer.scrollLeft = (idx * minBarWidth) - (scrollContainer.clientWidth / 2) + (minBarWidth / 2);
    }, 100);

    // --- 3. Comparison Chart ---
    const ctxC = document.getElementById('comparisonChart');
    if (ctxC) {
        const y1 = parseInt(document.getElementById('cmpYear1').value) || state.view.year;
        const y2 = parseInt(document.getElementById('cmpYear2').value) || (state.view.year - 1);
        const d1 = MENSILITA.map(m => getAmount(state.salaries[y1]?.[m.id]) || 0);
        const d2 = MENSILITA.map(m => getAmount(state.salaries[y2]?.[m.id]) || 0);
        const showDelta = !isSmallScreen();
        const labelsWithDelta = MENSILITA.map((m, i) => {
            if (!showDelta || (d1[i] === 0 && d2[i] === 0)) return m.name;
            const diff = d1[i] - d2[i];
            const sign = diff > 0 ? '+' : '';
            const diffFmt = Math.abs(diff) >= 1000 ? (diff/1000).toFixed(1)+'k' : Math.round(diff);
            return [m.name, `(${sign}${diffFmt})`];
        });
        if (cChart) cChart.destroy();
        cChart = new Chart(ctxC.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labelsWithDelta,
                datasets: [
                    { label: `${y1}`, data: d1, backgroundColor: accentColor, borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 },
                    { label: `${y2}`, data: d2, backgroundColor: mutedColor, borderRadius: 4, barPercentage: 0.6, categoryPercentage: 0.8 }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: { ticks: { font: { size: 10 }, autoSkip: false, maxRotation: 0 } },
                    y: { beginAtZero: true, ticks: { callback: v => v >= 1000 ? '€ ' + v/1000 + 'k' : '€ ' + v } }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                let l = (ctx.dataset.label || '') + ': ';
                                if (ctx.parsed.y !== null) l += new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y);
                                return l;
                            },
                            afterBody: items => {
                                const v1 = items[0].raw;
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