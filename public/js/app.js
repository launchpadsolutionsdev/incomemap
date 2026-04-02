/* ========================================
   IncomeMap — Client-Side JavaScript
   ======================================== */

// Utility: format currency
function fmtCurrency(amount) {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
}

// Utility: format percentage
function fmtPct(val) {
    return val.toFixed(2) + '%';
}

// Utility: format date
function fmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Utility: API fetch with error handling
async function apiFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
}

// Account filter pills — shared across pages
let currentAccount = 'All';
function setupAccountPills(onChange) {
    document.querySelectorAll('.account-pills .pill[data-account]').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.account-pills .pill[data-account]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentAccount = pill.dataset.account;
            if (onChange) onChange(currentAccount);
        });
    });
}

function accountParam() {
    return currentAccount !== 'All' ? `?accountType=${encodeURIComponent(currentAccount)}` : '';
}

/* ========================================
   Dashboard
   ======================================== */

function initDashboard() {
    const now = new Date();
    const dateEl = document.getElementById('dateDisplay');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    }

    let chartYear = now.getFullYear();
    const chartYearEl = document.getElementById('chartYear');
    if (chartYearEl) chartYearEl.textContent = chartYear;

    const prevYearBtn = document.getElementById('prevYear');
    const nextYearBtn = document.getElementById('nextYear');
    if (prevYearBtn) prevYearBtn.addEventListener('click', () => { chartYear--; chartYearEl.textContent = chartYear; loadMonthlyChart(chartYear); });
    if (nextYearBtn) nextYearBtn.addEventListener('click', () => { chartYear++; chartYearEl.textContent = chartYear; loadMonthlyChart(chartYear); });

    setupAccountPills(() => {
        loadDashboardData();
        loadMonthlyChart(chartYear);
    });

    loadDashboardData();
    loadMonthlyChart(chartYear);
    loadNews();
}

