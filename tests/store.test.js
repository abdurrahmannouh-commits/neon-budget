import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BudgetStore,
  computeSummary,
  computeCashflowSeries,
  computeCategoryBreakdown,
  computeBudgetProgress,
  filterTransactions,
  toCsv,
  getLastNMonths,
} from '../js/store.js';

const sampleTransactions = [
  { id: '1', type: 'income', title: 'Salary', amount: 3000, category: 'salary', date: '2026-10-01', note: '' },
  { id: '2', type: 'expense', title: 'Rent', amount: 1000, category: 'housing', date: '2026-10-02', note: '' },
  { id: '3', type: 'income', title: 'Salary', amount: 3600, category: 'salary', date: '2026-11-01', note: 'Raise' },
  { id: '4', type: 'expense', title: 'Rent', amount: 1000, category: 'housing', date: '2026-11-02', note: '' },
  { id: '5', type: 'expense', title: 'Groceries', amount: 440, category: 'food', date: '2026-11-05', note: 'Market, fresh' },
  { id: '6', type: 'expense', title: 'Internet', amount: 180, category: 'bills', date: '2026-11-08', note: '' },
];

test('computeSummary calculates totals, deltas, savings rate, and top category accurately', () => {
  const s = computeSummary(sampleTransactions, '2026-11');
  assert.equal(s.totalBalance, (3000 + 3600) - (1000 + 1000 + 440 + 180));
  assert.equal(s.monthIncome, 3600);
  assert.equal(s.monthExpense, 1620);
  assert.equal(s.netCashflow, 1980);
  assert.equal(Math.round(s.savingsRate), 55);
  assert.equal(Math.round(s.incomeDelta), 20);
  assert.equal(Math.round(s.expenseDelta), 62);
  assert.equal(s.topCategory, 'housing');
  assert.equal(s.topCategoryAmount, 1000);
  assert.equal(s.txCount, 4);
});

test('computeCashflowSeries aggregates income and expenses by month', () => {
  const series = computeCashflowSeries(sampleTransactions, ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(series, [
    { month: '2026-09', income: 0, expense: 0 },
    { month: '2026-10', income: 3000, expense: 1000 },
    { month: '2026-11', income: 3600, expense: 1620 },
  ]);
});

test('computeCategoryBreakdown sorts descending and sums percentages to 100%', () => {
  const breakdown = computeCategoryBreakdown(sampleTransactions, '2026-11');
  assert.equal(breakdown.length, 3);
  assert.equal(breakdown[0].categoryId, 'housing');
  assert.equal(breakdown[1].categoryId, 'food');
  assert.equal(breakdown[2].categoryId, 'bills');
  const totalPct = breakdown.reduce((sum, item) => sum + item.percentage, 0);
  assert.ok(Math.abs(totalPct - 100) < 0.001);
});

test('computeBudgetProgress flags ok, warn, and over statuses', () => {
  const progress = computeBudgetProgress(
    sampleTransactions,
    { housing: 900, food: 500, bills: 300 },
    '2026-11'
  );
  const housing = progress.find((p) => p.categoryId === 'housing');
  const food = progress.find((p) => p.categoryId === 'food');
  const bills = progress.find((p) => p.categoryId === 'bills');

  assert.equal(housing.status, 'over');
  assert.equal(housing.remaining, -100);
  assert.equal(food.status, 'warn');
  assert.equal(bills.status, 'ok');
});

test('filterTransactions supports query, type, category, month, and sorting', () => {
  const res = filterTransactions(sampleTransactions, {
    month: '2026-11',
    type: 'expense',
    sort: 'highest',
  });
  assert.deepEqual(
    res.map((t) => t.id),
    ['4', '5', '6']
  );

  const searchRes = filterTransactions(sampleTransactions, { query: 'grocer' });
  assert.equal(searchRes.length, 1);
  assert.equal(searchRes[0].id, '5');
});

test('toCsv escapes commas and quotes properly', () => {
  const csv = toCsv([sampleTransactions[4]]);
  const lines = csv.split('\n');
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('"Market, fresh"'));
});

test('BudgetStore supports CRUD, undo delete, and goal completion detection', () => {
  const mem = new Map();
  const mockStorage = {
    getItem: (k) => mem.get(k) ?? null,
    setItem: (k, v) => mem.set(k, v),
  };
  const store = new BudgetStore(mockStorage);
  const initialCount = store.state.transactions.length;

  const added = store.addTransaction({
    type: 'expense',
    title: 'Coffee',
    amount: 5.5,
    category: 'food',
    date: '2026-11-19',
  });
  assert.equal(store.state.transactions.length, initialCount + 1);

  store.deleteTransaction(added.id);
  assert.equal(store.state.transactions.length, initialCount);

  store.undoDelete();
  assert.equal(store.state.transactions.length, initialCount + 1);

  const goal = store.addGoal({ name: 'Test Goal', target: 100, current: 60 });
  const r1 = store.contributeGoal(goal.id, 20);
  assert.equal(r1.justCompleted, false);
  const r2 = store.contributeGoal(goal.id, 25);
  assert.equal(r2.justCompleted, true);
});

test('getLastNMonths returns N consecutive YYYY-MM keys', () => {
  const months = getLastNMonths(3, new Date(2026, 1, 15)); // Feb 2026
  assert.deepEqual(months, ['2025-12', '2026-01', '2026-02']);
});
