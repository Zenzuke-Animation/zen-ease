const csInterface = new CSInterface();
const canvas = document.getElementById('curveCanvas');
const ctx = canvas.getContext('2d');
const bezierInput = document.getElementById('bezierInput');
const btnFlipCurve = document.getElementById('btnFlipCurve');
// Tab Switching and Navigation Elements
const tabBtnEditor = document.getElementById('tabBtnEditor');
const tabBtnLibrary = document.getElementById('tabBtnLibrary');
const editorView = document.getElementById('editorView');
const libraryView = document.getElementById('libraryView');
const btnOpenLibrary = document.getElementById('btnOpenLibrary');
const presetsList = document.getElementById('presetsList');
const presetSelectValue = document.getElementById('presetSelectValue');

function switchTab(tab) {
    if (tab === 'editor') {
        tabBtnEditor.classList.add('active');
        tabBtnLibrary.classList.remove('active');
        editorView.classList.add('active');
        libraryView.classList.remove('active');
        resizeCanvas();
    } else if (tab === 'library') {
        tabBtnLibrary.classList.add('active');
        tabBtnEditor.classList.remove('active');
        libraryView.classList.add('active');
        editorView.classList.remove('active');
    }
}

tabBtnEditor.addEventListener('click', () => switchTab('editor'));
tabBtnLibrary.addEventListener('click', () => switchTab('library'));
btnOpenLibrary.addEventListener('click', () => switchTab('library'));

const presetSelect = {
    _value: "",
    _changeListeners: [],
    
    get value() {
        return this._value;
    },
    
    set value(val) {
        this._value = val;
        
        // Update UI trigger text
        if (val === "" || !presets[val]) {
            presetSelectValue.textContent = "Select preset...";
        } else {
            presetSelectValue.textContent = val;
        }
        
        // Highlight active card in library list
        const cards = presetsList.querySelectorAll('.preset-card');
        cards.forEach(card => {
            const path = card.querySelector('path');
            if (card.getAttribute('data-name') === val) {
                card.classList.add('selected');
                if (path) path.setAttribute('stroke', '#00a8ff');
            } else {
                card.classList.remove('selected');
                if (path) path.setAttribute('stroke', '#ffffff');
            }
        });
        
        // Trigger listeners
        this._changeListeners.forEach(listener => listener());
    },
    
    addEventListener(event, listener) {
        if (event === 'change') {
            this._changeListeners.push(listener);
        }
    }
};

const btnSavePreset = document.getElementById('btnSavePreset');
const btnImportPresets = document.getElementById('btnImportPresets');
const btnExportPresets = document.getElementById('btnExportPresets');
const btnGet = document.getElementById('btnGet');
const btnApply = document.getElementById('btnApply');

const promptModal = document.getElementById('promptModal');
const presetNameInput = document.getElementById('presetNameInput');
const btnModalOk = document.getElementById('btnModalOk');
const btnModalCancel = document.getElementById('btnModalCancel');

const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const btnConfirmOk = document.getElementById('btnConfirmOk');
const btnConfirmCancel = document.getElementById('btnConfirmCancel');

function showAlert(msg) {
    confirmMessage.innerText = msg;
    btnConfirmOk.innerText = "OK";
    btnConfirmCancel.style.display = "none";
    confirmModal.style.display = 'flex';
    btnConfirmOk.focus();
}

const padding = 20;
let w, h;

function resizeCanvas() {
    const parentWidth = document.getElementById('app').clientWidth - 20; 
    const size = Math.max(150, Math.min(parentWidth, window.innerHeight - 220)); 
    
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    
    w = size - padding * 2;
    h = size - padding * 2;
    if (typeof draw === 'function') draw();
}

window.addEventListener('resize', resizeCanvas);

// Cubic bezier handles
let savedHandles;
try {
    savedHandles = JSON.parse(localStorage.getItem('zen_ease_last_curve'));
} catch(e) {}

let handles = [];
if (savedHandles && savedHandles.length === 2) {
    handles = savedHandles;
} else {
    // Default to cubic-in-out [0.65, 0.00, 0.35, 1.00]
    handles = [
        { x: 0.65, y: 0.00 },
        { x: 0.35, y: 1.00 }
    ];
}

let activeHandle = -1;
let isDragging = false;

