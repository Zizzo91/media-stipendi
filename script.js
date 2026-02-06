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
    setupEventListeners();
    updateUI(true);
});

// ========================================
// GESTIONE TOKEN (MAGIC LINK)
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

// ========================================
// CARICAMENTO DATI
// ========================================
async function loadData() {
    try {
        const cacheBuster = "?t=" + new Date().getTime();
        const url = `https://raw.githubusercontent.com/${GH_CONFIG.user}/${GH_CONFIG.repo}/${GH_CONFIG.branch}/${GH_CONFIG.file}${cacheBuster}`;
        const response = await fetch(url);
        if (response.ok) {
            state = await response.json();
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
            console.log("✅ Dati caricati da GitHub");
            return;
        }
    } catch (e) { console.warn("GitHub offline, uso dati locali:", e); }

    const saved = localStorage.getItem(CONFIG.storageKey);
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.view) state.view = { year: 2026, monthId: '01' };
            if (!state.salaries) state.salaries = {};
        } catch (e) {}
    }

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
    if (!token) return;

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
    } catch (error) { console.error("Errore Sync:", error); }
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
    
    document.getElementById('yearPicker').value = state.view.year;
    
    if (resetComparison) {
        document.getElementById('cmpYear1').value = state.view.year;
        document.getElementById('cmpYear2').value = state.view.year - 1;
    }

    updateCharts();
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
        if (state.salaries[state.view.year]?.[m.id]) div.classList.add('has-data');
        if (state.view.year === now.getFullYear() && (now.getMonth() + 1).toString().padStart(2, '0') === m.id) div.classList.add('is-current-glob');
        
        div.textContent = m.name;
        div.onclick = () => { state.view.monthId = m.id; updateUI(); };
        grid.appendChild(div);
    });
}

function renderForm() {
    const mInfo = MENSILITA.find(m => m.id === state.view.monthId);
    document.getElementById('formTitle').textContent = `${mInfo.full} ${state.view.year}`;
    const val = state.salaries[state.view.year]?.[state.view.monthId];
    document.getElementById('salaryInput').value = val ? val : '';
}

function renderKPIs() {
    const yearData = state.salaries[state.view.year] || {};
    const values = Object.values(yearData).map(v => parseFloat(v));
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? (total / 12) : 0;
    
    document.getElementById('kpiTotal').textContent = total.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    document.getElementById('kpiAvg').textContent = avg.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
    document.getElementById('kpiMax').textContent = values.length ? Math.max(...values).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '€ 0,00';
    document.getElementById('kpiCount').textContent = `${values.length} / 14`;
}

function renderTable() {
    const tbody = document.querySelector('#salaryTable tbody');
    tbody.innerHTML = '';
    MENSILITA.forEach(m => {
        const val = state.salaries[state.view.year]?.[m.id];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${m.full}</td>
            <td>${val ? parseFloat(val).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' }) : '-'}</td>
            <td>${val ? '<i class="fa-solid fa-check" style="color:var(--success)"></i>' : ''}</td>
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
    const mData = MENSILITA.map(m => state.salaries[state.view.year]?.[m.id] || 0);
    
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
            scales: { y: { beginAtZero: true } }
        }
    });

    // --- 2. Yearly Chart (Filtered & Delta in Tooltip) ---
    const canvasY = document.getElementById('yearlyChart'); 
    const ctxY = canvasY.getContext('2d');
    
    // Trova l'ultimo anno che ha dati validi per tagliare il grafico
    let lastYearWithData = CONFIG.startYear;
    Object.keys(state.salaries).forEach(y => {
        if (Object.keys(state.salaries[y]).length > 0) {
            lastYearWithData = Math.max(lastYearWithData, parseInt(y));
        }
    });
    // Mostra almeno fino all'anno corrente selezionato o all'anno reale
    const maxYearToShow = Math.max(lastYearWithData, state.view.year, new Date().getFullYear());

    const years = [];
    const totals = [];
    
    // Calcola il totale dell'anno CORRENTE di visualizzazione (per il confronto)
    const currentViewYearTotal = Object.values(state.salaries[state.view.year] || {}).reduce((a, b) => a + parseFloat(b), 0);

    for (let y = CONFIG.startYear; y <= maxYearToShow; y++) {
        years.push(y);
        const yTot = Object.values(state.salaries[y] || {}).reduce((a, b) => a + parseFloat(b), 0);
        totals.push(yTot);
    }

    // Ridimensiona container
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
                            // Calcola differenza rispetto all'anno selezionato (state.view.year)
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
    
    // Scroll all'anno corrente
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

        const d1 = MENSILITA.map(m => state.salaries[y1]?.[m.id] || 0);
        const d2 = MENSILITA.map(m => state.salaries[y2]?.[m.id] || 0);
        
        // Calcola labels con delta
        const labelsWithDelta = MENSILITA.map((m, i) => {
            const v1 = d1[i];
            const v2 = d2[i];
            // Mostra differenza solo se entrambi hanno dati o se almeno uno ne ha
            if (v1 === 0 && v2 === 0) return m.name; 
            
            const diff = v1 - v2;
            const sign = diff > 0 ? '+' : '';
            // Formattazione compatta per l'asse X (es. +200)
            const diffFmt = Math.abs(diff) >= 1000 
                ? (diff/1000).toFixed(1) + 'k' 
                : Math.round(diff);
            
            return [m.name, `(${sign}${diffFmt})`]; // Array crea label su due righe
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
                                // Calcola il delta esatto nel tooltip per precisione
                                const v1 = tooltipItems[0].raw; // dataset 0 è sempre y1
                                const v2 = tooltipItems[1] ? tooltipItems[1].raw : 0; // dataset 1 è y2
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
// EVENTI
// ========================================
function setupEventListeners() {
    document.getElementById('btnSave').onclick = () => {
        const val = document.getElementById('salaryInput').value;
        if (!state.salaries[state.view.year]) state.salaries[state.view.year] = {};
        
        if (val === '' || val === null) delete state.salaries[state.view.year][state.view.monthId];
        else state.salaries[state.view.year][state.view.monthId] = parseFloat(val);
        
        saveData();
        updateUI(false); 
        showToast('Dati salvati!');
    };

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
