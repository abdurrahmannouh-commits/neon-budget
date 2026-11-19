function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

export function adaptSeriesColor(color) {
  const isLight = document.documentElement.dataset.theme === 'light';
  if (!isLight) return color;
  if (color.toLowerCase() === '#e4e4e7') return '#18181b';
  if (color.toLowerCase() === '#a1a1aa') return '#52525b';
  return color;
}

function getThemeColors() {
  const isLight = document.documentElement.dataset.theme === 'light';
  return {
    grid: isLight ? 'rgba(24, 24, 27, 0.08)' : 'rgba(255, 255, 255, 0.06)',
    axisText: isLight ? '#71717a' : '#71717a',
    axisActive: isLight ? '#09090b' : '#fafafa',
    guideLine: isLight ? 'rgba(24, 24, 27, 0.18)' : 'rgba(255, 255, 255, 0.18)',
    income: isLight ? '#16a34a' : '#22c55e',
    incomeFill: isLight ? 'rgba(22, 163, 74, 0.09)' : 'rgba(34, 197, 94, 0.11)',
    expense: isLight ? '#18181b' : '#e4e4e7',
    expenseFill: isLight ? 'rgba(24, 24, 27, 0.06)' : 'rgba(228, 228, 231, 0.07)',
    expenseBar: isLight ? '#3f3f46' : '#52525b',
    cardBg: isLight ? '#ffffff' : '#111113',
    donutTrack: isLight ? 'rgba(24, 24, 27, 0.06)' : 'rgba(255, 255, 255, 0.05)',
    hoverBand: isLight ? 'rgba(24, 24, 27, 0.035)' : 'rgba(255, 255, 255, 0.03)',
  };
}