const defaultPresets = {
    "cubic-in": [0.55, 0.055, 0.675, 0.19],
    "cubic-out": [0.215, 0.61, 0.355, 1],
    "cubic-in-out": [0.65, 0.00, 0.35, 1.00],
    "quart-in": [0.56, 0.00, 0.83, 0.16],
    "quart-out": [0.165, 0.84, 0.44, 1],
    "quart-in-out": [0.77, 0, 0.175, 1],
    "quint-in": [0.755, 0.05, 0.855, 0.06],
    "quint-out": [0.23, 1, 0.32, 1],
    "quint-in-out": [0.86, 0, 0.07, 1],
    "expo-in": [0.95, 0.05, 0.795, 0.035]
};

let presets = JSON.parse(localStorage.getItem('easey_presets_v4')) || defaultPresets;

function confirmDeletePreset(name) {
    if (name && presets[name]) {
        presetToDelete = name;
        confirmMessage.innerText = `Are you sure you want to delete preset "${name}"?`;
        btnConfirmOk.innerText = "Yes";
        btnConfirmCancel.innerText = "No";
        btnConfirmCancel.style.display = "inline-block";
        confirmModal.style.display = 'flex';
        btnConfirmCancel.focus();
    }
}

function updatePresetList() {
    presetsList.innerHTML = '';
    
    for (let name in presets) {
        const p = presets[name];
        const x1 = p[0];
        const y1 = p[1];
        const x2 = p[2];
        const y2 = p[3];
        
        // Calculate preview SVG control points
        const svgX1 = 5 + x1 * 40;
        const svgY1 = 45 - y1 * 40;
        const svgX2 = 5 + x2 * 40;
        const svgY2 = 45 - y2 * 40;
        
        const card = document.createElement('div');
        card.className = 'preset-card';
        card.setAttribute('data-name', name);
        if (name === presetSelect.value) {
            card.classList.add('selected');
        }
        
        const strokeColor = (name === presetSelect.value) ? '#00a8ff' : '#ffffff';
        
        card.innerHTML = `
            <div class="preset-card-left">
                <svg class="preset-preview-svg" viewBox="0 0 50 50">
                    <path d="M 5 45 C ${svgX1} ${svgY1}, ${svgX2} ${svgY2}, 45 5" fill="none" stroke="${strokeColor}" stroke-width="3" stroke-linecap="round"/>
                </svg>
            </div>
            <div class="preset-card-middle">
                <div class="preset-card-name">${name}</div>
                <div class="preset-card-values">${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)}</div>
            </div>
            <div class="preset-card-right">
                <button class="btn-card-apply" title="Apply to AE">✓</button>
                <button class="btn-card-delete" title="Delete Preset">✕</button>
            </div>
        `;
        
        // Card click: Select and load into editor, then switch to editor tab
        card.addEventListener('click', (e) => {
            if (e.target.closest('button')) return;
            presetSelect.value = name;
            switchTab('editor');
        });
        
        // Quick Apply button
        const btnCardApply = card.querySelector('.btn-card-apply');
        btnCardApply.addEventListener('click', (e) => {
            e.stopPropagation();
            presetSelect.value = name;
            
            const arr = [handles[0].x, handles[0].y, handles[1].x, handles[1].y];
            csInterface.evalScript(`applyEasing([${arr.join(',')}])`, (res) => {
                if (res.indexOf("ERROR:") === 0) {
                    showAlert(res.replace("ERROR: ", ""));
                } else if (res !== "OK" && res !== "") {
                    console.error("Error from AE:", res);
                }
            });
        });
        
        // Delete button
        const btnCardDelete = card.querySelector('.btn-card-delete');
        btnCardDelete.addEventListener('click', (e) => {
            e.stopPropagation();
            confirmDeletePreset(name);
        });
        
        presetsList.appendChild(card);
    }
}
updatePresetList();