async function loadDashboardData() {
    try {
        const data = await apiFetch('/api/dashboard/summary' + accountParam());

        document.getElementById('annualIncome').textContent = fmtCurrency(data.annualIncome);
        document.getElementById('portfolioValue').textContent = fmtCurrency(data.portfolioValue);
        document.getElementById('holdingCount').textContent = `${data.holdingCount} holding${data.holdingCount !== 1 ? 's' : ''}`;
        document.getElementById('weightedYield').textContent = fmtPct(data.weightedYield);

        if (data.nextPayment) {
            document.getElementById('nextPaymentTicker').textContent = data.nextPayment.ticker;
            document.getElementById('nextPaymentDate').textContent = fmtDate(data.nextPayment.date);
        } else {
            document.getElementById('nextPaymentTicker').textContent = '—';
            document.getElementById('nextPaymentDate').textContent = '';
        }

        // Top holdings table
        const tbody = document.getElementById('topHoldingsBody');
        if (data.topHoldings && data.topHoldings.length > 0) {
            tbody.innerHTML = data.topHoldings.map(h => `
                <tr>
                    <td><strong>${h.ticker}</strong><span style="color:var(--im-text-muted);font-size:0.75rem;margin-left:0.375rem;">${h.exchange}</span></td>
                    <td class="text-right mono">${parseFloat(h.shares).toFixed(2)}</td>
                    <td class="text-right mono">${fmtCurrency(h.annual_income_cad)}</td>
                    <td class="text-right mono">${fmtPct(h.current_yield)}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Add holdings to see your data</td></tr>';
        }

        // Upcoming payments
        const upcoming = await apiFetch('/api/dashboard/upcoming' + accountParam());
        const upEl = document.getElementById('upcomingPayments');
        if (upcoming && upcoming.length > 0) {
            upEl.innerHTML = upcoming.map(p => {
                const d = new Date(p.date + 'T00:00:00');
                const monthStr = d.toLocaleDateString('en-CA', { month: 'short' });
                const dayStr = d.getDate();
                return `
                    <div class="upcoming-item">
                        <div class="upcoming-date">
                            <span class="month">${monthStr}</span>
                            <span class="day">${dayStr}</span>
                        </div>
                        <div class="upcoming-info">
                            <div class="upcoming-ticker">${p.ticker}</div>
                            <div class="upcoming-account">${p.account_type}</div>
                        </div>
                        <div class="upcoming-amount">${fmtCurrency(p.amount)}</div>
                    </div>
                `;
            }).join('');
        } else {
            upEl.innerHTML = '<p class="empty-state">No upcoming payments</p>';
        }
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

let incomeChart = null;
async function loadMonthlyChart(year) {
    try {
        const acctParam = currentAccount !== 'All' ? `&accountType=${encodeURIComponent(currentAccount)}` : '';
        const data = await apiFetch(`/api/dashboard/monthly-income?year=${year}${acctParam}`);

        const ctx = document.getElementById('incomeChart');
        if (!ctx) return;

        if (incomeChart) incomeChart.destroy();

        const green500 = getComputedStyle(document.documentElement).getPropertyValue('--im-green-500').trim() || '#4A9E74';
        const green100 = getComputedStyle(document.documentElement).getPropertyValue('--im-green-100').trim() || '#D4E8DC';

        incomeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: data.months.map(m => m.month),
                datasets: [{
                    label: 'Dividend Income',
                    data: data.months.map(m => m.amount),
                    backgroundColor: green500,
                    hoverBackgroundColor: green100,
                    borderRadius: 4,
                    maxBarThickness: 40
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => fmtCurrency(ctx.parsed.y)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (v) => '$' + v,
                            font: { family: "'JetBrains Mono', monospace", size: 11 }
                        },
                        grid: { color: 'rgba(0,0,0,0.04)' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { font: { size: 12 } }
                    }
                }
            }
        });
    } catch (err) {
        console.error('Chart load error:', err);
    }
}

/* ========================================
   News Feed
   ======================================== */

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const months = Math.floor(days / 30);
    return months === 1 ? '1 month ago' : `${months} months ago`;
}

async function loadNews() {
    const el = document.getElementById('newsFeed');
    if (!el) return;

    try {
        const articles = await apiFetch('/api/news');

        if (!articles || articles.length === 0) {
            el.innerHTML = '<p class="empty-state">News will appear here as articles are published about your holdings.</p>';
            return;
        }

        el.innerHTML = articles.map(a => `
            <div class="news-item">
                <div class="news-item-header">
                    <span class="news-ticker-badge">${a.ticker}</span>
                    <span class="news-meta">${a.source} &middot; ${timeAgo(a.published_at)}</span>
                </div>
                <a href="${a.url}" target="_blank" rel="noopener noreferrer" class="news-headline">${a.headline}</a>
            </div>
        `).join('');
    } catch (err) {
        console.error('News load error:', err);
        el.innerHTML = '<p class="empty-state">Unable to load news at this time.</p>';
    }
}

/* ========================================
   Holdings
   ======================================== */

function initHoldings() {
    setupAccountPills(() => loadHoldings());

    const addBtn = document.getElementById('addHoldingBtn');
    const modal = document.getElementById('holdingModal');
    const closeBtn = document.getElementById('closeModal');
    const form = document.getElementById('holdingForm');
    const tickerInput = document.getElementById('tickerSearch');
    const searchResults = document.getElementById('searchResults');
    const exchangeSelect = document.getElementById('exchange');
    const currencySelect = document.getElementById('currency');

    // Load portfolios for the dropdown
    loadPortfolios();

    addBtn.addEventListener('click', () => {
        document.getElementById('modalTitle').textContent = 'Add Holding';
        document.getElementById('holdingId').value = '';
        form.reset();
        tickerInput.disabled = false;
        modal.style.display = 'flex';
    });

    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

    // Ticker search
    let searchTimeout;
    tickerInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = tickerInput.value.trim();
        if (q.length < 1) { searchResults.style.display = 'none'; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const results = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
                if (results.length === 0) { searchResults.style.display = 'none'; return; }
                searchResults.innerHTML = results.map(r => `
                    <div class="search-result-item" data-ticker="${r.ticker}" data-exchange="${r.exchange}" data-currency="${r.currency || ''}">
                        <span><span class="ticker">${r.ticker}</span></span>
                        <span class="name">${r.name}</span>
                    </div>
                `).join('');
                searchResults.style.display = 'block';

                searchResults.querySelectorAll('.search-result-item').forEach(item => {
                    item.addEventListener('click', () => {
                        tickerInput.value = item.dataset.ticker;
                        const ex = item.dataset.exchange || '';
                        if (ex.includes('Toronto') || ex.includes('TSX')) {
                            exchangeSelect.value = 'TSX';
                            currencySelect.value = 'CAD';
                        } else if (ex.includes('NASDAQ')) {
                            exchangeSelect.value = 'NASDAQ';
                            currencySelect.value = 'USD';
                        } else {
                            exchangeSelect.value = 'NYSE';
                            currencySelect.value = 'USD';
                        }
                        searchResults.style.display = 'none';
                    });
                });
            } catch (err) {
                console.error('Search error:', err);
            }
        }, 300);
    });

    // Close search on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-wrap')) searchResults.style.display = 'none';
    });

    // Event delegation for Edit / Delete buttons in the holdings table
    document.getElementById('holdingsBody').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const id = parseInt(btn.dataset.id, 10);
        if (btn.dataset.action === 'delete') {
            deleteHolding(id, btn.dataset.ticker);
        } else if (btn.dataset.action === 'edit') {
            editHolding(id, parseFloat(btn.dataset.shares), parseFloat(btn.dataset.avgcost), btn.dataset.ticker);
        }
    });

    // Form submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const holdingId = document.getElementById('holdingId').value;
        const ticker = tickerInput.value.trim().toUpperCase();
        const exchange = exchangeSelect.value;
        const currency = currencySelect.value;
        const portfolioId = document.getElementById('portfolio').value;
        const shares = document.getElementById('shares').value;
        const avgCost = document.getElementById('avgCost').value;

        // Strip .TO suffix if user typed it for TSX
        const cleanTicker = ticker.replace(/\.TO$/, '');

        try {
            if (holdingId) {
                await fetch(`/holdings/${holdingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ shares, avg_cost: avgCost })
                });
            } else {
                await fetch('/holdings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        portfolio_id: portfolioId,
                        ticker: cleanTicker,
                        exchange,
                        shares,
                        avg_cost: avgCost,
                        currency
                    })
                });
            }
            modal.style.display = 'none';
            loadHoldings();
        } catch (err) {
            console.error('Save error:', err);
        }
    });

    loadHoldings();
}

