// ========================================
// CONFIGURAZIONE
// ========================================
const CONFIG = {
    startYear: 2015,
    endYear: 2060,
    storageKey: 'salary_data_v2'
};

const GH_CONFIG = {
    user: "Zizzo91",
    repo: "media-stipendi",
    file: "salary_backup.json",
    branch: "main"
};

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

let mChart = null; // Grafico Mensile
let cChart = null; // Grafico Confronto
let yChart = null; // Grafico Annuale

// ========================================
// AVVIO APP
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    checkMagicLink();
    await loadData();
    initYearSelectors();
    setInitialDate();

    enhanceUI();
    setupEventListeners();
    setupCurrencyFormatter();

    updateUI(true);
});

// ========================================
// GESTIONE TOKEN E UI INJECTED
// ========================================
function checkMagicLink() {
    const urlParams = new URLSearchParams(window.location.search);
    const magicToken = urlParams.get('token');

    if (magicToken) {
        localStorage.setItem("gh_token", magicToken);
        const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({path: newUrl}, '', newUrl);
        showToast("✅ Dispositivo abilitato!");
    }
}

function getHasToken() {
    return !!localStorage.getItem("gh_token");
}

function enhanceUI() {
    injectEnhancementStyles();
    injectSyncBadge();
    injectNoteAndDeleteControls();
    injectTableVariationColumn();
    injectKpiIcons();
    setSyncStatus(getHasToken() ? 'ready' : 'local');
}

function injectEnhancementStyles() {
    if (document.getElementById('enhancements-css')) return;
  
    const css = `
      .sync-badge{display:inline-flex;align-items:center;gap:.5rem;padding:.35rem .6rem;border:1px solid var(--border);border-radius:999px;font-size:.85rem}
      .sync-dot{width:.6rem;height:.6rem;border-radius:50%}
      .sync-local .sync-dot{background:#adb5bd}
      .sync-ready .sync-dot{background:var(--primary)}
      .sync-syncing .sync-dot{background:var(--accent)}
      .sync-synced .sync-dot{background:var(--success)}
      .sync-error .sync-dot{background:var(--danger)}
      .note-wrap{margin-top:1rem;text-align:left}
      #noteInput{
        width:100%;
        min-height:72px;
        resize:vertical;
        border:1px solid var(--border);
        border-radius:8px;
        padding:.75rem;
        background:var(--bg);
        color:var(--text);
        font-family: inherit;
        font-size: 0.95rem;
        line-height: 1.5;
        transition: border-color 0.3s, box-shadow 0.3s;
      }
      #noteInput:focus {
        outline: none;
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-light);
      }
      #noteInput::placeholder {
        color: var(--text-muted);
        font-style: italic;
        opacity: 0.8;
      }
      .btn-danger{background:var(--danger);color:#fff;flex-grow:1}
      .btn-secondary{background:var(--border);color:var(--text);flex-grow:1}
      .var-badge{display:inline-block;padding:.15rem .45rem;border-radius:999px;font-weight:700;font-size:.85rem;border:1px solid var(--border)}
      .var-pos{color:var(--success)}
      .var-neg{color:var(--danger)}
      .var-neu{color:var(--text-muted)}
      .kpi-icon{font-size:1.2rem;color:var(--text-muted);margin-bottom:.35rem}
      @media (max-width: 480px){
        .form-actions{flex-direction:column}
      }
    `;
    const style = document.createElement('style');
    style.id = 'enhancements-css';
    style.textContent = css;
    document.head.appendChild(style);
}

function injectSyncBadge() {
    if (document.getElementById('syncBadge')) return;
  
    const container = document.querySelector('.navbar .year-selector-container');
    if (!container) return;
  
    const badge = document.createElement('div');
    badge.id = 'syncBadge';
    badge.className = 'sync-badge sync-local';
    badge.title = 'Stato sincronizzazione';
  
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
  
    badge.classList.remove('sync-local', 'sync-ready', 'sync-syncing', 'sync-synced', 'sync-error');
  
    if (status === 'local') {
      badge.classList.add('sync-local');
      text.textContent = 'Locale';
    } else if (status === 'ready') {
      badge.classList.add('sync-ready');
      text.textContent = 'Pronto';
    } else if (status === 'syncing') {
      badge.classList.add('sync-syncing');
      text.textContent = 'Sync…';
    } else if (status === 'synced') {
      badge.classList.add('sync-synced');
      text.textContent = extraText ? `Sync OK (${extraText})` : 'Sync OK';
    } else if (status === 'error') {
      badge.classList.add('sync-error');
      text.textContent = extraText ? `Errore (${extraText})` : 'Errore';
    }
}