function draw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    
    // Draw 10x10 Grid
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
        // Make the 0, 50%, and 100% lines slightly brighter
        if (i === 0 || i === 5 || i === 10) {
            ctx.strokeStyle = '#555';
        } else {
            ctx.strokeStyle = '#333';
        }
        
        const x = padding + (w / 10) * i;
        ctx.moveTo(x, padding);
        ctx.lineTo(x, padding + h);
        
        const y = padding + (h / 10) * i;
        ctx.moveTo(padding, y);
        ctx.lineTo(padding + w, y);
        
        ctx.stroke();
        ctx.beginPath(); // Reset path for next color if it changes
    }

    const hx1 = padding + handles[0].x * w;
    const hy1 = padding + h - handles[0].y * h;
    const hx2 = padding + handles[1].x * w;
    const hy2 = padding + h - handles[1].y * h;

    // Draw lines to handles
    ctx.lineWidth = 2;
    
    ctx.strokeStyle = '#00a8ff';
    ctx.beginPath();
    ctx.moveTo(padding, padding + h);
    ctx.lineTo(hx1, hy1);
    ctx.stroke();

    ctx.strokeStyle = '#ffaa00';
    ctx.beginPath();
    ctx.moveTo(padding + w, padding);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();

    // Draw Bezier Curve
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(padding, padding + h);
    ctx.bezierCurveTo(hx1, hy1, hx2, hy2, padding + w, padding);
    ctx.stroke();

    // Draw handles
    ctx.fillStyle = '#00a8ff';
    ctx.beginPath();
    ctx.arc(hx1, hy1, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffaa00';
    ctx.beginPath();
    ctx.arc(hx2, hy2, 6, 0, Math.PI * 2);
    ctx.fill();

    // Update Input Box
    if (document.activeElement !== bezierInput) {
        bezierInput.value = `${handles[0].x.toFixed(2)}, ${handles[0].y.toFixed(2)}, ${handles[1].x.toFixed(2)}, ${handles[1].y.toFixed(2)}`;
    }
    
    // Save state
    localStorage.setItem('zen_ease_last_curve', JSON.stringify(handles));
}

function getMousePos(e) {
    const r = canvas.getBoundingClientRect();
    let x = (e.clientX - r.left - padding) / w;
    let y = 1 - (e.clientY - r.top - padding) / h;
    
    // clamp x and y between 0 and 1
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y)); 
    return { x, y };
}

function dist(p1, p2) {
    return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

canvas.addEventListener('mousedown', (e) => {
    const mouse = getMousePos(e);
    
    // Check distance to handles (in normalized space, need to adjust for aspect ratio)
    // Simpler: calculate distance in screen space
    const r = canvas.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    
    const h1x = padding + handles[0].x * w;
    const h1y = padding + h - handles[0].y * h;
    const h2x = padding + handles[1].x * w;
    const h2y = padding + h - handles[1].y * h;
    
    const d1 = Math.hypot(mx - h1x, my - h1y);
    const d2 = Math.hypot(mx - h2x, my - h2y);
    
    if (d1 < 15) {
        activeHandle = 0;
        isDragging = true;
    } else if (d2 < 15) {
        activeHandle = 1;
        isDragging = true;
    }
});

canvas.addEventListener('mousemove', (e) => {
    if (!isDragging || activeHandle === -1) return;
    handles[activeHandle] = getMousePos(e);
    draw();
});

window.addEventListener('mouseup', () => {
    isDragging = false;
    activeHandle = -1;
});

btnApply.addEventListener('click', () => {
    const arr = [handles[0].x, handles[0].y, handles[1].x, handles[1].y];
    csInterface.evalScript(`applyEasing([${arr.join(',')}])`, (res) => {
        if (res.indexOf("ERROR:") === 0) {
            showAlert(res.replace("ERROR: ", ""));
        } else if (res !== "OK" && res !== "") {
            console.error("Error from AE:", res);
        }
    });
});

btnGet.addEventListener('click', () => {
    csInterface.evalScript(`getEasing()`, (res) => {
        if (res.indexOf("ERROR:") === 0) {
            showAlert(res.replace("ERROR: ", ""));
            return;
        }
        try {
            const data = JSON.parse(res);
            if (data && data.length === 4) {
                handles[0].x = data[0];
                handles[0].y = data[1];
                handles[1].x = data[2];
                handles[1].y = data[3];
                draw();
            }
        } catch(e) {
            console.error("Failed to parse getEasing:", res);
        }
    });
});

bezierInput.addEventListener('change', () => {
    const vals = bezierInput.value.split(',').map(v => parseFloat(v.trim()));
    if (vals.length === 4 && vals.every(v => !isNaN(v))) {
        handles[0].x = Math.max(0, Math.min(1, vals[0]));
        handles[0].y = Math.max(0, Math.min(1, vals[1]));
        handles[1].x = Math.max(0, Math.min(1, vals[2]));
        handles[1].y = Math.max(0, Math.min(1, vals[3]));
        presetSelect.value = ""; // Deselect preset
        draw();
    }
});

presetSelect.addEventListener('change', () => {
    const name = presetSelect.value;
    if (name && presets[name]) {
        const p = presets[name];
        handles[0].x = p[0];
        handles[0].y = p[1];
        handles[1].x = p[2];
        handles[1].y = p[3];
        draw();
    }
});

btnSavePreset.addEventListener('click', () => {
    presetNameInput.value = "";
    promptModal.style.display = 'flex';
    presetNameInput.focus();
});

btnModalCancel.addEventListener('click', () => {
    promptModal.style.display = 'none';
});

btnModalOk.addEventListener('click', () => {
    const name = presetNameInput.value.trim();
    if (name) {
        presets[name] = [
            parseFloat(handles[0].x.toFixed(3)),
            parseFloat(handles[0].y.toFixed(3)),
            parseFloat(handles[1].x.toFixed(3)),
            parseFloat(handles[1].y.toFixed(3))
        ];
        localStorage.setItem('easey_presets_v4', JSON.stringify(presets));
        updatePresetList();
        presetSelect.value = name;
        promptModal.style.display = 'none';
    }
});

presetNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        btnModalOk.click();
    } else if (e.key === 'Escape') {
        btnModalCancel.click();
    }
});

