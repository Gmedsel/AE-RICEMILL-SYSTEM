// ============================================
// AE RICEMILL - app.js
// Firebase Realtime Database Edition
// All data is synced with Firebase.
// Local arrays are kept in-memory only for
// rendering; Firebase is the source of truth.
// ============================================

// ============================================
// IN-MEMORY CACHE (populated by Firebase listeners)
// ============================================
let palayData     = [];
let millingData   = [];
let paymentsData  = [];

// ============================================
// FIREBASE HELPERS
// NOTE: db, ref, push, onValue, remove are
// attached to window by the module script
// in index.html, so we access them via window.*
// ============================================

function fbRef(path) {
    return window.ref(window.db, path);
}

function fbPush(path, data) {
    return window.push(fbRef(path), data);
}

function fbSet(path, data) {
    return window._set(fbRef(path), data);
}

function fbRemove(path) {
    return window.remove(fbRef(path));
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP'
    }).format(amount || 0);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    const [y, m, d] = dateString.split('-');
    return new Date(y, m - 1, d).toLocaleDateString('en-US', options);
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toast.className = 'toast ' + type;
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    document.getElementById('current-date').textContent =
        now.toLocaleDateString('en-US', options);
}

// ============================================
// NAVIGATION
// ============================================

function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-links li');
    const sections = document.querySelectorAll('.section');
    const sectionTitle = document.getElementById('section-title');

    const titles = {
        dashboard: 'Dashboard',
        palay: 'Palay Received',
        milling: 'Daily Milling',
        payments: 'Payments'
    };

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const sectionId = link.dataset.section;

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');

            sectionTitle.textContent = titles[sectionId];

            document.querySelector('.sidebar').classList.remove('active');

            if (sectionId === 'dashboard') {
                updateDashboard();
            }

            // Reset modal titles
            document.getElementById('palayModalTitle').textContent    = 'Add Palay Record';
            document.getElementById('millingModalTitle').textContent   = 'Add Milling Record';
            document.getElementById('paymentModalTitle').textContent   = 'Add Payment';
        });
    });

    document.querySelector('.menu-toggle').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
    });
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.add('active');

    const dateInputs = modal.querySelectorAll('input[type="date"]');
    dateInputs.forEach(input => {
        if (!input.value) {
            input.value = new Date().toISOString().split('T')[0];
        }
    });

    if (modalId === 'paymentModal') {
        populateMillingDropdown();
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    modal.classList.remove('active');

    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        const idField = form.querySelector('input[type="hidden"]');
        if (idField) idField.value = '';
    }
}

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('active');
    }
});

// ============================================
// PALAY — FIREBASE CRUD
// ============================================

