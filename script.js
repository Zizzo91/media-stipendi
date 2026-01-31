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

let mChart = null;
let yChart = null;

// ========================================
// AVVIO APP
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    checkMagicLink();
    await loadData();
    initYearPicker();
    setInitialDate();
    setupEventListeners();
    updateUI();
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
// CARICAMENTO DATI (CLOUD + FALLBACK LOCALE)
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
    } catch (e) {
        console.warn("GitHub offline, uso dati locali:", e);
    }

    const saved = localStorage.getItem(CONFIG.storageKey);
    if (saved) {
        try {
            state = JSON.parse(saved);
            if (!state.view) state.view = { year: 2026, monthId: '01' };
            if (!state.salaries) state.salaries = {};
        } catch (e) {
            console.error("Errore caricamento dati", e);
        }
    }

    if (state.theme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
}

// ========================================
// SALVATAGGIO DATI (LOCALE + CLOUD)
// ========================================
function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
    syncToGitHub();
}

async function syncToGitHub() {
    const token = localStorage.getItem("gh_token");
    
    if (!token) {
        console.log("Nessun token, salvataggio solo locale");
        return;
    }

    try {
        const apiUrl = `https://api.github.com/repos/${GH_CONFIG.user}/${GH_CONFIG.repo}/contents/${GH_CONFIG.file}`;
        
        let sha = null;
        try {
            const getResp = await fetch(apiUrl, {
                headers: { 
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json' 
                }
            });
            if (getResp.ok) sha = (await getResp.json()).sha;
        } catch (e) {}

        const contentBase64 = window.btoa(unescape(encodeURIComponent(JSON.stringify(state, null, 2))));

        const putResp = await fetch(apiUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: "Update " + new Date().toISOString().slice(0, 10),
                content: contentBase64,
                sha: sha
            })
        });

        if (!putResp.ok) throw new Error(putResp.statusText);
        console.log("✅ Salvato su GitHub");

    } catch (error) {
        console.error("Errore sincronizzazione GitHub:", error);
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

function initYearPicker() {
    const picker = document.getElementById('yearPicker');
    picker.innerHTML = '';
    for (let y = CONFIG.startYear; y <= CONFIG.endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + (y === new Date().getFullYear() ? ' (Corrente)' : '');
        picker.appendChild(opt);
    }
}

function updateUI() {
    renderMonthGrid();
    renderForm();
    renderKPIs();
    renderTable();
    updateCharts();
    document.getElementById('yearPicker').value = state.view.year;
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
        
        if (state.view.monthId === m.id) {
            div.classList.add('is-selected');
        }
        
        if (state.salaries[state.view.year] && state.salaries[state.view.year][m.id]) {
            div.classList.add('has-data');
        }
        
        if (state.view.year === now.getFullYear() && (now.getMonth() + 1).toString().padStart(2, '0') === m.id) {
            div.classList.add('is-current-glob');
        }
        
        div.textContent = m.name;
        div.onclick = () => {
            state.view.monthId = m.id;
            updateUI();
        };
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
    const ctxM = document.getElementById('monthlyChart').getContext('2d');
    const canvasY = document.getElementById('yearlyChart'); 
    const ctxY = canvasY.getContext('2d');
    const accentColor = getComputedStyle(document.body).getPropertyValue('--primary').trim();

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
            interaction: { intersect: false, mode: 'index' }
        }
    });

    const years = [];
    const totals = [];
    
    for (let y = CONFIG.startYear; y <= CONFIG.endYear; y++) {
        years.push(y);
        const yData = state.salaries[y] || {};
        const yTot = Object.values(yData).reduce((a, b) => a + parseFloat(b), 0);
        totals.push(yTot);
    }

    const minBarWidth = 40;
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
            layout: {
                padding: { top: 20, bottom: 0, left: 10, right: 10 }
            },
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
    
    setTimeout(() => {
        const currentYearIndex = years.indexOf(state.view.year);
        if (currentYearIndex !== -1 && scrollContainer) {
            const scrollPos = (currentYearIndex * minBarWidth) - (scrollContainer.clientWidth / 2) + (minBarWidth / 2);
            scrollContainer.scrollLeft = scrollPos;
        }
    }, 100);
}

// ========================================
// EVENTI
// ========================================
function setupEventListeners() {
    document.getElementById('btnSave').onclick = () => {
        const val = document.getElementById('salaryInput').value;
        
        if (!state.salaries[state.view.year]) state.salaries[state.view.year] = {};
        
        if (val === '' || val === null) {
            delete state.salaries[state.view.year][state.view.monthId];
        } else {
            state.salaries[state.view.year][state.view.monthId] = parseFloat(val);
        }
        saveData();
        updateUI();
        showToast('Dati salvati!');
    };

    document.getElementById('yearPicker').onchange = (e) => {
        state.view.year = parseInt(e.target.value);
        updateUI();
    };

    document.getElementById('prevYear').onclick = () => {
        if (state.view.year > CONFIG.startYear) {
            state.view.year--;
            updateUI();
        }
    };

    document.getElementById('nextYear').onclick = () => {
        if (state.view.year < CONFIG.endYear) {
            state.view.year++;
            updateUI();
        }
    };

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
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "salary_backup.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    document.getElementById('importFile').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedState = JSON.parse(event.target.result);
                if (!importedState.salaries) throw new Error("Formato non valido");
                
                state = importedState;
                saveData();
                updateUI();
                
                if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
                else document.body.removeAttribute('data-theme');
                
                showToast('Dati importati con successo!');
            } catch (error) {
                console.error("Errore importazione", error);
                showToast('Errore: File JSON non valido!');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    };
}

function moveMonth(dir) {
    const idx = MENSILITA.findIndex(m => m.id === state.view.monthId);
    let newIdx = idx + dir;
    
    if (newIdx < 0) {
        newIdx = MENSILITA.length - 1;
        state.view.year--;
    } else if (newIdx >= MENSILITA.length) {
        newIdx = 0;
        state.view.year++;
    }

    if (state.view.year < CONFIG.startYear) state.view.year = CONFIG.startYear;
    if (state.view.year > CONFIG.endYear) state.view.year = CONFIG.endYear;

    state.view.monthId = MENSILITA[newIdx].id;
    updateUI();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => {
        t.classList.remove('show');
    }, 3000);
}