let presetToDelete = null;

btnConfirmCancel.addEventListener('click', () => {
    confirmModal.style.display = 'none';
    presetToDelete = null;
});

btnConfirmOk.addEventListener('click', () => {
    if (presetToDelete && presets[presetToDelete]) {
        delete presets[presetToDelete];
        localStorage.setItem('easey_presets_v4', JSON.stringify(presets));
        updatePresetList();
        if (presetSelect.value === presetToDelete) {
            presetSelect.value = "";
        }
    }
    confirmModal.style.display = 'none';
    presetToDelete = null;
});

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (promptModal.style.display === 'flex') btnModalCancel.click();
        if (confirmModal.style.display === 'flex') {
            if (btnConfirmCancel.style.display === "none") {
                btnConfirmOk.click(); // If it's an alert, OK dismisses it
            } else {
                btnConfirmCancel.click(); // If it's a confirmation, No dismisses it
            }
        }
    }
});

btnExportPresets.addEventListener('click', () => {
    if (!window.cep || !window.cep.fs) return showAlert("CEP filesystem not available.");
    const initialPath = csInterface.getSystemPath(SystemPath.MY_DOCUMENTS);
    const result = window.cep.fs.showSaveDialogEx("Export Presets", initialPath, ["txt"], "zen-ease-presets.txt");
    if (result.data) {
        const fileData = JSON.stringify(presets, null, 2);
        const writeResult = window.cep.fs.writeFile(result.data, fileData);
        if (writeResult.err === window.cep.fs.NO_ERROR) {
            showAlert("Presets exported successfully!");
        } else {
            showAlert("Failed to export presets: " + writeResult.err);
        }
    }
});

btnImportPresets.addEventListener('click', () => {
    if (!window.cep || !window.cep.fs) return showAlert("CEP filesystem not available.");
    const initialPath = csInterface.getSystemPath(SystemPath.MY_DOCUMENTS);
    const result = window.cep.fs.showOpenDialogEx(false, false, "Import Presets", initialPath, ["txt"]);
    if (result.data && result.data.length > 0) {
        const fileContent = window.cep.fs.readFile(result.data[0]);
        if (fileContent.err === window.cep.fs.NO_ERROR) {
            try {
                const imported = JSON.parse(fileContent.data);
                if (typeof imported === 'object') {
                    presets = { ...presets, ...imported };
                    localStorage.setItem('easey_presets_v4', JSON.stringify(presets));
                    updatePresetList();
                    showAlert("Presets imported successfully!");
                }
            } catch (e) {
                showAlert("Failed to parse preset file.");
            }
        }
    }
});

btnFlipCurve.addEventListener('click', () => {
    const tempX1 = handles[0].x;
    const tempY1 = handles[0].y;
    
    handles[0].x = Math.max(0, Math.min(1, 1 - handles[1].x));
    handles[0].y = Math.max(0, Math.min(1, 1 - handles[1].y));
    
    handles[1].x = Math.max(0, Math.min(1, 1 - tempX1));
    handles[1].y = Math.max(0, Math.min(1, 1 - tempY1));
    
    presetSelect.value = ""; // Deselect preset
    draw();
});

resizeCanvas();