async function loadPortfolios() {
    try {
        const portfolios = await apiFetch('/portfolios');
        const select = document.getElementById('portfolio');
        select.innerHTML = portfolios.map(p =>
            `<option value="${p.id}">${p.name} (${p.account_type})</option>`
        ).join('');
    } catch (err) {
        console.error('Portfolio load error:', err);
    }
}

async function loadHoldings() {
    try {
        const holdings = await apiFetch('/api/holdings/data' + accountParam());
        const tbody = document.getElementById('holdingsBody');

        if (!holdings || holdings.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No holdings yet. Click "+ Add Holding" to get started.</td></tr>';
            return;
        }

        tbody.innerHTML = holdings.map(h => `
            <tr>
                <td><strong>${h.ticker}</strong><span style="color:var(--im-text-muted);font-size:0.75rem;margin-left:0.375rem;">${h.exchange}</span></td>
                <td>${h.account_type}</td>
                <td class="text-right mono">${parseFloat(h.shares).toFixed(2)}</td>
                <td class="text-right mono">${fmtCurrency(h.avg_cost)}</td>
                <td class="text-right mono">${h.current_price ? fmtCurrency(h.current_price) : '—'}</td>
                <td class="text-right mono">${h.current_yield ? fmtPct(h.current_yield) : '—'}</td>
                <td class="text-right mono">${fmtCurrency(h.annual_income_cad)}</td>
                <td class="text-right">
                    <button type="button" class="btn btn-ghost btn-sm" data-action="edit" data-id="${h.id}" data-shares="${parseFloat(h.shares)}" data-avgcost="${parseFloat(h.avg_cost)}" data-ticker="${h.ticker}">Edit</button>
                    <button type="button" class="btn btn-ghost btn-sm btn-danger" data-action="delete" data-id="${h.id}" data-ticker="${h.ticker}">Delete</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Holdings load error:', err);
        document.getElementById('holdingsBody').innerHTML = '<tr><td colspan="8" class="empty-state">Failed to load holdings</td></tr>';
    }
}

function editHolding(id, shares, avgCost, ticker) {
    document.getElementById('modalTitle').textContent = 'Edit Holding';
    document.getElementById('holdingId').value = id;
    document.getElementById('tickerSearch').value = ticker;
    document.getElementById('tickerSearch').disabled = true;
    document.getElementById('shares').value = shares;
    document.getElementById('avgCost').value = avgCost;
    document.getElementById('holdingModal').style.display = 'flex';
}

function deleteHolding(id, ticker) {
    const modal = document.getElementById('deleteModal');
    const tickerEl = document.getElementById('deleteTicker');
    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const cancelBtn = document.getElementById('deleteCancelBtn');

    tickerEl.textContent = ticker || 'this holding';
    modal.style.display = 'flex';

    // Clean up any previous listeners by replacing buttons
    const newConfirm = confirmBtn.cloneNode(true);
    const newCancel = cancelBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
    cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);

    newCancel.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', function handler(e) {
        if (e.target === modal) { modal.style.display = 'none'; modal.removeEventListener('click', handler); }
    });

    newConfirm.addEventListener('click', async () => {
        newConfirm.disabled = true;
        newConfirm.textContent = 'Removing…';
        try {
            const res = await fetch(`/holdings/${id}`, {
                method: 'DELETE',
                headers: { 'Accept': 'application/json' }
            });
            if (res.redirected || !res.ok) {
                if (res.status === 401 || res.redirected) {
                    alert('Session expired — please refresh the page and try again.');
                } else {
                    const data = await res.json().catch(() => ({}));
                    alert(data.error || 'Failed to delete holding');
                }
                return;
            }
            const data = await res.json().catch(() => null);
            if (!data || !data.success) {
                alert('Failed to delete holding');
                return;
            }
            loadHoldings();
        } catch (err) {
            console.error('Delete error:', err);
            alert('Network error — could not delete holding');
        } finally {
            modal.style.display = 'none';
            newConfirm.disabled = false;
            newConfirm.textContent = 'Remove';
        }
    });
}

/* ========================================
   Calendar
   ======================================== */

function initCalendar() {
    let calYear = new Date().getFullYear();
    const yearEl = document.getElementById('calYear');
    if (yearEl) yearEl.textContent = calYear;

    document.getElementById('prevYear').addEventListener('click', () => { calYear--; yearEl.textContent = calYear; loadCalendar(calYear); });
    document.getElementById('nextYear').addEventListener('click', () => { calYear++; yearEl.textContent = calYear; loadCalendar(calYear); });

    setupAccountPills(() => loadCalendar(calYear));
    loadCalendar(calYear);
}

async function loadCalendar(year) {
    try {
        const acctParam = currentAccount !== 'All' ? `&accountType=${encodeURIComponent(currentAccount)}` : '';
        const data = await apiFetch(`/api/calendar/data?year=${year}${acctParam}`);
        const grid = document.getElementById('calendarGrid');

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        grid.innerHTML = months.map(m => {
            const monthData = data.calendar[m];
            const payments = monthData.payments || [];
            return `
                <div class="calendar-month">
                    <div class="calendar-month-header">
                        <span class="calendar-month-name">${m}</span>
                        <span class="calendar-month-total">${monthData.total > 0 ? fmtCurrency(monthData.total) : '—'}</span>
                    </div>
                    ${payments.length > 0 ? payments.map(p => `
                        <div class="calendar-payment">
                            <span class="calendar-payment-ticker">${p.ticker}</span>
                            <span class="calendar-payment-amount">${fmtCurrency(p.amount)}</span>
                        </div>
                    `).join('') : '<p style="color:var(--im-text-muted);font-size:0.8125rem;text-align:center;padding:0.5rem 0;">No payments</p>'}
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('Calendar load error:', err);
    }
}

/* ========================================
   Projections
   ======================================== */

function initProjections() {
    // Pre-populate from dashboard data
    loadProjectionDefaults();

    let selectedYears = 10;
    document.querySelectorAll('.horizon-pills .pill').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.horizon-pills .pill').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedYears = parseInt(pill.dataset.years);
        });
    });

    document.getElementById('projectionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const body = {
            currentAnnualIncome: document.getElementById('currentIncome').value,
            portfolioValue: document.getElementById('portfolioVal').value,
            monthlyContribution: document.getElementById('monthlyContrib').value,
            dividendGrowthRate: document.getElementById('divGrowth').value,
            averageYield: document.getElementById('avgYield').value,
            years: selectedYears
        };

        try {
            const res = await fetch('/projections/calculate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await res.json();
            renderProjectionResults(data);
        } catch (err) {
            console.error('Projection error:', err);
        }
    });
}

