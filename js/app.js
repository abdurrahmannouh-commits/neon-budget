import { TRANSLATIONS, CURRENCIES } from './i18n.js';
import {
  CATEGORIES,
  CATEGORY_MAP,
  BudgetStore,
  getLastNMonths,
  computeSummary,
  computeCashflowSeries,
  computeCategoryBreakdown,
  computeBudgetProgress,
  filterTransactions,
  toCsv,
} from './store.js';
import {
  CashflowChart,
  CategoryDonutChart,
  renderSparklineSvg,
  launchConfetti,
} from './charts.js';

const store = new BudgetStore();
const lastSixMonths = getLastNMonths(6);

const uiState = {
  view: 'dashboard',
  selectedMonth: lastSixMonths[lastSixMonths.length - 1],
  txFilters: {
    query: '',
    type: 'all',
    category: 'all',
    sort: 'newest',
  },
  txModalType: 'expense',
  selectedGoalEmoji: '🎯',
  prevNumbers: {
    balance: 0,
    income: 0,
    expense: 0,
    savingsRate: 0,
  },
  currentDonutTotal: 0,
};

let cashflowChart;
let donutChart;

function t(key) {
  const lang = store.state.settings.lang || 'so';
  const pack = TRANSLATIONS[lang] || TRANSLATIONS.so;
  return pack[key] ?? key;
}

function tCat(catId) {
  const lang = store.state.settings.lang || 'so';
  const pack = TRANSLATIONS[lang] || TRANSLATIONS.so;
  return pack.categories?.[catId] || catId;
}

function getMonthNames() {
  const lang = store.state.settings.lang || 'so';
  return (TRANSLATIONS[lang] || TRANSLATIONS.so).monthsShort;
}

function formatMoney(amount, { signed = false, compact = false } = {}) {
  const currKey = store.state.settings.currency || 'USD';
  const cfg = CURRENCIES[currKey] || CURRENCIES.USD;
  const num = Number(amount) || 0;
  const absVal = Math.abs(num);
  const sign = num < 0 ? '-' : signed && num > 0 ? '+' : '';

  if (compact && absVal >= 10000) {
    return `${sign}${cfg.symbol}${(absVal / 1000).toFixed(1)}k`;
  }

  const formatted = new Intl.NumberFormat(cfg.locale, {
    minimumFractionDigits: cfg.decimals,
    maximumFractionDigits: cfg.decimals,
  }).format(absVal);

  return `${sign}${cfg.symbol}${formatted}`;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function animateNumber(el, from, to, formatter, duration = 480) {
  if (!el) return;
  if (el._raf) cancelAnimationFrame(el._raf);
  const start = performance.now();
  const diff = to - from;

  const step = (now) => {
    const progress = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = formatter(from + diff * eased);
    if (progress < 1) {
      el._raf = requestAnimationFrame(step);
    } else {
      el.textContent = formatter(to);
      el._raf = null;
    }
  };
  el._raf = requestAnimationFrame(step);
}

function showToast(message, { undoAction = null } = {}) {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  if (undoAction) {
    const btn = document.createElement('button');
    btn.className = 'toast-undo';
    btn.textContent = t('toastUndo');
    btn.addEventListener('click', () => {
      undoAction();
      toast.remove();
    });
    toast.appendChild(btn);
  }

  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, undoAction ? 5000 : 3200);
}

function applyThemeAndI18n() {
  const { theme, lang, currency, chartMode } = store.state.settings;
  document.documentElement.dataset.theme = theme || 'dark';
  document.documentElement.lang = lang || 'so';

  const langLabel = document.getElementById('langLabel');
  if (langLabel) langLabel.textContent = (lang || 'so').toUpperCase();

  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) currencySelect.value = currency || 'USD';

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    el.textContent = t(key);
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    el.placeholder = t(key);
  });

  document.querySelectorAll('[data-chart-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.chartMode === (chartMode || 'area'));
  });

  populateMonthSelector();
  populateCategoryFilters();
}