function savePalay(e) {
    e.preventDefault();

    const hiddenId = document.getElementById('palayId').value;

    const record = {
        date:    document.getElementById('palayDate').value,
        name:    document.getElementById('palayName').value,
        contact: document.getElementById('palayContact').value,
        address: document.getElementById('palayAddress').value,
        sacks:   parseInt(document.getElementById('palaySacks').value),
        kilo:    parseFloat(document.getElementById('palayKilo').value)
    };

    if (hiddenId) {
        fbSet('palayRecords/' + hiddenId, record)
            .then(() => {
                showToast('Palay record updated successfully!');
                closeModal('palayModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    } else {
        fbPush('palayRecords', record)
            .then(() => {
                showToast('Palay record added successfully!');
                closeModal('palayModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

function editPalay(firebaseKey) {
    const record = palayData.find(p => p._key === firebaseKey);
    if (record) {
        document.getElementById('palayModalTitle').textContent = 'Edit Palay Record';
        document.getElementById('palayId').value      = firebaseKey;
        document.getElementById('palayDate').value    = record.date;
        document.getElementById('palayName').value    = record.name;
        document.getElementById('palayContact').value = record.contact;
        document.getElementById('palayAddress').value = record.address;
        document.getElementById('palaySacks').value   = record.sacks;
        document.getElementById('palayKilo').value    = record.kilo;
        openModal('palayModal');
    }
}

function deletePalay(firebaseKey) {
    confirmDelete(() => {
        fbRemove('palayRecords/' + firebaseKey)
            .then(() => showToast('Palay record deleted successfully!'))
            .catch(err => showToast('Error: ' + err.message, 'error'));
    });
}

function renderPalayTable() {
    const tbody = document.getElementById('palayTableBody');

    if (palayData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6">
                    <div class="empty-state">
                        <i class="fas fa-wheat-awn"></i>
                        <p>No palay records found. Add your first record!</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = palayData.map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${formatDate(record.date)}</td>
            <td>${record.name}</td>
            <td>${record.sacks}</td>
            <td>${(record.kilo || 0).toFixed(2)} kg</td>
            <td>
                <div class="action-btns">
                    <button class="edit-btn" onclick="editPalay('${record._key}')" title="Edit">
                        <span class="">Edit</span>
                    </button>
                    <button class="delete-btn" onclick="deletePalay('${record._key}')" title="Delete">
                        <span class="">Delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// MILLING — FIREBASE CRUD
// BUGAS accepts "numerator/denominator" format
// Formula: (numerator × 50) + (denominator × rate)
// ============================================

/**
 * Parse the bugas input field.
 * Accepts either "27/18" or plain "45".
 * Returns { numerator, denominator, raw }
 */
function parseBugas(raw) {
    const str = (raw || '').trim();
    if (str.includes('/')) {
        const parts = str.split('/');
        return {
            numerator:   parseFloat(parts[0]) || 0,
            denominator: parseFloat(parts[1]) || 0,
            raw: str
        };
    }
    return {
        numerator:   0,
        denominator: parseFloat(str) || 0,
        raw: str
    };
}

// Auto-calculate milling amount
// Formula: ((numerator × 50) + denominator) × rate
function calculateMillingAmount() {
    const bugasRaw = document.getElementById('millingBugas').value;
    const rate     = parseFloat(document.getElementById('millingRate').value) || 2;
    const bugas    = parseBugas(bugasRaw);

    const totalAmount = ((bugas.numerator * 50) + bugas.denominator) * rate;
    document.getElementById('millingAmount').value = totalAmount.toFixed(2);
}

function saveMilling(e) {
    e.preventDefault();

    const hiddenId = document.getElementById('millingId').value;
    const rate     = parseFloat(document.getElementById('millingRate').value) || 2;
    const bugas    = parseBugas(document.getElementById('millingBugas').value);

    const record = {
        date:             document.getElementById('millingDate').value,
        name:             document.getElementById('millingName').value,
        contact:          document.getElementById('millingContact').value,
        address:          document.getElementById('millingAddress').value,
        palay:            parseFloat(document.getElementById('millingPalay').value),
        bugasRaw:         bugas.raw,
        bugas:            bugas.denominator,   // denominator used for kg totals on dashboard
        bugasNumerator:   bugas.numerator,
        bugasDenominator: bugas.denominator,
        rate:             rate,
        amount:           parseFloat(document.getElementById('millingAmount').value)
    };

    if (hiddenId) {
        fbSet('millingRecords/' + hiddenId, record)
            .then(() => {
                showToast('Milling record updated successfully!');
                closeModal('millingModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    } else {
        fbPush('millingRecords', record)
            .then(() => {
                showToast('Milling record added successfully!');
                closeModal('millingModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

function editMilling(firebaseKey) {
    const record = millingData.find(m => m._key === firebaseKey);
    if (record) {
        document.getElementById('millingModalTitle').textContent = 'Edit Milling Record';
        document.getElementById('millingId').value      = firebaseKey;
        document.getElementById('millingDate').value    = record.date;
        document.getElementById('millingName').value    = record.name;
        document.getElementById('millingContact').value = record.contact;
        document.getElementById('millingAddress').value = record.address;
        document.getElementById('millingPalay').value   = record.palay;
        // Restore the original "27/18" style value if saved, else fallback to plain bugas
        document.getElementById('millingBugas').value   = record.bugasRaw || record.bugas || '';
        document.getElementById('millingRate').value    = record.rate || 2;
        document.getElementById('millingAmount').value  = record.amount;
        openModal('millingModal');
    }
}

function deleteMilling(firebaseKey) {
    confirmDelete(() => {
        fbRemove('millingRecords/' + firebaseKey)
            .then(() => showToast('Milling record deleted successfully!'))
            .catch(err => showToast('Error: ' + err.message, 'error'));
    });
}

function renderMillingTable() {
    const tbody = document.getElementById('millingTableBody');

    if (millingData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="10">
                    <div class="empty-state">
                        <i class="fas fa-industry"></i>
                        <p>No milling records found. Add your first record!</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = millingData.map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${formatDate(record.date)}</td>
            <td><span class="soa-name-link" onclick="openSOA(this.dataset.name)" data-name="${record.name}" title="View Statement of Account">${record.name} <i class=\"fas fa-receipt\" style=\"font-size:10px;opacity:0.6;\"></i></span></td>
            <td>${record.contact}</td>
            <td>${record.address}</td>
            <td>${(record.palay || 0).toFixed(2)}</td>
            <td>${record.bugasRaw || (record.bugas || 0).toFixed(2)}</td>
            <td>₱${(record.rate || 2).toFixed(2)}</td>
            <td>${formatCurrency(record.amount)}</td>
            <td>
                <div class="action-btns">
                    <button class="edit-btn" onclick="editMilling('${record._key}')" title="Edit">
                        <span class="">Edit</span>
                    </button>
                    <button class="delete-btn" onclick="deleteMilling('${record._key}')" title="Delete">
                        <span class="">Delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// ============================================
// PAYMENTS — FIREBASE CRUD
// SIMPLIFIED: NO PAID AMOUNT, NO BALANCE
// ============================================

function populateMillingDropdown() {
    const select = document.getElementById('paymentMilling');
    select.innerHTML = '<option value="">Select Milling Record</option>';
    millingData.forEach(milling => {
        const option = document.createElement('option');
        option.value = milling._key;
        option.textContent = `${milling.name} - ${formatDate(milling.date)} - ${formatCurrency(milling.amount)}`;
        select.appendChild(option);
    });
}

function savePayment(e) {
    e.preventDefault();

    const hiddenId     = document.getElementById('paymentId').value;
    const millingKey   = document.getElementById('paymentMilling').value;
    const milling      = millingData.find(m => m._key === millingKey);

    const record = {
        date:         document.getElementById('paymentDate').value,
        millingId:    millingKey,
        millingName:  milling ? milling.name : 'Unknown',
        description:  document.getElementById('paymentDescription').value,
        amount:       parseFloat(document.getElementById('paymentAmount').value),
        status:       document.getElementById('paymentStatus').value
    };

    if (hiddenId) {
        fbSet('payments/' + hiddenId, record)
            .then(() => {
                showToast('Payment updated successfully!');
                closeModal('paymentModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    } else {
        fbPush('payments', record)
            .then(() => {
                showToast('Payment added successfully!');
                closeModal('paymentModal');
            })
            .catch(err => showToast('Error: ' + err.message, 'error'));
    }
}

function editPayment(firebaseKey) {
    const record = paymentsData.find(p => p._key === firebaseKey);
    if (record) {
        document.getElementById('paymentModalTitle').textContent = 'Edit Payment';
        document.getElementById('paymentId').value          = firebaseKey;
        document.getElementById('paymentDate').value        = record.date;
        populateMillingDropdown();
        document.getElementById('paymentMilling').value     = record.millingId;
        document.getElementById('paymentDescription').value = record.description;
        document.getElementById('paymentAmount').value      = record.amount;
        document.getElementById('paymentStatus').value      = record.status;
        openModal('paymentModal');
    }
}

function deletePayment(firebaseKey) {
    confirmDelete(() => {
        fbRemove('payments/' + firebaseKey)
            .then(() => showToast('Payment deleted successfully!'))
            .catch(err => showToast('Error: ' + err.message, 'error'));
    });
}

function renderPaymentTable(filteredData = null) {
    const tbody = document.getElementById('paymentTableBody');
    const data  = filteredData || paymentsData;

    if (data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="empty-state">
                        <i class="fas fa-credit-card"></i>
                        <p>No payment records found. Add your first payment!</p>
                    </div>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = data.map((record, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${formatDate(record.date)}</td>
            <td>${record.millingName}</td>
            <td>${record.description}</td>
            <td>${formatCurrency(record.amount)}</td>
            <td><span class="status-badge ${record.status}">${record.status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="edit-btn" onclick="editPayment('${record._key}')" title="Edit">
                        <span class="">Edit</span>
                    </button>
                    <button class="delete-btn" onclick="deletePayment('${record._key}')" title="Delete">
                        <span class="">Delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function updatePaymentStats() {
    const paid    = paymentsData.filter(p => p.status === 'paid').length;
    const pending = paymentsData.filter(p => p.status === 'pending').length;
    const unpaid  = paymentsData.filter(p => p.status === 'unpaid').length;

    document.getElementById('paid-count').textContent    = paid;
    document.getElementById('pending-count').textContent = pending;
    document.getElementById('unpaid-count').textContent  = unpaid;
}

function filterPayments() {
    const filter = document.getElementById('paymentFilter').value;
    if (filter === 'all') {
        renderPaymentTable();
    } else {
        renderPaymentTable(paymentsData.filter(p => p.status === filter));
    }
}

// ============================================
// DELETE CONFIRMATION
// ============================================

let deleteCallback = null;

function confirmDelete(callback) {
    deleteCallback = callback;
    openModal('deleteModal');
}

document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
    if (deleteCallback) {
        deleteCallback();
        deleteCallback = null;
    }
    closeModal('deleteModal');
});

// ============================================
// SEARCH FUNCTIONALITY
// ============================================

function searchTable(tableId, query) {
    const table = document.getElementById(tableId);
    const rows  = table.querySelectorAll('tbody tr');
    const q     = query.toLowerCase();
    rows.forEach(row => {
        row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
}

// ============================================
// DASHBOARD & CHARTS
// ============================================

let palayChart, paymentChart, millingChart;

function updateDashboard() {
    const totalPalay     = palayData.reduce((sum, p) => sum + (p.sacks || 0), 0);
    const totalMilled    = millingData.reduce((sum, m) => sum + (m.bugas || 0), 0);
    const totalCustomers = millingData.length;
    const totalRevenue   = millingData.reduce((sum, m) => sum + (m.amount || 0), 0);

    document.getElementById('total-palay').textContent    = `${totalPalay} sacks`;
    document.getElementById('total-milled').textContent   = `${totalMilled.toFixed(2)} kg`;
    document.getElementById('total-customers').textContent = totalCustomers;
    document.getElementById('total-revenue').textContent  = formatCurrency(totalRevenue);

    updateCharts();
}

function updateCharts() {
    const last7Days  = [];
    const palayByDay = [];

    for (let i = 6; i >= 0; i--) {
        const date    = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last7Days.push(date.toLocaleDateString('en-US', { weekday: 'short' }));

        const dayPalay = palayData
            .filter(p => p.date === dateStr)
            .reduce((sum, p) => sum + (p.sacks || 0), 0);
        palayByDay.push(dayPalay);
    }

    // --- Weekly Palay Chart ---
    const palayCtx = document.getElementById('weeklyPalayChart').getContext('2d');
    if (palayChart) palayChart.destroy();
    palayChart = new Chart(palayCtx, {
        type: 'bar',
        data: {
            labels: last7Days,
            datasets: [{
                label: 'Palay Sacks',
                data: palayByDay,
                backgroundColor: 'rgba(76, 175, 80, 0.6)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 2,
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                x: { grid: { display: false } }
            }
        }
    });

    // --- Payment Status Chart ---
    const paymentCtx  = document.getElementById('paymentStatusChart').getContext('2d');
    if (paymentChart) paymentChart.destroy();
    const paidCount   = paymentsData.filter(p => p.status === 'paid').length;
    const pendingCount = paymentsData.filter(p => p.status === 'pending').length;
    const unpaidCount = paymentsData.filter(p => p.status === 'unpaid').length;
    paymentChart = new Chart(paymentCtx, {
        type: 'doughnut',
        data: {
            labels: ['Paid', 'Pending', 'Unpaid'],
            datasets: [{
                data: [paidCount, pendingCount, unpaidCount],
                backgroundColor: [
                    'rgba(76,175,80,0.8)',
                    'rgba(255,152,0,0.8)',
                    'rgba(244,67,54,0.8)'
                ],
                borderColor: [
                    'rgba(76,175,80,1)',
                    'rgba(255,152,0,1)',
                    'rgba(244,67,54,1)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            cutout: '60%'
        }
    });

    // --- Daily Milling Trends Chart ---
    const millingCtx  = document.getElementById('millingTrendsChart').getContext('2d');
    if (millingChart) millingChart.destroy();
    const millingByDay  = [];
    const revenueByDay  = [];

    for (let i = 6; i >= 0; i--) {
        const date    = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        millingByDay.push(
            millingData.filter(m => m.date === dateStr)
                       .reduce((sum, m) => sum + (m.bugas || 0), 0)
        );
        revenueByDay.push(
            millingData.filter(m => m.date === dateStr)
                       .reduce((sum, m) => sum + (m.amount || 0), 0)
        );
    }

    millingChart = new Chart(millingCtx, {
        type: 'line',
        data: {
            labels: last7Days,
            datasets: [
                {
                    label: 'Rice Output (kg)',
                    data: millingByDay,
                    borderColor: 'rgba(33,150,243,1)',
                    backgroundColor: 'rgba(33,150,243,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: 'rgba(33,150,243,1)'
                },
                {
                    label: 'Revenue (₱)',
                    data: revenueByDay,
                    borderColor: 'rgba(156,39,176,1)',
                    backgroundColor: 'rgba(156,39,176,0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 6,
                    pointBackgroundColor: 'rgba(156,39,176,1)',
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: { position: 'top' } },
            scales: {
                y:  { type: 'linear', display: true, position: 'left',  beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                y1: { type: 'linear', display: true, position: 'right', beginAtZero: true, grid: { drawOnChartArea: false } },
                x:  { grid: { display: false } }
            }
        }
    });
}

// ============================================
// EXPORT REPORTS
// ============================================

function downloadReport(filename, content) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Report exported successfully!');
}

function exportPalayReport() {
    let content = 'AE RICEMILL - PALAY RECEIVED REPORT\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += 'ID,Date,Name,Contact,Address,Sacks,Kilo\n';
    palayData.forEach((record, index) => {
        content += `${index + 1},"${record.date}","${record.name}","${record.contact}","${record.address}",${record.sacks},${record.kilo}\n`;
    });
    downloadReport('palay_report.csv', content);
}

function exportMillingReport() {
    let content = 'AE RICEMILL - DAILY MILLING REPORT\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += 'ID,Date,Name,Contact,Address,Palay (kg),Bugas,Rate,Amount\n';
    millingData.forEach((record, index) => {
        content += `${index + 1},"${record.date}","${record.name}","${record.contact}","${record.address}",${record.palay},"${record.bugasRaw || record.bugas}",${record.rate},${record.amount}\n`;
    });
    downloadReport('milling_report.csv', content);
}

function exportPaymentReport() {
    let content = 'AE RICEMILL - PAYMENTS REPORT\n';
    content += `Generated: ${new Date().toLocaleString()}\n\n`;
    content += 'ID,Date,Milling Record,Description,Amount,Status\n';
    paymentsData.forEach((record, index) => {
        content += `${index + 1},"${record.date}","${record.millingName}","${record.description}",${record.amount},"${record.status}"\n`;
    });
    downloadReport('payments_report.csv', content);
}

// ============================================
// FIREBASE REAL-TIME LISTENERS
// ============================================

function initFirebaseListeners() {
    // Palay Records
    window.onValue(fbRef('palayRecords'), (snapshot) => {
        palayData = [];
        snapshot.forEach(child => {
            palayData.push({ _key: child.key, ...child.val() });
        });
        renderPalayTable();
        updateDashboard();
    });

    // Milling Records
    window.onValue(fbRef('millingRecords'), (snapshot) => {
        millingData = [];
        snapshot.forEach(child => {
            millingData.push({ _key: child.key, ...child.val() });
        });
        renderMillingTable();
        updateDashboard();
    });

    // Payments
    window.onValue(fbRef('payments'), (snapshot) => {
        paymentsData = [];
        snapshot.forEach(child => {
            paymentsData.push({ _key: child.key, ...child.val() });
        });
        renderPaymentTable();
        updatePaymentStats();
        updateDashboard();
    });
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', () => {
    function waitForFirebase(attempts) {
        if (window.db && window.ref && window.push && window.onValue && window.remove && window._set) {
            initNavigation();
            updateDateTime();
            setInterval(updateDateTime, 60000);
            initFirebaseListeners();
            initAutocomplete();
        } else if (attempts > 0) {
            setTimeout(() => waitForFirebase(attempts - 1), 100);
        } else {
            console.error('Firebase SDK not loaded. Check the module script in index.html.');
        }
    }
    waitForFirebase(20);
});

// ============================================
// AUTOCOMPLETE SUGGESTIONS
// ============================================

/**
 * Build a deduplicated list of known customers
 * from both palayData and millingData.
 * Each entry: { name, contact, address }
 */
function getKnownCustomers() {
    const map = new Map();
    [...palayData, ...millingData].forEach(r => {
        if (r.name) {
            const key = r.name.trim().toLowerCase();
            if (!map.has(key)) {
                map.set(key, {
                    name:    r.name.trim(),
                    contact: r.contact || '',
                    address: r.address || ''
                });
            }
        }
    });
    return Array.from(map.values());
}

/**
 * Attach autocomplete to a name input.
 * When a suggestion is picked, auto-fills contact & address too.
 */
function attachAutocomplete(nameId, contactId, addressId) {
    const input = document.getElementById(nameId);
    if (!input) return;

    let dropdown = document.getElementById(nameId + '_suggestions');
    if (!dropdown) {
        dropdown = document.createElement('div');
        dropdown.id = nameId + '_suggestions';
        dropdown.className = 'ac-dropdown';
        input.parentNode.style.position = 'relative';
        input.parentNode.appendChild(dropdown);
    }

    function showSuggestions(query) {
        const customers = getKnownCustomers();
        const q = query.trim().toLowerCase();
        const matches = q
            ? customers.filter(c => c.name.toLowerCase().includes(q))
            : customers;

        if (!matches.length) {
            dropdown.innerHTML = '';
            dropdown.style.display = 'none';
            return;
        }

        dropdown.innerHTML = matches.map((c, i) =>
            `<div class="ac-item" data-index="${i}">
                <span class="ac-name">${c.name}</span>
                <span class="ac-sub">${c.contact}${c.address ? ' · ' + c.address : ''}</span>
            </div>`
        ).join('');
        dropdown.style.display = 'block';

        dropdown.querySelectorAll('.ac-item').forEach((item, i) => {
            item.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const picked = matches[i];
                document.getElementById(nameId).value    = picked.name;
                document.getElementById(contactId).value = picked.contact;
                document.getElementById(addressId).value = picked.address;
                dropdown.style.display = 'none';
            });
        });
    }

    input.addEventListener('input', () => showSuggestions(input.value));
    input.addEventListener('focus', () => showSuggestions(input.value));
    input.addEventListener('blur',  () => {
        setTimeout(() => { dropdown.style.display = 'none'; }, 150);
    });
}

function initAutocomplete() {
    attachAutocomplete('palayName',   'palayContact',   'palayAddress');
    attachAutocomplete('millingName', 'millingContact', 'millingAddress');
}

// ============================================
// STATEMENT OF ACCOUNT (SOA)
// ============================================

function formatCurrencySOA(n) {
    return '₱' + (parseFloat(n) || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    });
}

/**
 * Open SOA modal for a given customer name.
 * Shows all their milling records + linked payments.
 */
function openSOA(customerName) {
    const name = customerName.trim();

    // All milling records for this customer
    const millings = millingData.filter(m =>
        (m.name || '').trim().toLowerCase() === name.toLowerCase()
    );

    // All payments linked to those milling records
    const millingKeys = new Set(millings.map(m => m._key));
    const payments = paymentsData.filter(p => millingKeys.has(p.millingId));

    // Totals
    const totalMilling  = millings.reduce((s, m) => s + (parseFloat(m.amount) || 0), 0);
    const totalPaid     = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const totalPending  = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const totalUnpaid   = payments.filter(p => p.status === 'unpaid').reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const totalPayments = payments.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);
    const balance       = totalMilling - totalPaid;

    document.getElementById('soaTitle').textContent = 'Statement of Account — ' + name;

    // ── Milling rows ──
    const millingRows = millings.length
        ? millings.map((m, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${formatDate(m.date)}</td>
                <td>${m.bugasRaw || m.bugas || '—'}</td>
                <td>${(parseFloat(m.palay) || 0).toFixed(1)} kg</td>
                <td>₱${(m.rate || 2).toFixed(2)}</td>
                <td style="font-weight:600;">${formatCurrencySOA(m.amount)}</td>
            </tr>`).join('')
        : `<tr><td colspan="6" style="text-align:center;color:#bbb;padding:16px;">No milling records</td></tr>`;

    // ── Payment rows ──
    const paymentRows = payments.length
        ? payments.map((p, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${formatDate(p.date)}</td>
                <td>${p.description || '—'}</td>
                <td style="font-weight:600;">${formatCurrencySOA(p.amount)}</td>
                <td><span class="soa-pill soa-pill-${p.status}">${p.status}</span></td>
            </tr>`).join('')
        : `<tr><td colspan="5" style="text-align:center;color:#bbb;padding:16px;">No payment records</td></tr>`;

    const balanceColor = balance <= 0 ? 'soa-green' : 'soa-red';
    const balanceLabel = balance <= 0 ? 'Fully Settled ✓' : 'Outstanding Balance';

    document.getElementById('soaBody').innerHTML = `
        <!-- Customer header -->
        <div class="soa-header-box">
            <h3><i class="fas fa-user" style="margin-right:8px;"></i>${name}</h3>
            <p><i class="fas fa-industry" style="margin-right:6px;color:#4CAF50;"></i>${millings.length} milling transaction${millings.length !== 1 ? 's' : ''}</p>
            <p><i class="fas fa-calendar-alt" style="margin-right:6px;color:#4CAF50;"></i>Generated: ${new Date().toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric' })}</p>
        </div>

        <!-- Summary cards -->
        <div class="soa-summary-row">
            <div class="soa-sum-box">
                <div class="lbl">Total Billed</div>
                <div class="val soa-purple">${formatCurrencySOA(totalMilling)}</div>
            </div>
            <div class="soa-sum-box">
                <div class="lbl">Paid</div>
                <div class="val soa-green">${formatCurrencySOA(totalPaid)}</div>
            </div>
            <div class="soa-sum-box">
                <div class="lbl">Pending</div>
                <div class="val soa-orange">${formatCurrencySOA(totalPending)}</div>
            </div>
            <div class="soa-sum-box">
                <div class="lbl">Unpaid</div>
                <div class="val soa-red">${formatCurrencySOA(totalUnpaid)}</div>
            </div>
        </div>

        <!-- Milling table -->
        <div class="soa-section-title"><i class="fas fa-industry" style="margin-right:6px;"></i>Milling Transactions</div>
        <table class="soa-table">
            <thead>
                <tr>
                    <th>#</th><th>Date</th><th>Bugas</th><th>Palay</th><th>Rate</th><th>Amount</th>
                </tr>
            </thead>
            <tbody>${millingRows}</tbody>
        </table>

        <!-- Payments table -->
        <div class="soa-section-title"><i class="fas fa-credit-card" style="margin-right:6px;"></i>Payment Records</div>
        <table class="soa-table">
            <thead>
                <tr>
                    <th>#</th><th>Date</th><th>Description</th><th>Amount</th><th>Status</th>
                </tr>
            </thead>
            <tbody>${paymentRows}</tbody>
        </table>

        <!-- Balance -->
        <div class="soa-balance-row">
            <span class="soa-balance-label">${balanceLabel}</span>
            <span class="soa-balance-val ${balanceColor}">${formatCurrencySOA(Math.abs(balance))}</span>
        </div>
    `;

    openModal('soaModal');
}

/**
 * Print the SOA as a clean PDF/print page.
 */
function soaPrint() {
    const title   = document.getElementById('soaTitle').textContent;
    const bodyHtml = document.getElementById('soaBody').innerHTML;

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${title}</title>
<style>
body { font-family: Arial, sans-serif; font-size: 13px; color: #222; padding: 30px; }
h1   { font-size: 20px; margin: 0 0 2px; color: #1b5e20; }
.sub { color: #777; font-size: 12px; margin: 0 0 20px; }
.soa-header-box { background: #e8f5e9; border-radius: 8px; padding: 14px 18px; margin-bottom: 14px; border: 1px solid #c8e6c9; }
.soa-header-box h3 { margin: 0 0 4px; font-size: 16px; color: #1b5e20; }
.soa-header-box p  { margin: 2px 0; font-size: 12px; color: #555; }
.soa-summary-row   { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 14px; }
.soa-sum-box       { flex: 1; min-width: 90px; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 6px; padding: 8px 12px; text-align: center; }
.soa-sum-box .lbl  { font-size: 10px; color: #aaa; text-transform: uppercase; letter-spacing: .05em; }
.soa-sum-box .val  { font-size: 15px; font-weight: 700; margin-top: 3px; }
.soa-green  { color: #2e7d32; }
.soa-blue   { color: #1565c0; }
.soa-orange { color: #e65100; }
.soa-purple { color: #6a1b9a; }
.soa-red    { color: #c62828; }
.soa-section-title { font-size: 11px; font-weight: 600; color: #888; text-transform: uppercase; letter-spacing: .06em; margin: 14px 0 6px; padding-bottom: 4px; border-bottom: 1px solid #eef2f7; }
.soa-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 4px; }
.soa-table thead th { background: #f0f4f0; padding: 6px 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; }
.soa-table tbody td { padding: 6px 10px; border-bottom: 1px solid #f0f4f8; }
.soa-table tbody tr:last-child td { border-bottom: none; }
.soa-pill { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 600; }
.soa-pill-paid    { background: #e8f5e9; color: #2e7d32; }
.soa-pill-pending { background: #fff3e0; color: #e65100; }
.soa-pill-unpaid  { background: #ffebee; color: #c62828; }
.soa-balance-row  { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border: 1px solid #eef2f7; border-radius: 6px; padding: 10px 14px; margin-top: 12px; }
.soa-balance-label { font-size: 13px; font-weight: 600; color: #2d3a4a; }
.soa-balance-val   { font-size: 17px; font-weight: 700; }
@media print { body { padding: 15px; } }
</style></head><body>
<h1>AE Ricemill</h1>
<p class="sub">${title}</p>
${bodyHtml}
<script>window.onload=function(){window.print();};<\/script>
</body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
}