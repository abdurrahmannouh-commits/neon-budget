function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function getThemeColors() {
  const isLight = document.documentElement.dataset.theme === 'light';
  return {
    grid: isLight ? 'rgba(15, 23, 42, 0.08)' : 'rgba(255, 255, 255, 0.06)',
    axisText: isLight ? '#64748b' : '#8b9bb4',
    guideLine: isLight ? 'rgba(15, 23, 42, 0.16)' : 'rgba(255, 255, 255, 0.18)',
    income: '#10f5a0',
    incomeDark: '#059669',
    expense: '#fb7185',
    expenseDark: '#e11d48',
    cardBg: isLight ? '#ffffff' : '#0f1626',
    donutTrack: isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.06)',
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this._handlePointer(x, y, rect);
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
    const height = Math.max(220, parent.clientHeight || 270);
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
    const duration = 580;

    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      this.progress = easeOutCubic(t);
      this.draw(this.progress);
      if (t < 1) {
        this.rafId = requestAnimationFrame(frame);
      } else {
        this.rafId = null;
      }
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

    if (closest !== -1 && minDist < 65) {
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
      <div class="tt-row"><span class="tt-dot income"></span><span>${this.labels.income}</span><strong>${this.formatMoney(item.income)}</strong></div>
      <div class="tt-row"><span class="tt-dot expense"></span><span>${this.labels.expense}</span><strong>${this.formatMoney(item.expense)}</strong></div>
      <div class="tt-divider"></div>
      <div class="tt-row"><span>${this.labels.net}</span><strong class="${net >= 0 ? 'pos' : 'neg'}">${netSign}${this.formatMoney(net)}</strong></div>
    `;

    this.tooltipEl.classList.add('visible');
    const ttWidth = this.tooltipEl.offsetWidth || 170;
    const ttHeight = this.tooltipEl.offsetHeight || 100;
    let left = x + 16;
    if (left + ttWidth > rect.width - 8) left = x - ttWidth - 16;
    left = Math.max(8, left);
    let top = Math.max(8, Math.min(y - ttHeight / 2, rect.height - ttHeight - 8));

    this.tooltipEl.style.transform = `translate(${left}px, ${top}px)`;
  }

  _drawSmoothPath(ctx, pts) {
    if (pts.length === 0) return;
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
    const height = this.height || 260;
    const colors = getThemeColors();
    const isLight = document.documentElement.dataset.theme === 'light';

    ctx.clearRect(0, 0, width, height);
    if (!this.data.length) return;

    const pad = { top: 20, right: 20, bottom: 34, left: 56 };
    const chartW = width - pad.left - pad.right;
    const chartH = height - pad.top - pad.bottom;

    const maxRaw = Math.max(
      100,
      ...this.data.map((d) => Math.max(d.income, d.expense))
    );
    const stepBase = Math.pow(10, Math.floor(Math.log10(maxRaw)));
    const maxVal = Math.ceil((maxRaw * 1.15) / (stepBase / 2)) * (stepBase / 2);

    // Horizontal grid & Y labels
    const ticks = 4;
    ctx.font = '500 11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    for (let i = 0; i <= ticks; i += 1) {
      const ratio = i / ticks;
      const y = pad.top + chartH - ratio * chartH;
      const val = maxVal * ratio;

      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(width - pad.right, y);
      ctx.stroke();

      ctx.fillStyle = colors.axisText;
      const compact = val >= 1000 ? `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}k` : `${Math.round(val)}`;
      ctx.fillText(compact, pad.left - 10, y);
    }

    const n = this.data.length;
    const baseY = pad.top + chartH;

    // Calculate point positions
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

    // X-axis month labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    this.points.forEach((pt, i) => {
      const [, mNum] = pt.data.month.split('-').map(Number);
      const label = this.monthNames[mNum - 1] || pt.data.month;
      ctx.fillStyle = i === this.hoverIndex ? (isLight ? '#0f172a' : '#f8fafc') : colors.axisText;
      ctx.font = i === this.hoverIndex ? '600 12px Inter, system-ui, sans-serif' : '500 11px Inter, system-ui, sans-serif';
      ctx.fillText(label, pt.x, baseY + 11);
    });

    const incColor = isLight ? colors.incomeDark : colors.income;
    const expColor = isLight ? colors.expenseDark : colors.expense;

    if (this.mode === 'bar') {
      const groupW = Math.min(54, (chartW / n) * 0.58);
      const barW = Math.max(8, (groupW - 6) / 2);

      this.points.forEach((pt, i) => {
        const isHover = i === this.hoverIndex;
        const alpha = this.hoverIndex === -1 || isHover ? 1 : 0.45;
        ctx.save();
        ctx.globalAlpha = alpha;

        if (isHover) {
          ctx.fillStyle = isLight ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.04)';
          this._roundRect(ctx, pt.x - groupW / 2 - 6, pad.top, groupW + 12, chartH, 10);
          ctx.fill();
        }

        // Income bar
        const incH = Math.max(2, baseY - pt.incY);
        const gInc = ctx.createLinearGradient(0, pt.incY, 0, baseY);
        gInc.addColorStop(0, incColor);
        gInc.addColorStop(1, isLight ? 'rgba(5, 150, 105, 0.25)' : 'rgba(16, 245, 160, 0.22)');
        ctx.fillStyle = gInc;
        if (isHover && !isLight) {
          ctx.shadowColor = 'rgba(16, 245, 160, 0.5)';
          ctx.shadowBlur = 14;
        }
        this._roundRect(ctx, pt.x - barW - 3, pt.incY, barW, incH, [6, 6, 2, 2]);
        ctx.fill();

        // Expense bar
        const expH = Math.max(2, baseY - pt.expY);
        const gExp = ctx.createLinearGradient(0, pt.expY, 0, baseY);
        gExp.addColorStop(0, expColor);
        gExp.addColorStop(1, isLight ? 'rgba(225, 29, 72, 0.25)' : 'rgba(251, 113, 133, 0.22)');
        ctx.fillStyle = gExp;
        if (isHover && !isLight) {
          ctx.shadowColor = 'rgba(251, 113, 133, 0.5)';
          ctx.shadowBlur = 14;
        }
        this._roundRect(ctx, pt.x + 3, pt.expY, barW, expH, [6, 6, 2, 2]);
        ctx.fill();
        ctx.restore();
      });
    } else {
      const incPts = this.points.map((pt) => ({ x: pt.x, y: pt.incY }));
      const expPts = this.points.map((pt) => ({ x: pt.x, y: pt.expY }));

      // Income area fill
      const gInc = ctx.createLinearGradient(0, pad.top, 0, baseY);
      gInc.addColorStop(0, isLight ? 'rgba(5, 150, 105, 0.24)' : 'rgba(16, 245, 160, 0.28)');
      gInc.addColorStop(1, 'rgba(16, 245, 160, 0)');
      this._drawSmoothPath(ctx, incPts);
      ctx.lineTo(incPts[incPts.length - 1].x, baseY);
      ctx.lineTo(incPts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = gInc;
      ctx.fill();

      // Expense area fill
      const gExp = ctx.createLinearGradient(0, pad.top, 0, baseY);
      gExp.addColorStop(0, isLight ? 'rgba(225, 29, 72, 0.2)' : 'rgba(251, 113, 133, 0.24)');
      gExp.addColorStop(1, 'rgba(251, 113, 133, 0)');
      this._drawSmoothPath(ctx, expPts);
      ctx.lineTo(expPts[expPts.length - 1].x, baseY);
      ctx.lineTo(expPts[0].x, baseY);
      ctx.closePath();
      ctx.fillStyle = gExp;
      ctx.fill();

      // Income glowing line
      ctx.save();
      this._drawSmoothPath(ctx, incPts);
      ctx.strokeStyle = incColor;
      ctx.lineWidth = 2.6;
      if (!isLight) {
        ctx.shadowColor = 'rgba(16, 245, 160, 0.55)';
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();

      // Expense glowing line
      ctx.save();
      this._drawSmoothPath(ctx, expPts);
      ctx.strokeStyle = expColor;
      ctx.lineWidth = 2.6;
      if (!isLight) {
        ctx.shadowColor = 'rgba(251, 113, 133, 0.55)';
        ctx.shadowBlur = 10;
      }
      ctx.stroke();
      ctx.restore();

      // Hover vertical guide & active dots
      if (this.hoverIndex >= 0 && this.points[this.hoverIndex]) {
        const hp = this.points[this.hoverIndex];
        ctx.save();
        ctx.strokeStyle = colors.guideLine;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(hp.x, pad.top);
        ctx.lineTo(hp.x, baseY);
        ctx.stroke();
        ctx.restore();

        this._drawGlowDot(ctx, hp.x, hp.incY, incColor, colors.cardBg);
        this._drawGlowDot(ctx, hp.x, hp.expY, expColor, colors.cardBg);
      } else {
        // Subtle data dots
        this.points.forEach((pt) => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.incY, 3, 0, Math.PI * 2);
          ctx.fillStyle = incColor;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(pt.x, pt.expY, 3, 0, Math.PI * 2);
          ctx.fillStyle = expColor;
          ctx.fill();
        });
      }
    }
  }

  _drawGlowDot(ctx, x, y, color, centerBg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(x, y, 4.8, 0, Math.PI * 2);
    ctx.fillStyle = centerBg;
    ctx.fill();
    ctx.lineWidth = 2.6;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const radii = Array.isArray(r) ? r : [r, r, r, r];
    const [tl, tr, br, bl] = radii.map((val) => Math.min(val, w / 2, h / 2));
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
      const inner = outer * 0.62;

      if (dist < inner || dist > outer + 10 || !this.segments.length) {
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

    this.canvas.addEventListener('mouseleave', () => {
      this.setHover(-1);
    });
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
    const size = 216;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.size = size;
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = `${size}px`;
    this.canvas.style.height = `${size}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const total = items.reduce((acc, it) => acc + it.amount, 0);
    let cursor = -Math.PI / 2;
    const gap = items.length > 1 ? 0.032 : 0;

    this.segments = items.map((it) => {
      const span = total > 0 ? (it.amount / total) * Math.PI * 2 : 0;
      const startAngle = cursor + gap / 2;
      const endAngle = cursor + Math.max(0.02, span - gap / 2);
      cursor += span;
      return { ...it, startAngle, endAngle };
    });

    this.hoverIndex = -1;
    this._animate();
  }

  _animate() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    const start = performance.now();
    const duration = 620;
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
    const size = this.size || 216;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.37;
    const lineWidth = 22;
    const colors = getThemeColors();
    const isLight = document.documentElement.dataset.theme === 'light';

    ctx.clearRect(0, 0, size, size);

    // Track ring
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
      ctx.arc(cx, cy, isHover ? radius + 4 : radius, seg.startAngle, end);
      ctx.strokeStyle = seg.color;
      ctx.lineWidth = isHover ? lineWidth + 4 : lineWidth;
      ctx.lineCap = 'round';
      ctx.globalAlpha = isDimmed ? 0.35 : 1;
      if (isHover && !isLight) {
        ctx.shadowColor = seg.color;
        ctx.shadowBlur = 16;
      }
      ctx.stroke();
      ctx.restore();
    });
  }
}