async function loadProjectionDefaults() {
    try {
        const data = await apiFetch('/api/dashboard/summary');
        if (data.annualIncome) document.getElementById('currentIncome').value = data.annualIncome.toFixed(2);
        if (data.portfolioValue) document.getElementById('portfolioVal').value = data.portfolioValue.toFixed(2);
        if (data.weightedYield) document.getElementById('avgYield').value = data.weightedYield.toFixed(1);
    } catch (err) {
        // Silently fail — defaults remain
    }
}

let projChart = null;
function renderProjectionResults(data) {
    document.getElementById('projDripIncome').textContent = fmtCurrency(data.summary.finalIncomeWithDrip);
    document.getElementById('projNoDripIncome').textContent = fmtCurrency(data.summary.finalIncomeWithoutDrip);
    document.getElementById('projAdvantage').textContent = '+' + fmtCurrency(data.summary.dripAdvantage);

    const ctx = document.getElementById('projectionChart');
    if (!ctx) return;

    if (projChart) projChart.destroy();

    const green500 = '#4A9E74';
    const accent = '#C4883A';

    projChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.withDrip.map(d => `Year ${d.year}`),
            datasets: [
                {
                    label: 'With DRIP',
                    data: data.withDrip.map(d => d.annualIncome),
                    borderColor: green500,
                    backgroundColor: 'rgba(74, 158, 116, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                },
                {
                    label: 'Without DRIP',
                    data: data.withoutDrip.map(d => d.annualIncome),
                    borderColor: accent,
                    backgroundColor: 'rgba(196, 136, 58, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: 3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.dataset.label}: ${fmtCurrency(ctx.parsed.y)}` }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (v) => '$' + v.toLocaleString(),
                        font: { family: "'JetBrains Mono', monospace", size: 11 }
                    },
                    grid: { color: 'rgba(0,0,0,0.04)' }
                },
                x: { grid: { display: false } }
            }
        }
    });
}

