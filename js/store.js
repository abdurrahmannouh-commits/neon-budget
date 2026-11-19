export const CATEGORIES = [
  // Income
  { id: 'salary', type: 'income', icon: '💼', color: '#10f5a0' },
  { id: 'freelance', type: 'income', icon: '💻', color: '#38bdf8' },
  { id: 'investment', type: 'income', icon: '📈', color: '#a855f7' },
  { id: 'gift', type: 'income', icon: '🎁', color: '#fbbf24' },
  // Expense
  { id: 'housing', type: 'expense', icon: '🏠', color: '#818cf8' },
  { id: 'food', type: 'expense', icon: '🍽️', color: '#fb7185' },
  { id: 'transport', type: 'expense', icon: '🚗', color: '#38bdf8' },
  { id: 'bills', type: 'expense', icon: '⚡', color: '#fbbf24' },
  { id: 'shopping', type: 'expense', icon: '🛍️', color: '#e879f9' },
  { id: 'health', type: 'expense', icon: '🩺', color: '#34d399' },
  { id: 'education', type: 'expense', icon: '📚', color: '#60a5fa' },
  { id: 'entertainment', type: 'expense', icon: '🎮', color: '#f97316' },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

export function getMonthKey(dateStr) {
  return String(dateStr || '').slice(0, 7);
}

export function getLastNMonths(n = 6, refDate = new Date()) {
  const months = [];
  const baseYear = refDate.getFullYear();
  const baseMonth = refDate.getMonth();
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(baseYear, baseMonth - i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    months.push(`${yyyy}-${mm}`);
  }
  return months;
}

export function getPreviousMonthKey(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function generateDemoState(refDate = new Date()) {
  const months = getLastNMonths(6, refDate);
  const transactions = [];
  let seq = 1;

  const makeDate = (monthKey, day) => {
    const [y, m] = monthKey.split('-').map(Number);
    const maxDay = new Date(y, m, 0).getDate();
    const safeDay = Math.min(day, maxDay);
    return `${monthKey}-${String(safeDay).padStart(2, '0')}`;
  };

  const monthlyProfiles = [
    { salary: 2800, freelance: 450, housing: 950, food: 420, transport: 145, bills: 185, shopping: 210, health: 75, education: 90, entertainment: 130 },
    { salary: 2800, freelance: 620, housing: 950, food: 390, transport: 160, bills: 190, shopping: 280, health: 45, education: 90, entertainment: 155 },
    { salary: 2950, freelance: 380, housing: 950, food: 465, transport: 130, bills: 178, shopping: 165, health: 120, education: 110, entertainment: 95 },
    { salary: 2950, freelance: 710, housing: 950, food: 410, transport: 155, bills: 205, shopping: 310, health: 60, education: 90, entertainment: 140 },
    { salary: 3100, freelance: 540, housing: 950, food: 445, transport: 140, bills: 188, shopping: 190, health: 85, education: 120, entertainment: 125 },
    { salary: 3250, freelance: 840, housing: 950, food: 430, transport: 165, bills: 195, shopping: 245, health: 70, education: 140, entertainment: 115 },
  ];

  months.forEach((mKey, idx) => {
    const p = monthlyProfiles[idx] || monthlyProfiles[monthlyProfiles.length - 1];
    const isLatest = idx === months.length - 1;

    transactions.push(
      { id: `tx-${seq++}`, type: 'income', title: 'Mushaharka Bisha / Monthly Salary', amount: p.salary, category: 'salary', date: makeDate(mKey, 1), note: 'Direct deposit' },
      { id: `tx-${seq++}`, type: 'income', title: 'Mashruuc UI/UX Freelance', amount: p.freelance, category: 'freelance', date: makeDate(mKey, 12), note: 'Client milestone' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Kirada Guriga / Apartment Rent', amount: p.housing, category: 'housing', date: makeDate(mKey, 2), note: 'Monthly rent' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Adeegga Guriga / Supermarket', amount: Math.round(p.food * 0.62), category: 'food', date: makeDate(mKey, 5), note: 'Weekly groceries' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Maqaaxi & Qaxwo / Dining & Coffee', amount: Math.round(p.food * 0.38), category: 'food', date: makeDate(mKey, 14), note: 'Friends dinner' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Koronto & Fiber Internet', amount: p.bills, category: 'bills', date: makeDate(mKey, 6), note: 'Utilities & Wi-Fi' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Shidaal & Gaadiid / Fuel & Rides', amount: p.transport, category: 'transport', date: makeDate(mKey, 9), note: 'Commute' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Dhar & Qalab / Shopping', amount: p.shopping, category: 'shopping', date: makeDate(mKey, 16), note: 'Essentials' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Koorso Online & Buugaag', amount: p.education, category: 'education', date: makeDate(mKey, 11), note: 'Skill upgrade' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Farmashiye & Gym', amount: p.health, category: 'health', date: makeDate(mKey, 13), note: 'Wellness' },
      { id: `tx-${seq++}`, type: 'expense', title: 'Filimaan & Ciyaaro', amount: p.entertainment, category: 'entertainment', date: makeDate(mKey, 18), note: 'Subscriptions' },
    );

    if (isLatest) {
      transactions.push({
        id: `tx-${seq++}`,
        type: 'income',
        title: 'Faa’iido Maalgashi / ETF Dividend',
        amount: 215,
        category: 'investment',
        date: makeDate(mKey, 15),
        note: 'Quarterly payout',
      });
    }
  });

  return {
    version: 1,
    settings: {
      lang: 'so',
      theme: 'dark',
      currency: 'USD',
      chartMode: 'area',
    },
    transactions,
    budgets: {
      housing: 1000,
      food: 500,
      transport: 200,
      bills: 220,
      shopping: 250,
      health: 120,
      education: 180,
      entertainment: 150,
    },
    goals: [
      { id: 'goal-1', name: 'Sanduuqa Degdegga / Emergency Fund', target: 5000, current: 3650, icon: '🛡️', color: '#10f5a0' },
      { id: 'goal-2', name: 'MacBook / Workstation Cusub', target: 2200, current: 1480, icon: '💻', color: '#38bdf8' },
      { id: 'goal-3', name: 'Safar Fasax / Holiday Trip', target: 1800, current: 920, icon: '✈️', color: '#a855f7' },
    ],
  };
}

export function computeSummary(transactions, monthKey) {
  let totalIncomeAll = 0;
  let totalExpenseAll = 0;
  let monthIncome = 0;
  let monthExpense = 0;
  let prevIncome = 0;
  let prevExpense = 0;
  let txCount = 0;

  const isAll = !monthKey || monthKey === 'all';
  const prevKey = isAll ? null : getPreviousMonthKey(monthKey);
  const catSpend = {};

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    const txMonth = getMonthKey(tx.date);

    if (tx.type === 'income') totalIncomeAll += amt;
    else totalExpenseAll += amt;

    if (isAll || txMonth === monthKey) {
      txCount += 1;
      if (tx.type === 'income') {
        monthIncome += amt;
      } else {
        monthExpense += amt;
        catSpend[tx.category] = (catSpend[tx.category] || 0) + amt;
      }
    } else if (prevKey && txMonth === prevKey) {
      if (tx.type === 'income') prevIncome += amt;
      else prevExpense += amt;
    }
  }

  const totalBalance = totalIncomeAll - totalExpenseAll;
  const netCashflow = monthIncome - monthExpense;
  const savingsRate = monthIncome > 0 ? Math.max(0, ((monthIncome - monthExpense) / monthIncome) * 100) : 0;

  const incomeDelta = prevIncome > 0 ? ((monthIncome - prevIncome) / prevIncome) * 100 : null;
  const expenseDelta = prevExpense > 0 ? ((monthExpense - prevExpense) / prevExpense) * 100 : null;

  let daysDivisor = 30;
  if (!isAll && monthKey) {
    const [y, m] = monthKey.split('-').map(Number);
    const now = new Date();
    const isCurrentMonth = now.getFullYear() === y && now.getMonth() + 1 === m;
    daysDivisor = isCurrentMonth ? Math.max(1, now.getDate()) : new Date(y, m, 0).getDate();
  } else {
    const uniqueMonths = new Set(transactions.map((t) => getMonthKey(t.date)));
    daysDivisor = Math.max(1, uniqueMonths.size * 30);
  }

  const avgDailySpend = monthExpense / daysDivisor;

  let topCategory = null;
  let topAmount = 0;
  for (const [cat, amt] of Object.entries(catSpend)) {
    if (amt > topAmount) {
      topAmount = amt;
      topCategory = cat;
    }
  }

  return {
    totalBalance,
    monthIncome,
    monthExpense,
    prevIncome,
    prevExpense,
    incomeDelta,
    expenseDelta,
    savingsRate,
    netCashflow,
    avgDailySpend,
    topCategory,
    topCategoryAmount: topAmount,
    txCount,
  };
}

export function computeCashflowSeries(transactions, months) {
  const map = new Map(months.map((m) => [m, { month: m, income: 0, expense: 0 }]));
  for (const tx of transactions) {
    const mKey = getMonthKey(tx.date);
    const entry = map.get(mKey);
    if (!entry) continue;
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') entry.income += amt;
    else entry.expense += amt;
  }
  return Array.from(map.values());
}

export function computeCategoryBreakdown(transactions, monthKey) {
  const isAll = !monthKey || monthKey === 'all';
  const totals = {};
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!isAll && getMonthKey(tx.date) !== monthKey) continue;
    const amt = Number(tx.amount) || 0;
    totals[tx.category] = (totals[tx.category] || 0) + amt;
    grandTotal += amt;
  }

  return Object.entries(totals)
    .map(([categoryId, amount]) => {
      const meta = CATEGORY_MAP[categoryId] || { id: categoryId, icon: '📌', color: '#94a3b8' };
      return {
        categoryId,
        icon: meta.icon,
        color: meta.color,
        amount,
        percentage: grandTotal > 0 ? (amount / grandTotal) * 100 : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export function computeBudgetProgress(transactions, budgets, monthKey) {
  const spentMap = {};
  const isAll = !monthKey || monthKey === 'all';

  for (const tx of transactions) {
    if (tx.type !== 'expense') continue;
    if (!isAll && getMonthKey(tx.date) !== monthKey) continue;
    spentMap[tx.category] = (spentMap[tx.category] || 0) + (Number(tx.amount) || 0);
  }

  const expenseCategories = CATEGORIES.filter((c) => c.type === 'expense');
  return expenseCategories.map((cat) => {
    const limit = Number(budgets[cat.id]) || 0;
    const spent = spentMap[cat.id] || 0;
    const ratio = limit > 0 ? spent / limit : 0;
    const remaining = limit - spent;
    let status = 'ok';
    if (limit > 0 && ratio >= 1) status = 'over';
    else if (limit > 0 && ratio >= 0.8) status = 'warn';

    return {
      categoryId: cat.id,
      icon: cat.icon,
      color: cat.color,
      limit,
      spent,
      remaining,
      ratio,
      percent: Math.min(100, Math.round(ratio * 100)),
      rawPercent: Math.round(ratio * 100),
      status,
    };
  });
}

export function filterTransactions(transactions, { query = '', type = 'all', category = 'all', month = 'all', sort = 'newest' } = {}) {
  const q = query.trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    if (type !== 'all' && tx.type !== type) return false;
    if (category !== 'all' && tx.category !== category) return false;
    if (month !== 'all' && getMonthKey(tx.date) !== month) return false;
    if (q) {
      const hay = `${tx.title} ${tx.note || ''} ${tx.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return filtered.sort((a, b) => {
    if (sort === 'oldest') return a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
    if (sort === 'highest') return b.amount - a.amount;
    if (sort === 'lowest') return a.amount - b.amount;
    return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
  });
}

export function toCsv(transactions) {
  const header = ['ID', 'Date', 'Type', 'Category', 'Title', 'Amount', 'Note'];
  const escape = (val) => {
    const str = String(val ?? '');
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
  };
  const rows = transactions.map((tx) =>
    [tx.id, tx.date, tx.type, tx.category, tx.title, tx.amount, tx.note || ''].map(escape).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

const STORAGE_KEY = 'neon_budget_state_v1';

export class BudgetStore {
  constructor(storage = typeof globalThis.localStorage !== 'undefined' ? globalThis.localStorage : null) {
    this.storage = storage;
    this.state = this.load();
    this.listeners = new Set();
    this.lastDeleted = null;
  }

  load() {
    if (this.storage) {
      try {
        const raw = this.storage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.transactions)) {
            return parsed;
          }
        }
      } catch {
        // Fallback to demo state if corrupted
      }
    }
    const fresh = generateDemoState();
    this.persist(fresh);
    return fresh;
  }

  persist(state = this.state) {
    if (!this.storage) return;
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Ignore storage quota errors
    }
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  notify() {
    this.persist();
    for (const fn of this.listeners) fn(this.state);
  }

  updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.notify();
  }

  addTransaction(tx) {
    const item = {
      id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: tx.type === 'income' ? 'income' : 'expense',
      title: String(tx.title || '').trim(),
      amount: Math.max(0, Number(tx.amount) || 0),
      category: tx.category,
      date: tx.date,
      note: String(tx.note || '').trim(),
    };
    this.state.transactions.unshift(item);
    this.notify();
    return item;
  }

  updateTransaction(id, patch) {
    const idx = this.state.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    this.state.transactions[idx] = {
      ...this.state.transactions[idx],
      ...patch,
      amount: Math.max(0, Number(patch.amount ?? this.state.transactions[idx].amount) || 0),
    };
    this.notify();
    return this.state.transactions[idx];
  }

  deleteTransaction(id) {
    const idx = this.state.transactions.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    const [removed] = this.state.transactions.splice(idx, 1);
    this.lastDeleted = { item: removed, index: idx };
    this.notify();
    return removed;
  }

  undoDelete() {
    if (!this.lastDeleted) return null;
    const { item, index } = this.lastDeleted;
    this.state.transactions.splice(Math.min(index, this.state.transactions.length), 0, item);
    this.lastDeleted = null;
    this.notify();
    return item;
  }

  setBudgetLimit(categoryId, limit) {
    this.state.budgets[categoryId] = Math.max(0, Number(limit) || 0);
    this.notify();
  }

  addGoal({ name, target, current = 0, icon = '🎯', color = '#10f5a0' }) {
    const goal = {
      id: `goal-${Date.now()}`,
      name: String(name || '').trim(),
      target: Math.max(1, Number(target) || 100),
      current: Math.max(0, Number(current) || 0),
      icon,
      color,
    };
    this.state.goals.push(goal);
    this.notify();
    return goal;
  }

  contributeGoal(id, amount) {
    const goal = this.state.goals.find((g) => g.id === id);
    if (!goal) return null;
    const wasComplete = goal.current >= goal.target;
    goal.current = Math.max(0, goal.current + (Number(amount) || 0));
    const justCompleted = !wasComplete && goal.current >= goal.target;
    this.notify();
    return { goal, justCompleted };
  }

  deleteGoal(id) {
    this.state.goals = this.state.goals.filter((g) => g.id !== id);
    this.notify();
  }

  resetDemo() {
    const currentSettings = { ...this.state.settings };
    this.state = generateDemoState();
    this.state.settings = currentSettings;
    this.lastDeleted = null;
    this.notify();
  }
}