export function renderSparklineSvg(values, color) {
  if (!values || values.length < 2) return '';
  const w = 88;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * (w - 4) + 2;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  const gradId = `sg-${Math.random().toString(36).slice(2, 8)}`;
  const areaPts = `2,${h} ${pts.join(' ')} ${w - 2},${h}`;

  return `
    <svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="sparkline-svg" aria-hidden="true">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.32" />
          <stop offset="100%" stop-color="${color}" stop-opacity="0" />
        </linearGradient>
      </defs>
      <polygon points="${areaPts}" fill="url(#${gradId})" />
      <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

export function launchConfetti() {
  const canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const palette = ['#10f5a0', '#38bdf8', '#a855f7', '#fbbf24', '#fb7185'];
  const particles = Array.from({ length: 80 }, () => ({
    x: window.innerWidth / 2 + (Math.random() - 0.5) * 160,
    y: window.innerHeight * 0.45,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 14 - 4,
    size: Math.random() * 7 + 4,
    color: palette[Math.floor(Math.random() * palette.length)],
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 0.25,
    life: 1,
  }));

  const tick = () => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    let alive = 0;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.36;
      p.vx *= 0.99;
      p.rot += p.vrot;
      p.life -= 0.014;
      if (p.life > 0) {
        alive += 1;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
        ctx.restore();
      }
    }
    if (alive > 0) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