function populateMonthSelector() {
  const select = document.getElementById('monthSelect');
  if (!select) return;
  const monthNames = getMonthNames();

  const available = new Set(lastSixMonths);
  store.state.transactions.forEach((tx) => {
    if (tx.date) available.add(tx.date.slice(0, 7));
  });

  const sortedMonths = Array.from(available).sort((a, b) => b.localeCompare(a));
  const options = [
    `<option value="all">${escapeHtml(t('allMonths'))}</option>`,
    ...sortedMonths.map((mKey) => {
      const [y, m] = mKey.split('-').map(Number);
      const label = `${monthNames[m - 1] || m} ${y}`;
      return `<option value="${mKey}">${escapeHtml(label)}</option>`;
    }),
  ];

  select.innerHTML = options.join('');
  select.value = sortedMonths.includes(uiState.selectedMonth) || uiState.selectedMonth === 'all'
    ? uiState.selectedMonth
    : sortedMonths[0] || 'all';
}

function populateCategoryFilters() {
  const catFilter = document.getElementById('txCategoryFilter');
  if (catFilter) {
    const current = uiState.txFilters.category;
    catFilter.innerHTML = [
      `<option value="all">${escapeHtml(t('allCategories'))}</option>`,
      ...CATEGORIES.map(
        (c) => `<option value="${c.id}">${c.icon} ${escapeHtml(tCat(c.id))}</option>`
      ),
    ].join('');
    catFilter.value = current;
  }
  populateTxModalCategories(uiState.txModalType);
}

function populateTxModalCategories(type, selectedId = null) {
  const select = document.getElementById('txCategoryInput');
  if (!select) return;
  const filtered = CATEGORIES.filter((c) => c.type === type);
  select.innerHTML = filtered
    .map((c) => `<option value="${c.id}">${c.icon} ${escapeHtml(tCat(c.id))}</option>`)
    .join('');
  if (selectedId && filtered.some((c) => c.id === selectedId)) {
    select.value = selectedId;
  }
}

function renderSavingsRing(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const r = 16;
  const circ = 2 * Math.PI * r;
  const offset = circ - (clamped / 100) * circ;
  return `
    <svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="rgba(168,85,247,0.18)" stroke-width="4" />
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="#a855f7" stroke-width="4"
        stroke-linecap="round" stroke-dasharray="${circ.toFixed(1)}" stroke-dashoffset="${offset.toFixed(1)}"
        transform="rotate(-90 20 20)" style="transition: stroke-dashoffset 0.7s cubic-bezier(0.22,1,0.36,1)" />
    </svg>
  `;
}