/* ========================================
   Yield Tracker
   ======================================== */

function initYieldTracker() {
    setupAccountPills(() => loadYieldData());
    loadYieldData();
}

async function loadYieldData() {
    try {
        const data = await apiFetch('/api/yield-tracker/data' + accountParam());
        const tbody = document.getElementById('yieldBody');

        if (!data || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Add holdings to see yield on cost data</td></tr>';
            return;
        }

        tbody.innerHTML = data.map(h => {
            const yocHigher = h.yield_on_cost > h.current_yield;
            return `
                <tr>
                    <td><strong>${h.ticker}</strong><span style="color:var(--im-text-muted);font-size:0.75rem;margin-left:0.375rem;">${h.exchange}</span></td>
                    <td>${h.account_type}</td>
                    <td class="text-right mono">${fmtCurrency(h.avg_cost)}</td>
                    <td class="text-right mono">${h.current_price ? fmtCurrency(h.current_price) : '—'}</td>
                    <td class="text-right mono">${h.annual_dividend_per_share ? fmtCurrency(h.annual_dividend_per_share) : '—'}</td>
                    <td class="text-right mono">${fmtPct(h.current_yield)}</td>
                    <td class="text-right mono ${yocHigher ? 'yield-highlight' : ''}">${fmtPct(h.yield_on_cost)}</td>
                    <td class="text-right mono">${fmtCurrency(h.annual_income_cad)}</td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error('Yield data error:', err);
        document.getElementById('yieldBody').innerHTML = '<tr><td colspan="8" class="empty-state">Failed to load yield data</td></tr>';
    }
}