export class CashflowChart {
  constructor(canvas, tooltipEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.tooltipEl = tooltipEl;
    this.data = [];
    this.mode = 'area';
    this.formatMoney = (v) => `$${v}`;
    this.labels = { income: 'Income', expense: 'Expense', net: 'Net' };
    this.monthNames = [];
    this.hoverIndex = -1;
    this.progress = 0;
    this.rafId = null;
    this.points = [];

    this._bindEvents();
    this._setupResize();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      this._handlePointer(e.clientX - rect.left, e.clientY - rect.top, rect);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.hoverIndex = -1;
      if (this.tooltipEl) this.tooltipEl.classList.remove('visible');
      this.draw(1);
    });
  }

  _setupResize() {
    if (typeof ResizeObserver === 'undefined') return;
    this.ro = new ResizeObserver(() => {
      this._resizeCanvas();
      this.draw(1);
    });
    this.ro.observe(this.canvas.parentElement);
  }

  _resizeCanvas() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(260, parent.clientWidth);
    const height = Math.max(220, parent.clientHeight || 256);
    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  update({ data, mode, formatMoney, monthNames, labels }) {
    this.data = data || [];
    this.mode = mode || 'area';
    this.formatMoney = formatMoney;
    this.monthNames = monthNames || [];
    this.labels = labels || this.labels;
    this._resizeCanvas();
    this._animate();
  }

  _animate() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const start = performance.now();
    const duration = 340;

    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      this.progress = easeOutCubic(t);
      this.draw(this.progress);
      if (t < 1) this.rafId = requestAnimationFrame(frame);
      else this.rafId = null;
    };
    this.rafId = requestAnimationFrame(frame);
  }

  _handlePointer(x, y, rect) {
    if (!this.points.length) return;
    let closest = -1;
    let minDist = Infinity;
    this.points.forEach((pt, idx) => {
      const d = Math.abs(x - pt.x);
      if (d < minDist) {
        minDist = d;
        closest = idx;
      }
    });

    if (closest !== -1 && minDist < 68) {
      if (this.hoverIndex !== closest) {
        this.hoverIndex = closest;
        this.draw(1);
      }
      this._showTooltip(closest, x, y, rect);
    } else {
      if (this.hoverIndex !== -1) {
        this.hoverIndex = -1;
        this.draw(1);
      }
      if (this.tooltipEl) this.tooltipEl.classList.remove('visible');
    }
  }

  _showTooltip(idx, x, y, rect) {
    if (!this.tooltipEl || !this.data[idx]) return;
    const item = this.data[idx];
    const [year, monthNum] = item.month.split('-').map(Number);
    const label = `${this.monthNames[monthNum - 1] || item.month} ${year}`;
    const net = item.income - item.expense;
    const netSign = net >= 0 ? '+' : '';

    this.tooltipEl.innerHTML = `
      <div class="tt-title">${label}</div>
      <div class="tt-row"><span class="tt-key"><i class="tt-dot income"></i>${this.labels.income}</span><strong>${this.formatMoney(item.income)}</strong></div>
      <div class="tt-row"><span class="tt-key"><i class="tt-dot expense"></i>${this.labels.expense}</span><strong>${this.formatMoney(item.expense)}</strong></div>
      <div class="tt-divider"></div>
      <div class="tt-row"><span>${this.labels.net}</span><strong class="${net >= 0 ? 'pos' : 'neg'}">${netSign}${this.formatMoney(net)}</strong></div>
    `;

    this.tooltipEl.classList.add('visible');
    const ttWidth = this.tooltipEl.offsetWidth || 180;
    const ttHeight = this.tooltipEl.offsetHeight || 100;
    let left = x + 16;
    if (left + ttWidth > rect.width - 8) left = x - ttWidth - 16;
    left = Math.max(8, left);
    const top = Math.max(8, Math.min(y - ttHeight / 2, rect.height - ttHeight - 8));

    this.tooltipEl.style.transform = `translate(${left}px, ${top}px)`;
  }

  _drawSmoothPath(ctx, pts) {
    if (!pts.length) return;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 0; i < pts.length - 1; i += 1) {
      const curr = pts[i];
      const next = pts[i + 1];
      const cx = (curr.x + next.x) / 2;
      ctx.bezierCurveTo(cx, curr.y, cx, next.y, next.x, next.y);
    }
  }

  draw(p = 1) {
    const ctx = this.ctx;
    const width = this.width || 500;
    const height = this.height || 256;
    const colors = getThemeColors();

    ctx.clearRect(0, 0, width, height);
    if (!this.data.length) return;

    const pad = { top: 16, right: 16, bottom: 30, left: 48 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxRaw = Math.max(100, ...this.data.map((d) => Math.max(d.income, d.expense)));
    const stepBase = Math.pow(10, Math.floor(Math.log10(maxRaw)));
    const maxVal = Math.ceil((maxRaw * 1.15) / (stepBase / 2)) * (stepBase / 2);

    const ticks = 4;
    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= ticks; i += 1) {
      const ratio = i / ticks;
      const y = Math.round(pad.top + chartH - ratio * chartH) + 0.5;
      const val = maxVal * ratio;

      ctx.save();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      if (i > 0) ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = colors.axisText;
      const compact = val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `${Math.round(val)}`;
      ctx.fillText(compact, pad.left - 10, y);
    }

    const n = this.data.length;
    const baseY = pad.top + chartH;

    this.points = this.data.map((d, i) => {
      const x =
        this.mode === 'bar'
          ? pad.left + ((i + 0.5) / n) * chartW
          : n === 1
            ? pad.left + chartW / 2
            : pad.left + (i / (n - 1)) * chartW;
      const incY = baseY - (d.income / maxVal) * chartH * p;
      const expY = baseY - (d.expense / maxVal) * chartH * p;
      return { x, incY, expY, data: d };
    });

    // X-axis labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    this.points.forEach((pt, i) => {
      const [, mNum] = pt.data.month.split('-').map(Number);
      const label = this.monthNames[mNum - 1] || pt.data.month;
      ctx.fillStyle = i === this.hoverIndex ? colors.axisActive : colors.axisText;
      ctx.font = i === this.hoverIndex
        ? '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
        : '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(label, pt.x, baseY + 10);
    });

    if (this.mode === 'bar') {
      const groupW = Math.min(48, (chartW / n) * 0.52);
      const barW = Math.max(8, (groupW - 4) / 2);

      this.points.forEach((pt, i) => {
        const isHover = i === this.hoverIndex;
        const alpha = this.hoverIndex === -1 || isHover ? 1 : 0.42;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (isHover) {
          ctx.fillStyle = colors.hoverBand;
          ctx.fillRect(pt.x - groupW / 2 - 8, pad.top, groupW + 16, chartH);
        }

        // Income bar
        const incH = Math.max(2, baseY - pt.incY);
        ctx.fillStyle = colors.income;
        this._roundRect(ctx, pt.x - barW - 2, pt.incY, barW, incH, [3, 3, 0, 0]);
        ctx.fill();

        // Expense bar
        const expH = Math.max(2, baseY - pt.expY);
        ctx.fillStyle = colors.expenseBar;
        this._roundRect(ctx, pt.x + 2, pt.expY, barW, expH, [3, 3, 0, 0]);
        ctx.fill();
        ctx.restore();
      });
    } else {
      const incPts = this.points.map((pt) => ({ x: pt.x, y: pt.incY }));
      const expPts = this.points.map((pt) => ({ x: pt.x, y: pt.expY }));

      // Subtle income area tint
      const gInc = ctx.createLinearGradient(0, pad.top, 0, baseY);
      gInc.addColorStop(0, colors.incomeFill);
      gInc.addColorStop(1, 'rgba(34, 197, 94, 0)');
      this._drawSmoothPath(ctx, incPts);
      ctx.lineTo(incPts[incPts.length - 1].x, baseY);
      ctx.lineTo(incPts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = gInc;
      ctx.fill();

      // Subtle expense area tint
      const gExp = ctx.createLinearGradient(0, pad.top, 0, baseY);
      gExp.addColorStop(0, colors.expenseFill);
      gExp.addColorStop(1, 'rgba(228, 228, 231, 0)');
      this._drawSmoothPath(ctx, expPts);
      ctx.lineTo(expPts[expPts.length - 1].x, baseY);
      ctx.lineTo(expPts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = gExp;
      ctx.fill();

      // Crisp lines (zero glow)
      this._drawSmoothPath(ctx, incPts);
      ctx.strokeStyle = colors.income;
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      this._drawSmoothPath(ctx, expPts);
      ctx.strokeStyle = colors.expense;
      ctx.lineWidth = 1.75;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.restore();

      // Hover crosshair & crisp ring points
      if (this.hoverIndex >= 0 && this.points[this.hoverIndex]) {
        const hp = this.points[this.hoverIndex];
        ctx.save();
        ctx.strokeStyle = colors.guideLine;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(hp.x) + 0.5, pad.top);
        ctx.lineTo(Math.round(hp.x) + 0.5, baseY);
        ctx.stroke();
        ctx.restore();

        this._drawPoint(ctx, hp.x, hp.incY, colors.income, colors.cardBg);
        this._drawPoint(ctx, hp.x, hp.expY, colors.expense, colors.cardBg);
      }
    }
  }

  _drawPoint(ctx, x, y, color, centerBg) {
    ctx.beginPath();
    ctx.arc(x, y, 4.2, 0, Math.PI * 2);
    ctx.fillStyle = centerBg;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const [tl, tr, br, bl] = (Array.isArray(r) ? r : [r, r, r, r]).map((v) => Math.min(v, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + tr);
    ctx.lineTo(x + w, y + h - br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - br, y + h);
    ctx.lineTo(x + bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - bl);
    ctx.lineTo(x, y + tl);
    ctx.quadraticCurveTo(x, y, x + tl, y);
    ctx.closePath();
  }
}