function injectNoteAndDeleteControls() {
    // textarea note
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
  
    // bottone cestino
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
  
    // Aggiunto fa-wand-magic-sparkles per la Proiezione Annua
    const icons = ['fa-calendar-check', 'fa-chart-line', 'fa-trophy', 'fa-wand-magic-sparkles', 'fa-list-check'];
    cards.forEach((card, idx) => {
      if (card.querySelector('.kpi-icon')) return;
      const div = document.createElement('div');
      div.className = 'kpi-icon';
      div.innerHTML = `<i class="fa-solid ${icons[idx] || 'fa-circle-info'}"></i>`;
      card.insertBefore(div, card.firstChild);
    });
}

function normalizeEntry(entry) {
    if (entry === null || entry === undefined) return null;
    if (typeof entry === 'number') return { amount: entry, note: '' };
    if (typeof entry === 'object') {
      const amount = (typeof entry.amount === 'number') ? entry.amount : (entry.amount ? parseFloat(entry.amount) : null);
      const note = (entry.note ? String(entry.note) : '');
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
// CARICAMENTO DATI
// ========================================
async function loadData() {
    let loadedFromGitHub = false;
    const token = localStorage.getItem("gh_token");

    try {
        if (token) {
            const apiUrl = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}`;
            const apiResp = await fetch(apiUrl, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3.raw'
                }
            });
            if (apiResp.ok) {
                state = await apiResp.json();
                localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
                console.log("✅ Dati caricati da GitHub API (No Cache)");
                loadedFromGitHub = true;
            }
        }

        if (!loadedFromGitHub) {
            const cacheBuster = "?t=" + new Date().getTime();
            const url = `https://raw.githubusercontent.com/${GH_CONFIG.user}/${GH_CONFIG.repo}/${GH_CONFIG.branch}/${GH_CONFIG.file}${cacheBuster}`;
            const response = await fetch(url);
            if (response.ok) {
                state = await response.json();
                localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
                console.log("✅ Dati caricati da GitHub Raw");
                loadedFromGitHub = true;
            }
        }
    } catch (e) { 
        console.warn("GitHub offline o errore rete, uso dati locali:", e); 
    }

    if (!loadedFromGitHub) {
        const saved = localStorage.getItem(CONFIG.storageKey);
        if (saved) {
            try {
                state = JSON.parse(saved);
            } catch (e) {}
        }
    }

    if (!state.view) state.view = { year: 2026, monthId: '01' };
    if (!state.salaries) state.salaries = {};
    if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
}

// ========================================
// SALVATAGGIO DATI
// ========================================
function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    syncToGitHub();
}