function renderDashboard() {
  const { transactions, budgets, settings } = store.state;
  const monthKey = uiState.selectedMonth;
  const summary = computeSummary(transactions, monthKey);
  const series = computeCashflowSeries(transactions, lastSixMonths);

  // Animate KPI values
  animateNumber(
    document.getElementById('kpiBalance'),
    uiState.prevNumbers.balance,
    summary.totalBalance,
    (v) => formatMoney(v)
  );
  animateNumber(
    document.getElementById('kpiIncome'),
    uiState.prevNumbers.income,
    summary.monthIncome,
    (v) => formatMoney(v)
  );
  animateNumber(
    document.getElementById('kpiExpense'),
    uiState.prevNumbers.expense,
    summary.monthExpense,
    (v) => formatMoney(v)
  );
  animateNumber(
    document.getElementById('kpiSavingsRate'),
    uiState.prevNumbers.savingsRate,
    summary.savingsRate,
    (v) => `${Math.round(v)}%`
  );

  uiState.prevNumbers = {
    balance: summary.totalBalance,
    income: summary.monthIncome,
    expense: summary.monthExpense,
    savingsRate: summary.savingsRate,
  };

  // KPI badges
  const netBadge = document.getElementById('kpiNetBadge');
  netBadge.textContent = formatMoney(summary.netCashflow, { signed: true });
  netBadge.className = `kpi-badge ${summary.netCashflow >= 0 ? 'pos' : 'neg'}`;
  document.getElementById('kpiBalanceSub').textContent = `${t('netCashflow')}: ${formatMoney(summary.netCashflow, { signed: true })}`;

  const incDeltaEl = document.getElementById('kpiIncomeDelta');
  if (summary.incomeDelta === null) {
    incDeltaEl.textContent = '—';
    incDeltaEl.className = 'kpi-badge neutral';
  } else {
    const sign = summary.incomeDelta >= 0 ? '+' : '';
    incDeltaEl.textContent = `${sign}${summary.incomeDelta.toFixed(1)}%`;
    incDeltaEl.className = `kpi-badge ${summary.incomeDelta >= 0 ? 'pos' : 'neg'}`;
  }

  const expDeltaEl = document.getElementById('kpiExpenseDelta');
  if (summary.expenseDelta === null) {
    expDeltaEl.textContent = '—';
    expDeltaEl.className = 'kpi-badge neutral';
  } else {
    const sign = summary.expenseDelta >= 0 ? '+' : '';
    expDeltaEl.textContent = `${sign}${summary.expenseDelta.toFixed(1)}%`;
    // Lower expense is positive!
    expDeltaEl.className = `kpi-badge ${summary.expenseDelta <= 0 ? 'pos' : 'neg'}`;
  }

  document.getElementById('kpiTxCountBadge').textContent = `${summary.txCount} tx`;
  document.getElementById('savingsMiniRing').innerHTML = renderSavingsRing(summary.savingsRate);

  // Sparklines
  const balanceCurve = [];
  let running = 0;
  series.forEach((s) => {
    running += s.income - s.expense;
    balanceCurve.push(running);
  });
  document.getElementById('sparkBalance').innerHTML = renderSparklineSvg(balanceCurve, '#38bdf8');
  document.getElementById('sparkIncome').innerHTML = renderSparklineSvg(
    series.map((s) => s.income),
    '#10f5a0'
  );
  document.getElementById('sparkExpense').innerHTML = renderSparklineSvg(
    series.map((s) => s.expense),
    '#fb7185'
  );

  // Cashflow Chart
  cashflowChart.update({
    data: series,
    mode: settings.chartMode || 'area',
    formatMoney: (v) => formatMoney(v),
    monthNames: getMonthNames(),
    labels: {
      income: t('income'),
      expense: t('expense'),
      net: t('netCashflow'),
    },
  });

  // Donut Chart & Legend
  const breakdown = computeCategoryBreakdown(transactions, monthKey);
  uiState.currentDonutTotal = breakdown.reduce((acc, item) => acc + item.amount, 0);
  donutChart.update(breakdown);
  updateDonutCenter(null);
  renderDonutLegend(breakdown);

  // Insights strip
  document.getElementById('insightDailySpend').textContent = formatMoney(summary.avgDailySpend);
  if (summary.topCategory) {
    const meta = CATEGORY_MAP[summary.topCategory];
    document.getElementById('insightTopCat').textContent = `${meta?.icon || ''} ${tCat(summary.topCategory)} (${formatMoney(summary.topCategoryAmount)})`;
  } else {
    document.getElementById('insightTopCat').textContent = '—';
  }
  const netFlowEl = document.getElementById('insightNetFlow');
  netFlowEl.textContent = formatMoney(summary.netCashflow, { signed: true });
  netFlowEl.style.color = summary.netCashflow >= 0 ? 'var(--neon-emerald)' : 'var(--neon-rose)';

  // Dashboard Budget Health (top 5 by ratio)
  const budgetItems = computeBudgetProgress(transactions, budgets, monthKey)
    .sort((a, b) => b.ratio - a.ratio)
    .slice(0, 5);
  renderBudgetBars(document.getElementById('dashboardBudgetsList'), budgetItems);

  // Recent Transactions (top 6)
  const recent = filterTransactions(transactions, {
    month: monthKey,
    sort: 'newest',
  }).slice(0, 6);
  renderTxList(document.getElementById('recentTxList'), recent, { compact: true });
}

function updateDonutCenter(hoveredSeg) {
  const labelEl = document.querySelector('.donut-center-label');
  const valEl = document.getElementById('donutCenterValue');
  const pctEl = document.getElementById('donutCenterPct');

  if (hoveredSeg) {
    labelEl.textContent = `${hoveredSeg.icon} ${tCat(hoveredSeg.categoryId)}`;
    valEl.textContent = formatMoney(hoveredSeg.amount);
    pctEl.textContent = `${hoveredSeg.percentage.toFixed(1)}%`;
    pctEl.style.color = hoveredSeg.color;
  } else {
    labelEl.textContent = t('totalSpent');
    valEl.textContent = formatMoney(uiState.currentDonutTotal);
    pctEl.textContent = uiState.currentDonutTotal > 0 ? '' : t('noSpendingData');
    pctEl.style.color = 'var(--text-muted)';
  }
}