export class CategoryDonutChart {
  constructor(canvas, onHoverChange) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.onHoverChange = onHoverChange;
    this.segments = [];
    this.hoverIndex = -1;
    this.progress = 0;
    this.rafId = null;

    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const dist = Math.hypot(x, y);
      const outer = Math.min(rect.width, rect.height) * 0.44;
      const inner = outer * 0.68;

      if (dist < inner || dist > outer + 8 || !this.segments.length) {
        this.setHover(-1);
        return;
      }

      let angle = Math.atan2(y, x);
      if (angle < -Math.PI / 2) angle += Math.PI * 2;

      let found = -1;
      for (let i = 0; i < this.segments.length; i += 1) {
        const s = this.segments[i];
        if (angle >= s.startAngle && angle <= s.endAngle) {
          found = i;
          break;
        }
      }
      this.setHover(found);
    });

    this.canvas.addEventListener('mouseleave', () => this.setHover(-1));
  }

  setHover(index) {
    if (this.hoverIndex === index) return;
    this.hoverIndex = index;
    this.draw(1);
    if (this.onHoverChange) {
      this.onHoverChange(index >= 0 ? this.segments[index] : null, index);
    }
  }

  update(items) {
    const size = 204;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = size;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const total = items.reduce((acc, it) => acc + it.amount, 0);
    let cursor = -Math.PI / 2;
    const gap = items.length > 1 ? 0.022 : 0;

    this.segments = items.map((it) => {
      const span = total > 0 ? (it.amount / total) * Math.PI * 2 : 0;
      const startAngle = cursor + gap / 2;
      const endAngle = cursor + Math.max(0.015, span - gap / 2);
      cursor += span;
      return { ...it, startAngle, endAngle };
    });

    this.hoverIndex = -1;
    this._animate();
  }

  _animate() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const start = performance.now();
    const duration = 380;
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      this.progress = easeOutCubic(t);
      this.draw(this.progress);
      if (t < 1) this.rafId = requestAnimationFrame(frame);
      else this.rafId = null;
    };
    this.rafId = requestAnimationFrame(frame);
  }

  draw(p = 1) {
    const ctx = this.ctx;
    const size = this.size || 204;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.39;
    const lineWidth = 14;
    const colors = getThemeColors();

    ctx.clearRect(0, 0, size, size);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.strokeStyle = colors.donutTrack;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (!this.segments.length) return;

    const maxSweep = -Math.PI / 2 + Math.PI * 2 * p;

    this.segments.forEach((seg, idx) => {
      if (seg.startAngle >= maxSweep) return;
      const end = Math.min(seg.endAngle, maxSweep);
      const isHover = idx === this.hoverIndex;
      const isDimmed = this.hoverIndex !== -1 && !isHover;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, isHover ? radius + 2.5 : radius, seg.startAngle, end);
      ctx.strokeStyle = adaptSeriesColor(seg.color);
      ctx.lineWidth = isHover ? lineWidth + 3 : lineWidth;
      ctx.lineCap = 'butt';
      ctx.globalAlpha = isDimmed ? 0.28 : 1;
      ctx.stroke();
      ctx.restore();
    });
  }
}

export function renderSparklineSvg(values, color) {
  if (!values || values.length < 2) return '';
  const w = 72;
  const h = 24;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 3 - ((v - min) / span) * (h - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="sparkline-svg" aria-hidden="true">
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}