async function syncToGitHub() {
    const token = localStorage.getItem("gh_token");
    if (!token) { setSyncStatus('local'); return; }

    setSyncStatus('syncing');

    try {
        const apiUrl = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}`;
        let sha = null;
        try {
            const getResp = await fetch(apiUrl, { headers: { 'Authorization': `token ${token}` } });
            if (getResp.ok) sha = (await getResp.json()).sha;
        } catch (e) {}

        const contentBase64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));
        await fetch(apiUrl, {
            method: 'PUT',
            headers: { 'Authorization': `token ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: "Update " + new Date().toISOString().slice(0, 10), content: contentBase64, sha: sha })
        });
        console.log("✅ Salvato su GitHub");
        setSyncStatus('synced', new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }));
    } catch (error) { 
        console.error("Errore Sync:", error);
        setSyncStatus('error'); 
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
    picker.innerHTML = '';
    
    const cmp1 = document.getElementById('cmpYear1');
    const cmp2 = document.getElementById('cmpYear2');
    cmp1.innerHTML = '';
    cmp2.innerHTML = '';

    for (let y = CONFIG.startYear; y <= CONFIG.endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + (y === new Date().getFullYear() ? ' (Corrente)' : '');
        picker.appendChild(opt);

        const opt1 = document.createElement('option');
        opt1.value = y;
        opt1.textContent = y;
        cmp1.appendChild(opt1);

        const opt2 = document.createElement('option');
        opt2.value = y;
        opt2.textContent = y;
        cmp2.appendChild(opt2);
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

    if (!state || !state.salaries || !state.view) {
        badge.style.display = 'none';
        return;
    }

    const currYear = state.view.year;
    const currYearData = state.salaries[currYear] || {};
    
    // Trova i mesi che hanno dati validi per l'anno attualmente visualizzato
    const filledMonths = MENSILITA.map(m => m.id).filter(mId => getAmount(currYearData[mId]) !== null);
    
    // Se non ci sono mesi compilati quest'anno, nascondi
    if (filledMonths.length === 0) {
        badge.style.display = 'none';
        return;
    }

    // Calcola il totale dei mesi compilati per l'anno attuale
    const currTotal = filledMonths.reduce((sum, mId) => sum + getAmount(currYearData[mId]), 0);

    let bestPastTotal = 0;
    let bestPastYear = null;

    Object.keys(state.salaries).forEach(yStr => {
        const y = parseInt(yStr);
        if (y >= currYear) return; // Paragona solo agli anni precedenti a quello selezionato
        
        const pastData = state.salaries[y] || {};
        
        let pastTotal = 0;
        let hasValidData = false;
        
        filledMonths.forEach(mId => {
            const amount = getAmount(pastData[mId]);
            if (amount !== null) {
                pastTotal += amount;
                hasValidData = true;
            }
        });

        // Contiamo questo anno passato solo se ha almeno un dato tra i mesi di interesse
        if (hasValidData && pastTotal > bestPastTotal) {
            bestPastTotal = pastTotal;
            bestPastYear = y;
        }
    });

    if (bestPastTotal <= 0) {
        badge.style.display = 'none';
        return;
    }

    const diff = currTotal - bestPastTotal;
    const pct = (diff / bestPastTotal) * 100;
    const isPos = diff > 0;
    const isNeu = diff === 0;

    let cls = 'ytd-badge ';
    let icon = '';
    let sign = '';

    const diffFormatted = new Intl.NumberFormat('it-IT', { 
        style: 'currency', 
        currency: 'EUR', 
        signDisplay: 'always' 
    }).format(diff);

    if (isPos) {
        cls += 'pos';
        icon = '<i class="fa-solid fa-arrow-trend-up"></i>';
        sign = '+';
    } else if (diff < 0) {
        cls += 'neg';
        icon = '<i class="fa-solid fa-arrow-trend-down"></i>';
    } else {
        cls += 'neu';
        icon = '<i class="fa-solid fa-minus"></i>';
    }

    badge.className = cls;
    
    if (isNeu) {
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

    displayInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/[^0-9.,]/g, '');
        value = value.replace(/\./g, ',');
        
        const parts = value.split(',');
        if (parts.length > 2) {
            value = parts[0] + ',' + parts.slice(1).join('');
        }
        
        if (value.includes(',')) {
            const dec = value.split(',')[1];
            if (dec.length > 2) {
                value = value.split(',')[0] + ',' + dec.substring(0, 2);
            }
        }

        let numForFormatting = value.replace(/,/g, '.');
        let parsed = parseFloat(numForFormatting);

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

    displayInput.addEventListener('focus', function() {
        this.select();
    });
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
    const values = Object.values(yearData)
      .map(e => getAmount(e))
      .filter(v => typeof v === 'number');
  
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? (total / 12) : 0;
    
    // --- Calcolo Proiezione Annua ---
    const avgPerPaycheck = values.length ? (total / values.length) : 0;
    let typicalMonths = 13; // Valore di default in Italia (12 mesi + 13esima)
    let maxPastMonths = 0;
    
    // Controlla il passato per capire se prendi 13 o 14 mensilità abitualmente
    Object.keys(state.salaries).forEach(y => {
        if (parseInt(y) < state.view.year) {
            const pastVals = Object.values(state.salaries[y]).map(e => getAmount(e)).filter(v => typeof v === 'number');
            if (pastVals.length > maxPastMonths) maxPastMonths = pastVals.length;
        }
    });
    // Limita tra 12 e 14 per stare su numeri realistici
    if (maxPastMonths >= 12 && maxPastMonths <= 14) typicalMonths = maxPastMonths;

    let forecast = total;
    if (values.length > 0 && values.length < typicalMonths) {
        // Aggiunge al totale accumulato finora la stima per i mesi mancanti
        forecast = total + (avgPerPaycheck * (typicalMonths - values.length));
    }
    // --------------------------------
  
    document.getElementById('kpiTotal').textContent =
      total.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  
    document.getElementById('kpiAvg').textContent =
      avg.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
  
    document.getElementById('kpiMax').textContent =
      values.length ? Math.max(...values).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '€ 0,00';

    // Nuovo KPI Proiezione
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
  
      const noteHtml = note
        ? `<div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 6px; font-style: italic; background: var(--bg); padding: 4px 8px; border-radius: 4px; border-left: 2px solid var(--primary);"><i class="fa-solid fa-note-sticky" style="margin-right:6px; color: var(--primary);"></i>${note}</div>`
        : '';
  
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${m.full}</td>
        <td>
            ${amount !== null ? amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '-'}
            ${noteHtml}
        </td>
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
    const successColor = styles.getPropertyValue('--success').trim();
    const dangerColor = '#ef233c'; // Rosso per delta negativi

    // --- 1. Monthly Chart ---
    const ctxM = document.getElementById('monthlyChart').getContext('2d');
    const mData = MENSILITA.map(m => {
        const a = getAmount(state.salaries[state.view.year]?.[m.id]);
        return a !== null ? a : null;
    });
    const mNotes = MENSILITA.map(m => getNote(state.salaries[state.view.year]?.[m.id]));
    
    if (mChart) mChart.destroy();
    mChart = new Chart(ctxM, {
        type: 'line',
        data: {
            labels: MENSILITA.map(m => m.name),
            datasets: [{
                label: 'Stipendio',
                data: mData,
                borderColor: accentColor,
                backgroundColor: accentColor + '22',
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            spanGaps: false,
            scales: { y: { beginAtZero: true } },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let val = context.parsed.y;
                            return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
                        },
                        afterLabel: function(context) {
                            const idx = context.dataIndex;
                            const note = mNotes[idx];
                            if (note) {
                                return `\nNota: ${note}`;
                            }
                            return null;
                        }
                    }
                }
            }
        }
    });

    // --- 2. Yearly Chart (Filtered & Delta in Tooltip) ---
    const canvasY = document.getElementById('yearlyChart'); 
    const ctxY = canvasY.getContext('2d');
    
    let lastYearWithData = CONFIG.startYear;
    Object.keys(state.salaries).forEach(y => {
        if (Object.keys(state.salaries[y]).length > 0) {
            lastYearWithData = Math.max(lastYearWithData, parseInt(y));
        }
    });
    const maxYearToShow = Math.max(lastYearWithData, state.view.year, new Date().getFullYear());

    const years = [];
    const totals = [];
    
    const currentViewYearTotal = Object.values(state.salaries[state.view.year] || {})
        .map(e => getAmount(e))
        .filter(v => typeof v === 'number')
        .reduce((a, b) => a + b, 0);

    for (let y = CONFIG.startYear; y <= maxYearToShow; y++) {
        years.push(y);
        const yTot = Object.values(state.salaries[y] || {})
            .map(e => getAmount(e))
            .filter(v => typeof v === 'number')
            .reduce((a, b) => a + b, 0);
        totals.push(yTot);
    }

    const minBarWidth = 50;
    const scrollContainer = document.querySelector('.chart-wrapper-scrollable');
    const innerContainer = document.querySelector('.chart-scroll-inner');
    const totalWidth = Math.max(years.length * minBarWidth, scrollContainer.clientWidth);
    innerContainer.style.width = `${totalWidth}px`;
    
    if (yChart) yChart.destroy();
    
    yChart = new Chart(ctxY, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{
                label: 'Totale Annuo',
                data: totals,
                backgroundColor: years.map(y => y === state.view.year ? '#ff9f1c' : accentColor),
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 20, bottom: 0, left: 10, right: 10 } },
            plugins: { 
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let val = context.parsed.y;
                            let label = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(val);
                            return `Totale: ${label}`;
                        },
                        afterLabel: function(context) {
                            const year = context.label;
                            if (parseInt(year) === state.view.year) return "Anno Selezionato";
                            
                            const diff = context.parsed.y - currentViewYearTotal;
                            const diffStr = new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: "always" }).format(diff);
                            return `Vs ${state.view.year}: ${diffStr}`;
                        }
                    }
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
    
    setTimeout(() => {
        const idx = years.indexOf(state.view.year);
        if (idx !== -1 && scrollContainer) {
            scrollContainer.scrollLeft = (idx * minBarWidth) - (scrollContainer.clientWidth / 2) + (minBarWidth / 2);
        }
    }, 100);

    // --- 3. Comparison Chart (Delta in X-Axis Labels) ---
    const ctxC = document.getElementById('comparisonChart');
    if (ctxC) {
        const y1 = parseInt(document.getElementById('cmpYear1').value) || state.view.year;
        const y2 = parseInt(document.getElementById('cmpYear2').value) || (state.view.year - 1);

        const d1 = MENSILITA.map(m => getAmount(state.salaries[y1]?.[m.id]) || 0);
        const d2 = MENSILITA.map(m => getAmount(state.salaries[y2]?.[m.id]) || 0);
        
        const showDeltaOnLabels = !isSmallScreen();
        
        const labelsWithDelta = MENSILITA.map((m, i) => {
            const v1 = d1[i];
            const v2 = d2[i];
            if (!showDeltaOnLabels) return m.name;
            if (v1 === 0 && v2 === 0) return m.name; 
            
            const diff = v1 - v2;
            const sign = diff > 0 ? '+' : '';
            const diffFmt = Math.abs(diff) >= 1000 
                ? (diff/1000).toFixed(1) + 'k' 
                : Math.round(diff);
            
            return [m.name, `(${sign}${diffFmt})`]; 
        });

        if (cChart) cChart.destroy();
        
        cChart = new Chart(ctxC.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labelsWithDelta,
                datasets: [
                    {
                        label: `${y1}`,
                        data: d1,
                        backgroundColor: accentColor,
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    },
                    {
                        label: `${y2}`,
                        data: d2,
                        backgroundColor: mutedColor,
                        borderRadius: 4,
                        barPercentage: 0.6,
                        categoryPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        ticks: {
                            font: { size: 10 },
                            autoSkip: false,
                            maxRotation: 0
                        }
                    },
                    y: { 
                        beginAtZero: true,
                        ticks: { callback: v => v >= 1000 ? '€ ' + v/1000 + 'k' : '€ ' + v }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                let l = ctx.dataset.label || '';
                                if (l) l += ': ';
                                if (ctx.parsed.y !== null) l += new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(ctx.parsed.y);
                                return l;
                            },
                            afterBody: (tooltipItems) => {
                                const v1 = tooltipItems[0].raw; 
                                const v2 = tooltipItems[1] ? tooltipItems[1].raw : 0; 
                                const diff = v1 - v2;
                                return `\nDifferenza (${y1} - ${y2}):\n` + new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', signDisplay: 'always' }).format(diff);
                            }
                        }
                    }
                }
            }
        });
    }
}

