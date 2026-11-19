# Mizan — Personal Finance Ledger

A restrained, matte-dark personal finance and budget application built with zero external dependencies, inspired by Linear and Mercury Bank. Designed with strict typographic hierarchy, hairline `1px` architecture, monochrome stroke icons, tabular monospace numerals, and interactive high-DPI Canvas charts.

## Design Principles (Zero AI Slop)
- **Matte Neutral Surfaces:** `#09090B` canvas, `#111113` panels, and crisp `#1F1F23` hairline dividers (plus Swiss-editorial Light Mode).
- **90/10 Color Discipline:** High-contrast monochrome UI chrome; semantic emerald/crimson reserved strictly for financial deltas and alerts.
- **Unified Monochrome SVG Icons:** Custom `1.6px`-stroke SVG icon system (`js/icons.js`) — zero emojis, zero gradients, zero blur orbs.
- **Tabular Monospace Numerals:** Every currency amount, date, percentage, and chart axis aligns cleanly.
- **Purposeful Motion:** Fast `140ms` state transitions and smooth numeric updates without distracting visual gimmicks.

## Features
- **Interactive Charts:** 6-month Cash Flow (Line / Bar toggle with hover crosshair tooltip) & Category Spending Donut with synchronized legend.
- **Monthly Budget Thresholds:** Category limits with clean warning (≥80%) and over-limit (≥100%) indicators.
- **Savings Goals:** Track dedicated reserves and allocate funds.
- **Transactions Ledger:** Instant search, filters, sorting, Undo delete, CSV export, and keyboard shortcut `N` to add entries.
- **Bilingual (Af-Soomaali / English)** & Multi-Currency (`USD`, `EUR`, `GBP`, `SOS`).

## Run Locally
```bash
npm start
# Open http://127.0.0.1:3000
```

## Run Tests
```bash
npm test
```