function renderDonutLegend(items) {
  const ul = document.getElementById('donutLegend');
  if (!items.length) {
    ul.innerHTML = `<li class="empty-state">${escapeHtml(t('noSpendingData'))}</li>`;
    return;
  }

  ul.innerHTML = items
    .map(
      (it, idx) => `
      <li class="donut-legend-item" data-seg-idx="${idx}">
        <span class="legend-left">
          <span class="legend-swatch" style="background:${it.color}"></span>
          <span class="legend-name">${it.icon} ${escapeHtml(tCat(it.categoryId))}</span>
        </span>
        <span class="legend-val">${it.percentage.toFixed(0)}%</span>
      </li>
    `
    )
    .join('');

  ul.querySelectorAll('.donut-legend-item').forEach((li) => {
    const idx = Number(li.dataset.segIdx);
    li.addEventListener('mouseenter', () => donutChart.setHover(idx));
    li.addEventListener('mouseleave', () => donutChart.setHover(-1));
  });
}

function renderBudgetBars(container, items) {
  container.innerHTML = items
    .map((item) => {
      const statusClass = item.status === 'over' ? 'status-over' : item.status === 'warn' ? 'status-warn' : '';
      const footMsg =
        item.remaining >= 0
          ? `${formatMoney(item.remaining)} ${t('left')}`
          : `<span class="over">${formatMoney(Math.abs(item.remaining))} ${t('overBudget')}</span>`;

      return `
        <div class="budget-row">
          <div class="budget-row-top">
            <span class="budget-cat-title"><span>${item.icon}</span> ${escapeHtml(tCat(item.categoryId))}</span>
            <span class="budget-amounts"><strong>${formatMoney(item.spent)}</strong> / ${formatMoney(item.limit)}</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill ${statusClass}" data-target-width="${item.percent}%" style="background:${item.color}"></div>
          </div>
          <div class="budget-row-foot">
            <span>${item.rawPercent}% ${escapeHtml(t('used'))}</span>
            <span>${footMsg}</span>
          </div>
        </div>
      `;
    })
    .join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.progress-fill').forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
  });
}