// ========================================
// EVENTI E SALVATAGGIO
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
            if (state.salaries[state.view.year]) {
                delete state.salaries[state.view.year][state.view.monthId];
            }
            const noteInput = document.getElementById('noteInput');
            if (noteInput) noteInput.value = '';

            saveData();
            updateUI(false);
            showToast('Mese cancellato!');
        };
    }

    document.getElementById('yearPicker').onchange = (e) => {
        state.view.year = parseInt(e.target.value);
        updateUI(true); 
    };

    document.getElementById('prevYear').onclick = () => {
        if (state.view.year > CONFIG.startYear) {
            state.view.year--;
            updateUI(true);
        }
    };
    document.getElementById('nextYear').onclick = () => {
        if (state.view.year < CONFIG.endYear) {
            state.view.year++;
            updateUI(true);
        }
    };

    document.getElementById('cmpYear1').onchange = () => updateCharts();
    document.getElementById('cmpYear2').onchange = () => updateCharts();

    document.getElementById('btnPrevMonth').onclick = () => moveMonth(-1);
    document.getElementById('btnNextMonth').onclick = () => moveMonth(1);

    document.getElementById('themeToggle').onclick = () => {
        const isDark = document.body.hasAttribute('data-theme');
        if (isDark) {
            document.body.removeAttribute('data-theme');
            state.theme = 'light';
        } else {
            document.body.setAttribute('data-theme', 'dark');
            state.theme = 'dark';
        }
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
                if (!imp.salaries) throw new Error("Format");
                state = imp;
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
