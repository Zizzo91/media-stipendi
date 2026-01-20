const CONFIG = {
    startYear: 2015,
    endYear: 2060,
    storageKey: 'salary_data_v2'
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
        try {
            state = JSON.parse(saved);
            // Gestione fallback se view non esiste nel salvataggio
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

function saveData() {
    localStorage.setItem(CONFIG.storageKey, JSON.stringify(state));
}

function setInitialDate() {
    // Se non abbiamo un anno salvato o vogliamo partire sempre da oggi (opzionale)
    // Qui manteniamo lo stato salvato se esiste, altrimenti usiamo la data corrente
    if (!localStorage.getItem(CONFIG.storageKey)) {
        const now = new Date();
        state.view.year = now.getFullYear();
        state.view.monthId = (now.getMonth() + 1).toString().padStart(2, '0');
    }
}

function initYearPicker() {
    const picker = document.getElementById('yearPicker');
    picker.innerHTML = ''; // Pulisce eventuali opzioni precedenti
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
    
    // Sincronizza il select dell'anno
    document.getElementById('yearPicker').value = state.view.year;
}

function renderMonthGrid() {
    const grid = document.getElementById('monthGrid');
    const now = new Date();
    grid.innerHTML = '';

    MENSILITA.forEach(m => {
        const div = document.createElement('div');
        div.className = 'month-box';
        if (m.extra) div.classList.add('extra');
        
        // Selezione corrente
        if (state.view.monthId === m.id) {
            div.classList.add('is-selected');
        }

        // Ha dati?
        if (state.salaries[state.view.year] && state.salaries[state.view.year][m.id]) {
            div.classList.add('has-data');
        }

        // È il mese reale corrente?
        if (state.view.year === now.getFullYear() && 
            (now.getMonth() + 1).toString().padStart(2, '0') === m.id) {
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
    const avg = values.length ? (total / 12) : 0; // Media spalmata sui 12 mesi standard, o values.length per media pura
    
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
    const ctxY = document.getElementById('yearlyChart').getContext('2d');
    
    const accentColor = getComputedStyle(document.body).getPropertyValue('--primary').trim();
    
    // --- Grafico Mensile ---
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
                backgroundColor: accentColor + '22', // trasparanza
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index',
            }
        }
    });

    // --- Grafico Annuale (ultimi 10 anni attorno al corrente) ---
    const years = [];
    const totals = [];
    
    for(let y = state.view.year - 4; y <= state.view.year + 5; y++) {
        if (y < CONFIG.startYear || y > CONFIG.endYear) continue;
        years.push(y);
        
        const yData = state.salaries[y] || {};
        const yTot = Object.values(yData).reduce((a,b) => a + parseFloat(b), 0);
        totals.push(yTot);
    }

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
            maintainAspectRatio: false
        }
    });
}

function setupEventListeners() {
    // --- Salvataggio Valore ---
    document.getElementById('btnSave').onclick = () => {
        const val = document.getElementById('salaryInput').value;
        
        if (!state.salaries[state.view.year]) {
            state.salaries[state.view.year] = {};
        }

        if (val === '' || val === null) {
            delete state.salaries[state.view.year][state.view.monthId];
        } else {
            state.salaries[state.view.year][state.view.monthId] = parseFloat(val);
        }

        saveData();
        updateUI();
        showToast('Dati salvati!');
    };

    // --- Navigazione Anno ---
    document.getElementById('yearPicker').onchange = (e) => {
        state.view.year = parseInt(e.target.value);
        updateUI();
    };
    document.getElementById('prevYear').onclick = () => {
        if(state.view.year > CONFIG.startYear) {
            state.view.year--;
            updateUI();
        }
    };
    document.getElementById('nextYear').onclick = () => {
        if(state.view.year < CONFIG.endYear) {
            state.view.year++;
            updateUI();
        }
    };

    // --- Navigazione Mese (Bottoni) ---
    document.getElementById('btnPrevMonth').onclick = () => moveMonth(-1);
    document.getElementById('btnNextMonth').onclick = () => moveMonth(1);

    // --- Tema ---
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
        updateCharts(); // per aggiornare i colori del grafico se necessario
    };

    // --- Export JSON ---
    document.getElementById('exportBtn').onclick = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "salary_backup.json");
        document.body.appendChild(downloadAnchorNode); // necessario per firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    };

    // --- Import JSON (AGGIUNTO) ---
    document.getElementById('importFile').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedState = JSON.parse(event.target.result);
                // Validazione minima di struttura (opzionale ma consigliata)
                if(!importedState.salaries) throw new Error("Formato non valido");

                state = importedState;
                saveData();
                updateUI();
                
                // Ripristina tema importato
                if (state.theme === 'dark') {
                    document.body.setAttribute('data-theme', 'dark');
                } else {
                    document.body.removeAttribute('data-theme');
                }
                
                showToast('Dati importati con successo!');
            } catch (error) {
                console.error('Errore importazione:', error);
                showToast('Errore: File JSON non valido!');
            }
        };
        reader.readAsText(file);
        
        // Reset dell'input per permettere di ricaricare lo stesso file se necessario
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

    // Check limiti anni
    if(state.view.year < CONFIG.startYear) state.view.year = CONFIG.startYear;
    if(state.view.year > CONFIG.endYear) state.view.year = CONFIG.endYear;

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
