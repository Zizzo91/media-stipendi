const CONFIG = {
    startYear: 2015,
    endYear: 2060,
    storageKey: 'salary_data_v2'
};

const MENSILITA = [
    { id: "01", name: "Gen", full: "Gennaio" },
    { id: "02", name: "Feb", full: "Febbraio" },
    { id: "03", name: "Mar", full: "Marzo" },
    { id: "04", name: "Apr", full: "Aprile" },
    { id: "05", name: "Mag", full: "Maggio" },
    { id: "06", name: "Giu", full: "Giugno" },
    { id: "14", name: "14ª", full: "Quattordicesima", extra: true },
    { id: "07", name: "Lug", full: "Luglio" },
    { id: "08", name: "Ago", full: "Agosto" },
    { id: "09", name: "Set", full: "Settembre" },
    { id: "10", name: "Ott", full: "Ottobre" },
    { id: "11", name: "Nov", full: "Novembre" },
    { id: "12", name: "Dic", full: "Dicembre" },
    { id: "13", name: "13ª", full: "Tredicesima", extra: true }
];

let state = {
    view: { year: 2026, monthId: "01" },
    salaries: {},
    theme: 'light'
};

let mChart = null;
let yChart = null;

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    initYearPicker();
    setInitialDate();
    setupEventListeners();
    updateUI();
});

function loadData() {
    const saved = localStorage.getItem(CONFIG.storageKey);
    if (saved) {
        state = JSON.parse(saved);
        if (state.theme === 'dark') document.body.setAttribute('data-theme', 'dark');
    }
}

function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
}

function setInitialDate() {
    const now = new Date();
    state.view.year = now.getFullYear();
    state.view.monthId = (now.getMonth() + 1).toString().padStart(2, '0');
}

function initYearPicker() {
    const picker = document.getElementById('yearPicker');
    for (let y = CONFIG.startYear; y <= CONFIG.endYear; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y + (y === new Date().getFullYear() ? " (Corrente)" : "");
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

function renderMonthGrid() {
    const grid = document.getElementById('monthGrid');
    const now = new Date();
    grid.innerHTML = '';
    MENSILITA.forEach(m => {
        const div = document.createElement('div');
        div.className = `month-box ${m.extra ? 'extra' : ''}`;
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
    document.getElementById('salaryInput').value = state.salaries[state.view.year]?.[state.view.monthId] || '';
}

function renderKPIs() {
    const yearData = state.salaries[state.view.year] || {};
    const values = Object.values(yearData).map(v => parseFloat(v));
    const total = values.reduce((a, b) => a + b, 0);
    const avg = total / 12;
    document.getElementById('kpiTotal').textContent = `€ ${total.toLocaleString('it-IT')}`;
    document.getElementById('kpiAvg').textContent = `€ ${avg.toLocaleString('it-IT', {maximumFractionDigits: 0})}`;
    document.getElementById('kpiMax').textContent = `€ ${values.length ? Math.max(...values).toLocaleString('it-IT') : 0}`;
    document.getElementById('kpiCount').textContent = `${values.length} / 14`;
}

function renderTable() {
    const tbody = document.querySelector('#salaryTable tbody');
    tbody.innerHTML = '';
    MENSILITA.forEach(m => {
        const val = state.salaries[state.view.year]?.[m.id];
        tbody.innerHTML += `<tr><td>${m.full}</td><td>${val ? '€ ' + parseFloat(val).toLocaleString('it-IT') : '-'}</td><td>${val ? '✅' : '❌'}</td></tr>`;
    });
}

function updateCharts() {
    const ctxM = document.getElementById('monthlyChart').getContext('2d');
    const ctxY = document.getElementById('yearlyChart').getContext('2d');
    const accentColor = getComputedStyle(document.body).getPropertyValue('--primary').trim();

    // Dati Mensili
    const mData = MENSILITA.map(m => state.salaries[state.view.year]?.[m.id] || 0);
    if (mChart) mChart.destroy();
    mChart = new Chart(ctxM, {
        type: 'line',
        data: {
            labels: MENSILITA.map(m => m.name),
            datasets: [{ label: 'Stipendio €', data: mData, borderColor: accentColor, backgroundColor: accentColor + '22', fill: true, tension: 0.4 }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });

    // Dati Annuali (Timeline 10 anni)
    const years = []; const totals = [];
    for(let y = state.view.year - 4; y <= state.view.year + 5; y++) {
        if (y < CONFIG.startYear || y > CONFIG.endYear) continue;
        years.push(y);
        totals.push(Object.values(state.salaries[y] || {}).reduce((a,b) => a + parseFloat(b), 0));
    }
    if (yChart) yChart.destroy();
    yChart = new Chart(ctxY, {
        type: 'bar',
        data: {
            labels: years,
            datasets: [{ label: 'Totale Annuo €', data: totals, backgroundColor: years.map(y => y == state.view.year ? '#ff9f1c' : accentColor) }]
        },
        options: { responsive: true, maintainAspectRatio: false }
    });
}

function setupEventListeners() {
    document.getElementById('btnSave').onclick = () => {
        const val = document.getElementById('salaryInput').value;
        if (!state.salaries[state.view.year]) state.salaries[state.view.year] = {};
        if (val === '' || val < 0) delete state.salaries[state.view.year][state.view.monthId];
        else state.salaries[state.view.year][state.view.monthId] = parseFloat(val);
        saveData(); updateUI(); showToast("Dati salvati!");
    };

    document.getElementById('yearPicker').onchange = (e) => { state.view.year = parseInt(e.target.value); updateUI(); };
    document.getElementById('prevYear').onclick = () => { state.view.year--; updateUI(); };
    document.getElementById('nextYear').onclick = () => { state.view.year++; updateUI(); };
    
    document.getElementById('btnPrevMonth').onclick = () => moveMonth(-1);
    document.getElementById('btnNextMonth').onclick = () => moveMonth(1);

    document.getElementById('themeToggle').onclick = () => {
        const isDark = document.body.hasAttribute('data-theme');
        isDark ? document.body.removeAttribute('data-theme') : document.body.setAttribute('data-theme', 'dark');
        state.theme = isDark ? 'light' : 'dark';
        saveData(); updateCharts();
    };

    document.getElementById('exportBtn').onclick = () => {
        const blob = new Blob([JSON.stringify(state)], {type: 'application/json'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'salary_backup.json';
        a.click();
    };
}

function moveMonth(dir) {
    const idx = MENSILITA.findIndex(m => m.id === state.view.monthId);
    let newIdx = idx + dir;
    if (newIdx < 0) { newIdx = MENSILITA.length - 1; state.view.year--; }
    else if (newIdx >= MENSILITA.length) { newIdx = 0; state.view.year++; }
    state.view.monthId = MENSILITA[newIdx].id;
    updateUI();
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}