function renderFullBudgets() {
  const container = document.getElementById('fullBudgetsGrid');
  const items = computeBudgetProgress(store.state.transactions, store.state.budgets, uiState.selectedMonth);

  container.innerHTML = items
    .map((item, idx) => {
      const statusClass = item.status === 'over' ? 'status-over' : item.status === 'warn' ? 'status-warn' : '';
      const footMsg =
        item.remaining >= 0
          ? `${formatMoney(item.remaining)} ${t('left')}`
          : `<span class="over">${formatMoney(Math.abs(item.remaining))} ${t('overBudget')}</span>`;

      return `
        <article class="glass-card budget-card" style="--stagger: ${idx}">
          <div class="budget-card-head">
            <div class="budget-cat-title">
              <span class="cat-badge-lg" style="background:${item.color}22; border: 1px solid ${item.color}44">${item.icon}</span>
              <div>
                <strong>${escapeHtml(tCat(item.categoryId))}</strong>
                <div class="card-subtitle">${item.rawPercent}% ${escapeHtml(t('used'))}</div>
              </div>
            </div>
            <button class="edit-limit-btn" data-edit-budget="${item.categoryId}">${escapeHtml(t('editLimit'))}</button>
          </div>

          <div class="budget-row">
            <div class="budget-row-top">
              <span class="budget-amounts"><strong>${formatMoney(item.spent)}</strong></span>
              <span class="budget-amounts">${formatMoney(item.limit)}</span>
            </div>
            <div class="progress-track">
              <div class="progress-fill ${statusClass}" data-target-width="${item.percent}%" style="background:${item.color}"></div>
            </div>
            <div class="budget-row-foot">
              <span>${footMsg}</span>
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.progress-fill').forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
  });

  container.querySelectorAll('[data-edit-budget]').forEach((btn) => {
    btn.addEventListener('click', () => openBudgetModal(btn.dataset.editBudget));
  });
}

function renderTxList(container, items, { compact = false } = {}) {
  if (!items.length) {
    container.innerHTML = `<div class="empty-state">${escapeHtml(t('emptyTransactions'))}</div>`;
    return;
  }

  container.innerHTML = items
    .map((tx) => {
      const cat = CATEGORY_MAP[tx.category] || { icon: '💳', color: '#94a3b8' };
      const sign = tx.type === 'income' ? '+' : '-';
      return `
        <div class="tx-item" data-tx-id="${tx.id}">
          <div class="tx-left">
            <span class="tx-icon" style="background:${cat.color}20; border: 1px solid ${cat.color}38">${cat.icon}</span>
            <div class="tx-info">
              <div class="tx-title">${escapeHtml(tx.title)}</div>
              <div class="tx-meta">
                <span>${escapeHtml(tCat(tx.category))}</span>
                <span>•</span>
                <span>${escapeHtml(tx.date)}</span>
                ${!compact && tx.note ? `<span>• ${escapeHtml(tx.note)}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="tx-right">
            <span class="tx-amount ${tx.type}">${sign}${formatMoney(tx.amount)}</span>
            <div class="tx-actions">
              <button class="action-icon-btn" data-edit-tx="${tx.id}" title="Edit" aria-label="Edit">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              </button>
              <button class="action-icon-btn danger" data-delete-tx="${tx.id}" title="Delete" aria-label="Delete">
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll('[data-edit-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tx = store.state.transactions.find((item) => item.id === btn.dataset.editTx);
      if (tx) openTxModal(tx);
    });
  });

  container.querySelectorAll('[data-delete-tx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const removed = store.deleteTransaction(btn.dataset.deleteTx);
      if (removed) {
        showToast(t('toastDeleted'), {
          undoAction: () => store.undoDelete(),
        });
      }
    });
  });
}

function renderFullTransactions() {
  const filtered = filterTransactions(store.state.transactions, {
    ...uiState.txFilters,
    month: uiState.selectedMonth,
  });
  renderTxList(document.getElementById('fullTxList'), filtered);
}

function renderGoals() {
  const grid = document.getElementById('goalsGrid');
  const goals = store.state.goals;

  grid.innerHTML = goals
    .map((g, idx) => {
      const pct = Math.min(100, Math.round((g.current / Math.max(1, g.target)) * 100));
      const complete = g.current >= g.target;
      const color = g.color || '#10f5a0';
      return `
        <article class="glass-card goal-card" style="--stagger: ${idx}">
          <div class="goal-top">
            <div class="goal-title-wrap">
              <span class="goal-emoji">${escapeHtml(g.icon)}</span>
              <div>
                <div class="goal-name">${escapeHtml(g.name)}</div>
                <div class="card-subtitle">${complete ? escapeHtml(t('goalCompleted')) : `${formatMoney(Math.max(0, g.target - g.current))} ${escapeHtml(t('left'))}`}</div>
              </div>
            </div>
            <span class="goal-pct-badge">${pct}%</span>
          </div>

          <div class="goal-numbers">
            <span class="goal-current">${formatMoney(g.current)}</span>
            <span class="goal-target">/ ${formatMoney(g.target)}</span>
          </div>

          <div class="progress-track">
            <div class="progress-fill" data-target-width="${pct}%" style="background: linear-gradient(90deg, ${color}, #38bdf8)"></div>
          </div>

          <div class="goal-footer">
            <button class="primary-btn" data-contribute-goal="${g.id}" style="padding: 7px 14px; font-size: 0.8rem">
              + ${escapeHtml(t('contribute'))}
            </button>
            <button class="action-icon-btn danger" data-delete-goal="${g.id}" title="Delete" aria-label="Delete goal">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
        </article>
      `;
    })
    .join('');

  requestAnimationFrame(() => {
    grid.querySelectorAll('.progress-fill').forEach((bar) => {
      bar.style.width = bar.dataset.targetWidth;
    });
  });

  grid.querySelectorAll('[data-contribute-goal]').forEach((btn) => {
    btn.addEventListener('click', () => openContributeModal(btn.dataset.contributeGoal));
  });

  grid.querySelectorAll('[data-delete-goal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.deleteGoal(btn.dataset.deleteGoal);
      showToast(t('toastDeleted'));
    });
  });
}

function renderAll() {
  applyThemeAndI18n();
  renderDashboard();
  renderFullTransactions();
  renderFullBudgets();
  renderGoals();
}

function switchView(viewName) {
  uiState.view = viewName;
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });
  document.querySelectorAll('.view-section').forEach((sec) => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });
  if (viewName === 'dashboard') {
    requestAnimationFrame(() => renderDashboard());
  }
}

/* ==================== MODALS ==================== */
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeAllModals() {
  document.querySelectorAll('.modal-backdrop.open').forEach((m) => m.classList.remove('open'));
}

function openTxModal(existingTx = null) {
  const titleEl = document.getElementById('txModalTitle');
  const idInput = document.getElementById('txIdInput');
  const amountInput = document.getElementById('txAmountInput');
  const dateInput = document.getElementById('txDateInput');
  const txTitleInput = document.getElementById('txTitleInput');
  const noteInput = document.getElementById('txNoteInput');

  if (existingTx) {
    titleEl.textContent = t('modalEditTx');
    idInput.value = existingTx.id;
    uiState.txModalType = existingTx.type;
    amountInput.value = existingTx.amount;
    dateInput.value = existingTx.date;
    txTitleInput.value = existingTx.title;
    noteInput.value = existingTx.note || '';
  } else {
    titleEl.textContent = t('modalAddTx');
    idInput.value = '';
    uiState.txModalType = 'expense';
    amountInput.value = '';
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateInput.value = `${yyyy}-${mm}-${dd}`;
    txTitleInput.value = '';
    noteInput.value = '';
  }

  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.txType === uiState.txModalType);
  });

  populateTxModalCategories(uiState.txModalType, existingTx?.category);
  openModal('txModal');
  setTimeout(() => amountInput.focus(), 80);
}

function openBudgetModal(categoryId) {
  const meta = CATEGORY_MAP[categoryId];
  document.getElementById('budgetModalTitle').textContent = `${meta?.icon || ''} ${tCat(categoryId)}`;
  document.getElementById('budgetCatInput').value = categoryId;
  document.getElementById('budgetLimitInput').value = store.state.budgets[categoryId] || 0;
  openModal('budgetModal');
  setTimeout(() => document.getElementById('budgetLimitInput').focus(), 80);
}

function openContributeModal(goalId) {
  const goal = store.state.goals.find((g) => g.id === goalId);
  if (!goal) return;
  document.getElementById('contributeModalTitle').textContent = `${goal.icon} ${goal.name}`;
  document.getElementById('contributeGoalId').value = goal.id;
  document.getElementById('contributeAmountInput').value = '';
  openModal('contributeModal');
  setTimeout(() => document.getElementById('contributeAmountInput').focus(), 80);
}

function exportCsvFile() {
  const filtered = filterTransactions(store.state.transactions, {
    month: uiState.selectedMonth,
    sort: 'newest',
  });
  const csv = toCsv(filtered);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `neon-budget-${uiState.selectedMonth}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast(t('toastExported'));
}

/* ==================== BOOTSTRAP ==================== */
function init() {
  cashflowChart = new CashflowChart(
    document.getElementById('cashflowCanvas'),
    document.getElementById('cashflowTooltip')
  );

  donutChart = new CategoryDonutChart(
    document.getElementById('donutCanvas'),
    (seg, idx) => {
      updateDonutCenter(seg);
      document.querySelectorAll('.donut-legend-item').forEach((li) => {
        li.classList.toggle('active', Number(li.dataset.segIdx) === idx);
      });
    }
  );

  // Navigation
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  document.querySelectorAll('[data-jump]').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.jump));
  });

  // Topbar controls
  document.getElementById('monthSelect').addEventListener('change', (e) => {
    uiState.selectedMonth = e.target.value;
    renderAll();
  });

  document.getElementById('currencySelect').addEventListener('change', (e) => {
    store.updateSettings({ currency: e.target.value });
  });

  document.getElementById('btnLangToggle').addEventListener('click', () => {
    const next = store.state.settings.lang === 'so' ? 'en' : 'so';
    store.updateSettings({ lang: next });
  });

  document.getElementById('btnThemeToggle').addEventListener('click', () => {
    const next = store.state.settings.theme === 'dark' ? 'light' : 'dark';
    store.updateSettings({ theme: next });
  });

  document.getElementById('btnAddTransaction').addEventListener('click', () => openTxModal());
  document.getElementById('btnExportCsv').addEventListener('click', exportCsvFile);
  document.getElementById('btnResetDemo').addEventListener('click', () => {
    if (window.confirm(t('confirmReset'))) {
      store.resetDemo();
      showToast(t('toastReset'));
    }
  });

  // Chart mode toggle
  document.querySelectorAll('[data-chart-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.updateSettings({ chartMode: btn.dataset.chartMode });
    });
  });

  // Transaction Filters
  document.getElementById('txSearch').addEventListener('input', (e) => {
    uiState.txFilters.query = e.target.value;
    renderFullTransactions();
  });

  document.querySelectorAll('#txTypeFilter [data-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.txFilters.type = btn.dataset.type;
      document.querySelectorAll('#txTypeFilter [data-type]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      renderFullTransactions();
    });
  });

  document.getElementById('txCategoryFilter').addEventListener('change', (e) => {
    uiState.txFilters.category = e.target.value;
    renderFullTransactions();
  });

  document.getElementById('txSortSelect').addEventListener('change', (e) => {
    uiState.txFilters.sort = e.target.value;
    renderFullTransactions();
  });

  // Transaction Modal
  document.querySelectorAll('[data-tx-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.txModalType = btn.dataset.txType;
      document.querySelectorAll('[data-tx-type]').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      populateTxModalCategories(uiState.txModalType);
    });
  });

  document.getElementById('txForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('txIdInput').value;
    const payload = {
      type: uiState.txModalType,
      title: document.getElementById('txTitleInput').value,
      amount: parseFloat(document.getElementById('txAmountInput').value),
      category: document.getElementById('txCategoryInput').value,
      date: document.getElementById('txDateInput').value,
      note: document.getElementById('txNoteInput').value,
    };

    if (id) {
      store.updateTransaction(id, payload);
      showToast(t('toastUpdated'));
    } else {
      store.addTransaction(payload);
      showToast(t('toastAdded'));
    }
    closeAllModals();
  });

  // Budget Limit Modal
  document.getElementById('budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const cat = document.getElementById('budgetCatInput').value;
    const limit = parseFloat(document.getElementById('budgetLimitInput').value);
    store.setBudgetLimit(cat, limit);
    showToast(t('toastBudgetUpdated'));
    closeAllModals();
  });

  // Goal Modals
  document.getElementById('btnAddGoal').addEventListener('click', () => {
    document.getElementById('goalForm').reset();
    openModal('goalModal');
    setTimeout(() => document.getElementById('goalNameInput').focus(), 80);
  });

  document.querySelectorAll('#goalEmojiPicker .emoji-opt').forEach((btn) => {
    btn.addEventListener('click', () => {
      uiState.selectedGoalEmoji = btn.dataset.emoji;
      document.querySelectorAll('#goalEmojiPicker .emoji-opt').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
    });
  });

  document.getElementById('goalForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const palette = ['#10f5a0', '#38bdf8', '#a855f7', '#fbbf24', '#fb7185'];
    store.addGoal({
      name: document.getElementById('goalNameInput').value,
      target: parseFloat(document.getElementById('goalTargetInput').value),
      current: parseFloat(document.getElementById('goalCurrentInput').value) || 0,
      icon: uiState.selectedGoalEmoji,
      color: palette[store.state.goals.length % palette.length],
    });
    showToast(t('toastGoalAdded'));
    closeAllModals();
  });

  document.getElementById('contributeForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('contributeGoalId').value;
    const amt = parseFloat(document.getElementById('contributeAmountInput').value);
    const res = store.contributeGoal(id, amt);
    closeAllModals();
    if (res?.justCompleted) {
      launchConfetti();
      showToast(t('toastGoalReached'));
    } else {
      showToast(t('toastGoalContributed'));
    }
  });

  // Close Modals
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', closeAllModals);
  });
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeAllModals();
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if ((e.key === 'n' || e.key === 'N') && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      openTxModal();
    }
  });

  store.subscribe(() => renderAll());
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);
