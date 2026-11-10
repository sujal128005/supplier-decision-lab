/*
 * app.js
 * Screens, charts and controls of the Supplier Decision Lab.
 * One shared state object; every control changes the state and redraws the open tab.
 */
(function (S) {
  "use strict";

  const COLORS = { s: ["#c0632c", "#2b6f9e", "#7d8a93"], ink: "#1b2327", muted: "#56636a", ok: "#2e7d4f", warn: "#a86b12", bad: "#b23b3b" };
  const NAMES = ["Supplier 1", "Supplier 2", "Supplier 3"];
  const SHORT_ATTR = { DeliveryTime: "Delivery", Price: "Price", Availability: "Avail.", Aftersales: "Aftersales", Quality: "Quality", Sustainability: "Sustain." };

  const deep = o => JSON.parse(JSON.stringify(o));
  const state = {
    J: S.copyJudgments(S.PAPER_JUDGMENTS), mode: "paper", measured: deep(S.MEASURED_DEFAULT),
    wC1: 0.5, prio: [4, 4, 4], split: 50, plan: deep(S.PLAN_DEFAULT),
    mc: { steps: 1, range: [0.1, 0.9], runs: 5000 }
  };

  const $ = id => document.getElementById(id);
  const fmt = (x, d = 3) => x.toFixed(d);
  const pct = (x, d = 0) => (x * 100).toFixed(d) + "%";
  const eur = x => "€" + Math.round(x).toLocaleString("en-US");

  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 14;
  Chart.defaults.color = COLORS.muted;
  Chart.defaults.borderColor = "#e4e7e6";
  Chart.defaults.plugins.legend.display = false;
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.animation.duration = 250;
  const axisTitle = text => ({ display: true, text, color: COLORS.ink, font: { size: 15, weight: 600 } });
  const legendBottom = extra => ({ display: true, position: "bottom", labels: Object.assign({ boxWidth: 14, font: { size: 15 }, color: COLORS.ink, padding: 14 }, extra || {}) });

  /* shaded x-ranges and vertical marker lines on a linear-x chart */
  Chart.register({
    id: "markers",
    beforeDatasetsDraw(chart, _a, opts) {
      const { ctx, chartArea: a, scales: { x } } = chart;
      (opts.bands || []).forEach(b => {
        ctx.save(); ctx.fillStyle = b.color;
        ctx.fillRect(x.getPixelForValue(b.from), a.top, x.getPixelForValue(b.to) - x.getPixelForValue(b.from), a.bottom - a.top);
        ctx.restore();
      });
    },
    afterDatasetsDraw(chart, _a, opts) {
      const { ctx, chartArea: a, scales: { x } } = chart;
      (opts.lines || []).forEach(l => {
        const px = x.getPixelForValue(l.x);
        ctx.save(); ctx.strokeStyle = l.color; ctx.lineWidth = l.width || 1.2; ctx.setLineDash(l.dash || []);
        ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
        if (l.label) {
          ctx.setLineDash([]); ctx.font = "600 14px " + Chart.defaults.font.family; ctx.fillStyle = l.color;
          const w = ctx.measureText(l.label).width;
          const tx = l.left ? px - w - 6 : px + 5;
          ctx.fillText(l.label, Math.min(Math.max(tx, a.left + 2), a.right - w - 2), a.top + 16 + (l.row || 0) * 18);
        }
        ctx.restore();
      });
    }
  });

  const charts = {};
  function chart(id, config) {
    if (charts[id]) { charts[id].data = config.data; charts[id].options = config.options; charts[id].update(); return; }
    charts[id] = new Chart($(id), config);
  }
  function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
  const hatchCache = {};
  function hatch(color) {
    if (hatchCache[color]) return hatchCache[color];
    const c = document.createElement("canvas"); c.width = c.height = 8;
    const x = c.getContext("2d");
    x.fillStyle = hexA(color, 0.18); x.fillRect(0, 0, 8, 8);
    x.strokeStyle = color; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, 8); x.lineTo(8, 0); x.moveTo(-2, 2); x.lineTo(2, -2); x.moveTo(6, 10); x.lineTo(10, 6); x.stroke();
    return (hatchCache[color] = x.createPattern(c, "repeat"));
  }

  /* ================================================================ PAPER'S MODEL */
  function renderSuppliers() {
    const m = state.measured;
    $("supplierCards").innerHTML = S.SUPPLIERS.map((s, i) => `
      <div class="card sup-card" style="--c:${COLORS.s[i]}">
        <div class="sc-top"><span class="sc-name">${s.name}</span><span class="sc-place">${s.place.replace("Czech Republic, ", "Czech, ")}</span></div>
        <dl>
          <dt>Price per rod</dt><dd>${eur(m.price[i])}</dd>
          <dt>Delivery time</dt><dd>${m.leadDays[i]} days</dd>
          <dt>Bad parts (2018)</dt><dd>${m.defect2018[i].toFixed(2)}%</dd>
        </dl>
      </div>`).join("");
  }

  function renderRepro() {
    const ps = { J: state.J, mode: "paper", measured: state.measured };
    const ahp = S.evaluate(ps, 0.5).total, anp = S.evaluate(ps, 1 / 6).total, P = S.PAPER_RESULTS;
    const close = (a, b) => a.every((x, i) => Math.abs(x - b[i]) < 5e-4);
    const row = (label, arr, tag) => `<tr class="${tag ? "match" : ""}"><td>${label}${tag ? ' <span class="pill ok">match</span>' : ""}</td>${arr.map(x => `<td class="n">${fmt(x, 4)}</td>`).join("")}<td><span class="dot s${S.rankOf(arr)[0] + 1}"></span>S${S.rankOf(arr)[0] + 1}</td></tr>`;
    $("reproTable").innerHTML = `<thead><tr><th>Method</th><th class="n">S1</th><th class="n">S2</th><th class="n">S3</th><th>Winner</th></tr></thead><tbody>
      ${row("Paper AHP", P.AHP)}${row("Rebuilt, 1 : 1", ahp, close(ahp, P.AHP))}
      ${row("Paper ANP", P.ANP)}${row("Rebuilt, 1 : 5", anp, close(anp, P.ANP))}</tbody>`;
  }

  function renderTree() {
    const ev = S.evaluate(state);
    const w1 = S.priorities(state.J.C1.m).p, w2 = S.priorities(state.J.C2.m).p;
    const W = 660, H = 360;
    const xs = [60, 170, 280, 380, 490, 600], gx = [170, 490], sx = [130, 330, 530];
    const line = (x1, y1, x2, y2, c, o) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c || "#b4bcb9"}" stroke-width="1.3" opacity="${o || 1}"/>`;
    const box = (x, y, w, h, t, sub, fill, stroke, sw) => `<rect x="${x - w / 2}" y="${y}" width="${w}" height="${h}" rx="7" fill="${fill}" stroke="${stroke}" stroke-width="${sw || 1.3}"/>
      <text x="${x}" y="${y + (sub ? 20 : h / 2 + 6)}" text-anchor="middle" font-size="15" font-weight="600" fill="#1b2327">${t}</text>
      ${sub ? `<text x="${x}" y="${y + 39}" text-anchor="middle" font-size="14" fill="#56636a" font-family="Plex Mono, monospace">${sub}</text>` : ""}`;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" font-family="Plex Sans, Segoe UI, sans-serif" role="img" aria-label="Decision tree">`;
    gx.forEach(x => { s += line(330, 44, x, 74); });
    xs.forEach((x, i) => { s += line(gx[i < 3 ? 0 : 1], 124, x, 162); });
    xs.forEach(x => sx.forEach((t, j) => { s += line(x, 214, t, 282, COLORS.s[j], 0.35); }));
    s += box(330, 6, 300, 38, "Choose copper rod supplier", "", "#f6ece2", "#d9b393");
    s += box(gx[0], 74, 270, 50, "C1 Logistic-Economic", `weight ${fmt(state.wC1, 2)}`, "#e7eef4", "#a9c0d3");
    s += box(gx[1], 74, 270, 50, "C2 Quality-Sustain.", `weight ${fmt(1 - state.wC1, 2)}`, "#f3ece2", "#d4bc9c");
    S.ATTR_ORDER.forEach((a, i) => { s += box(xs[i], 162, 100, 52, SHORT_ATTR[a], fmt(i < 3 ? w1[i] : w2[i - 3], 2), "#fff", i < 3 ? "#a9c0d3" : "#d4bc9c"); });
    sx.forEach((x, j) => { s += box(x, 282, 170, 56, NAMES[j], `score ${fmt(ev.total[j])}`, "#fff", COLORS.s[j], 2.2); });
    $("treeWrap").innerHTML = s + "</svg>";
  }

  function crPill(cr) { const c = cr <= 0.05 + 1e-9 ? "ok" : cr <= 0.10 ? "warn" : "bad"; return `<span class="pill ${c}">CR ${(cr * 100).toFixed(2)}%</span>`; }
  function valueText(v, a, b) {
    if (Math.abs(v - 1) < 1e-9) return "equal";
    const big = v > 1 ? v : 1 / v;
    return `${v > 1 ? a : b} preferred: ${Math.round(big)} (${S.SAATY_WORDS[Math.round(big)].toLowerCase()})`;
  }
  const MATRIX_ORDER = ["C1", "C2", "DeliveryTime", "Price", "Availability", "Aftersales", "Quality", "Sustainability"];
  const PAIRS = [[0, 1], [0, 2], [1, 2]];
  function buildMatrices() {
    $("matrixGrid").innerHTML = MATRIX_ORDER.map(k => {
      const J = state.J[k], it = J.items;
      return `<div class="mx"><div class="mx-head"><span class="mx-title">${J.title}</span><span id="cr-${k}"></span></div>
        ${PAIRS.map(([i, j]) => `<div class="cmp">
          <div class="cmp-row"><span class="l" id="la-${k}-${i}${j}">${it[i]}</span>
            <input type="range" min="0" max="16" step="1" value="${16 - S.nearestStep(J.m[i][j])}" id="sl-${k}-${i}${j}" aria-label="${it[i]} compared with ${it[j]}">
            <span class="r" id="lb-${k}-${i}${j}">${it[j]}</span></div>
          <div class="cmp-txt" id="tx-${k}-${i}${j}"></div></div>`).join("")}
        <div class="mx-pri" id="pri-${k}"></div></div>`;
    }).join("");
    MATRIX_ORDER.forEach(k => PAIRS.forEach(([i, j]) => $(`sl-${k}-${i}${j}`).addEventListener("input", e => {
      const v = S.SAATY_VALUES[16 - (+e.target.value)];          // slider left = row item preferred
      state.J[k].m[i][j] = v; state.J[k].m[j][i] = 1 / v;
      matrixReadout(k); changed();
    })));
    MATRIX_ORDER.forEach(matrixReadout);
  }
  function matrixReadout(k) {
    const J = state.J[k], r = S.priorities(J.m);
    $(`cr-${k}`).innerHTML = crPill(r.cr);
    PAIRS.forEach(([i, j]) => {
      const v = J.m[i][j];
      $(`tx-${k}-${i}${j}`).textContent = valueText(v, J.items[i], J.items[j]);
      $(`la-${k}-${i}${j}`).classList.toggle("on", v > 1);
      $(`lb-${k}-${i}${j}`).classList.toggle("on", v < 1);
    });
    $(`pri-${k}`).innerHTML = J.items.map((n, i) => `<div>${n}<b>${fmt(r.p[i])}</b></div>`).join("");
  }
  function renderPaper() { renderSuppliers(); renderRepro(); renderTree(); }

  /* ================================================================ SENSITIVITY */
  function renderSensitivity() {
    $("wRead").textContent = fmt(state.wC1, 2);
    const xs = Array.from({ length: 101 }, (_, i) => i / 100);
    const L = S.groupLines(state);
    const at = w => [0, 1, 2].map(k => L.at0[k] + w * (L.at1[k] - L.at0[k]));
    const flips = S.winnerFlips(state);
    const bands = []; let start = 0, cur = S.rankOf(at(0))[0];
    flips.concat([{ w: 1 }]).forEach(f => { bands.push({ from: start, to: f.w, color: hexA(COLORS.s[cur], 0.08) }); start = f.w; cur = S.rankOf(at(Math.min(1, f.w + 1e-6)))[0]; });
    chart("lineChart", {
      type: "line",
      data: { datasets: [0, 1, 2].map(k => ({ label: NAMES[k], data: xs.map(x => ({ x, y: at(x)[k] })), borderColor: COLORS.s[k], backgroundColor: COLORS.s[k], borderWidth: 3, pointRadius: 0 })) },
      options: {
        parsing: false, interaction: { mode: "index", intersect: false },
        scales: { x: { type: "linear", min: 0, max: 1, ticks: { stepSize: 0.1 }, title: axisTitle("Weight of Logistic-Economic") }, y: { beginAtZero: true, title: axisTitle("Final score") } },
        plugins: {
          legend: legendBottom({ usePointStyle: true, pointStyle: "line", boxWidth: 30 }),
          markers: { bands, lines: [
            { x: 0.5, label: "AHP", color: COLORS.muted, dash: [3, 4], row: 1 },
            { x: 1 / 6, label: "ANP", color: COLORS.muted, dash: [3, 4], row: 1 },
            ...flips.map(f => ({ x: f.w, label: `Flip ${fmt(f.w, 2)}`, color: COLORS.ink, dash: [6, 4], left: true })),
            { x: state.wC1, color: COLORS.ink, width: 2 }] },
          tooltip: { callbacks: { title: c => `Weight ${fmt(c[0].raw.x, 2)}`, label: c => `${c.dataset.label}: ${fmt(c.raw.y)}` } }
        }
      }
    });
    const s = at(state.wC1), r = S.rankOf(s), lead = s[r[0]] - s[r[1]];
    $("whatifTiles").innerHTML = `
      <div class="tile winner-tile" style="--c:${COLORS.s[r[0]]}"><div class="tk">Winner at ${fmt(state.wC1, 2)}</div><div class="tv" style="font-family:var(--display)">${NAMES[r[0]]}</div>
        <div class="ts">Lead over ${NAMES[r[1]]}: <b class="num">${fmt(lead)}</b></div></div>
      <div class="tile"><div class="tk">Scores</div>${[0, 1, 2].map(k => `<div class="rank-row"><span><span class="dot s${k + 1}"></span>${NAMES[k]}</span><span class="num">${fmt(s[k])}</span></div>`).join("")}</div>
      <div class="tile"><div class="tk">Winner changes at</div><div class="tv">${flips.length ? flips.map(f => fmt(f.w, 2)).join(", ") : "never"}</div>
        <div class="ts">${flips.length ? `Below: ${NAMES[S.rankOf(at(flips[0].w - 0.01))[0]]}. Above: ${NAMES[S.rankOf(at(flips[0].w + 0.01))[0]]}.` : ""}</div></div>`;
    const sens = S.attributeSensitivity(state);
    $("sensTable").innerHTML = `<thead><tr><th>Attribute</th><th class="n">Weight now</th><th class="n">Flips at</th><th class="n">Change</th><th>New winner</th></tr></thead><tbody>` +
      sens.map(x => x.flipAt === null
        ? `<tr><td>${S.ATTRS[x.attr].label}</td><td class="n">${fmt(x.weight)}</td><td class="n">never</td><td class="n">&ndash;</td><td>&ndash;</td></tr>`
        : `<tr><td>${S.ATTRS[x.attr].label}</td><td class="n">${fmt(x.weight)}</td><td class="n">${fmt(x.flipAt)}</td><td class="n">${x.flipAt > x.weight ? "+" : ""}${fmt(x.flipAt - x.weight)}</td><td><span class="dot s${x.newWinner + 1}"></span>${NAMES[x.newWinner]}</td></tr>`).join("") + "</tbody>";
  }

  /* ================================================================ REAL NUMBERS */
  const MEAS_ROWS = [
    ["price", "Price per rod (€)", "230 to 350", "1"],
    ["leadDays", "Delivery time (days)", "3 to 7", "1"],
    ["defect2018", "Bad parts 2018 (%)", "6.67 to 15", "0.01"]
  ];
  function buildMeasuredTable() {
    const m = state.measured;
    $("measuredTable").innerHTML = `<thead><tr><th>Measure</th><th class="n">Supplier 1</th><th class="n">Supplier 2</th><th class="n">Supplier 3</th><th>Paper's range</th></tr></thead><tbody>` +
      MEAS_ROWS.map(r => `<tr><td>${r[1]}</td>${[0, 1, 2].map(i => `<td class="n"><input type="number" min="0.01" step="${r[3]}" id="m-${r[0]}-${i}" value="${m[r[0]][i]}" aria-label="${r[1]}, ${NAMES[i]}"></td>`).join("")}<td>${r[2]}</td></tr>`).join("") + "</tbody>";
    MEAS_ROWS.forEach(r => [0, 1, 2].forEach(i => $(`m-${r[0]}-${i}`).addEventListener("change", e => {
      const v = parseFloat(e.target.value);
      if (v > 0) { state.measured[r[0]][i] = v; changed(); } else e.target.value = state.measured[r[0]][i];
    })));
  }
  function renderData() {
    const op = S.localScores(state.J, "paper", state.measured), me = S.localScores(state.J, "measured", state.measured);
    const keys = ["Price", "DeliveryTime", "Quality"], labels = [], dOp = [], dMe = [], cOp = [], cMe = [];
    keys.forEach(k => [0, 1, 2].forEach(i => { labels.push(i === 1 ? [`S${i + 1}`, S.ATTRS[k].short] : `S${i + 1}`); dOp.push(op[k][i]); dMe.push(me[k][i]); cOp.push(COLORS.s[i]); cMe.push(hatch(COLORS.s[i])); }));
    chart("compareChart", {
      type: "bar",
      data: { labels, datasets: [{ label: "Opinions", data: dOp, backgroundColor: cOp, borderWidth: 0 }, { label: "Real numbers", data: dMe, backgroundColor: cMe, borderColor: cOp, borderWidth: 1 }] },
      options: {
        scales: { y: { beginAtZero: true, max: 0.8, title: axisTitle("Score") }, x: { grid: { display: false }, ticks: { color: COLORS.ink, font: { size: 14 }, maxRotation: 0, autoSkip: false } } },
        plugins: { legend: legendBottom({ generateLabels: () => [{ text: "Opinions (paper)", fillStyle: "#7a858b", strokeStyle: "#7a858b", lineWidth: 0 }, { text: "Real numbers", fillStyle: hatch("#7a858b"), strokeStyle: "#7a858b", lineWidth: 1 }] }),
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)}` } } }
      }
    });
    const tOp = S.evaluate({ ...state, mode: "paper" }).total, tMe = S.evaluate({ ...state, mode: "measured" }).total;
    chart("finalCompareChart", {
      type: "bar",
      data: { labels: NAMES, datasets: [
        { label: "Opinions (paper)", data: tOp, backgroundColor: COLORS.s, borderWidth: 0, barThickness: 22 },
        { label: "Real numbers", data: tMe, backgroundColor: COLORS.s.map(hatch), borderColor: COLORS.s, borderWidth: 1, barThickness: 22 }] },
      options: {
        indexAxis: "y",
        scales: { x: { beginAtZero: true, title: axisTitle(`Final score (weight ${fmt(state.wC1, 2)})`) }, y: { grid: { display: false }, ticks: { color: COLORS.ink, font: { size: 15, weight: 600 } } } },
        plugins: { legend: legendBottom({ generateLabels: () => [{ text: "Opinions (paper)", fillStyle: "#7a858b", strokeStyle: "#7a858b", lineWidth: 0 }, { text: "Real numbers", fillStyle: hatch("#7a858b"), strokeStyle: "#7a858b", lineWidth: 1 }] }),
          tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmt(c.raw)}` } } }
      }
    });
  }

  /* ================================================================ ROBUSTNESS */
  let mcDirty = true;
  function renderRobust(force) {
    if (!force && !mcDirty && charts.mcWinChart) return;
    mcDirty = false;
    $("mcRun").textContent = "Running\u2026"; $("mcRun").disabled = true;
    setTimeout(() => { runRobust(); $("mcRun").textContent = "Run"; $("mcRun").disabled = false; }, 30);
  }
  function runRobust() {
    const res = S.monteCarlo(state, { runs: state.mc.runs, steps: state.mc.steps, wMin: state.mc.range[0], wMax: state.mc.range[1], seed: 7, measuredNoise: state.mode === "measured" ? 5 : 0 });
    const ws = res.winShare, top = S.rankOf(ws)[0], sure = ws[top] >= 0.8;
    $("mcVerdict").innerHTML = `<span class="pill ${sure ? "ok" : "warn"}">${sure ? "Reliable winner" : "No reliable winner"}</span><span>${NAMES[top]} wins <b class="num">${pct(ws[top])}</b> of trials</span>`;
    chart("mcWinChart", {
      type: "bar",
      data: { labels: NAMES, datasets: [{ data: ws.map(x => x * 100), backgroundColor: COLORS.s, borderWidth: 0, barThickness: 34 }] },
      options: { indexAxis: "y", scales: { x: { min: 0, max: 100, ticks: { callback: v => v + "%" } }, y: { grid: { display: false }, ticks: { color: COLORS.ink, font: { size: 15, weight: 600 } } } },
        plugins: { tooltip: { callbacks: { label: c => `${c.raw.toFixed(1)}%` } } } }
    });
    $("mcRankTable").innerHTML = `<thead><tr><th>Finishes</th>${NAMES.map(n => `<th class="n">${n}</th>`).join("")}</tr></thead><tbody>` +
      ["1st", "2nd", "3rd"].map((p, k) => `<tr><td>${p}</td>${res.rankShare.map(r => `<td class="n">${pct(r[k], 1)}</td>`).join("")}</tr>`).join("") + "</tbody>";
    const lo = -0.5, bins = 40, w = 1 / bins, counts = new Array(bins).fill(0);
    res.gaps.forEach(x => { counts[Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / w)))]++; });
    const centers = counts.map((_, i) => lo + w * (i + 0.5));
    chart("mcHistChart", {
      type: "bar",
      data: { labels: centers.map(c => c.toFixed(3)), datasets: [{ data: counts, backgroundColor: centers.map(c => c >= 0 ? COLORS.s[0] : COLORS.s[1]), borderWidth: 0, barPercentage: 1, categoryPercentage: 0.95 }] },
      options: {
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: false, callback: (v, i) => (i % 8 === 0 ? (+centers[i] - 0.0125).toFixed(1) : "") }, title: axisTitle("← Supplier 2 wins        S1 − S2        Supplier 1 wins →") }, y: { title: axisTitle("Trials") } },
        plugins: { tooltip: { callbacks: { title: c => `Difference ${(+c[0].label).toFixed(3)}`, label: c => `${c.raw} trials` } } }
      }
    });
  }

  /* ================================================================ OUTLOOK */
  function renderPriorities() {
    const [c, q, sp] = state.prio;
    $("pCostV").textContent = c; $("pQualV").textContent = q; $("pSpeedV").textContent = sp;
    const L = S.localScores(state.J, state.mode, state.measured);
    const sc = S.scoreWith(S.priorityWeights(state.J, c, q, sp), L), r = S.rankOf(sc), mx = Math.max(...sc), lead = sc[r[0]] - sc[r[1]];
    $("prioResult").innerHTML = r.map(k => `<div class="hbar"><span>${NAMES[k]}</span><div class="track"><div class="fill" style="width:${sc[k] / mx * 100}%;background:${COLORS.s[k]}"></div></div><span class="v">${fmt(sc[k])}</span></div>`).join("") +
      `<div class="callout ${lead < 0.03 ? "" : "key"}"><b>${lead < 0.03 ? "Too close to call" : NAMES[r[0]] + " fits this priority"}</b>${lead < 0.03 ? "Let the 2-year cost decide, or split the order." : `Ahead of ${NAMES[r[1]]} by ${fmt(lead)}.`}</div>`;
  }
  function renderBreakEven() {
    const m = state.measured, plan = state.plan, e = [0, 1, 2].map(i => S.expectedCost(i, m, plan));
    const be = S.breakEvenBadCost(0, 1, m, plan);
    const matchPrice = m.price[0] * (e[1].total - e[0].qual - e[0].stop) / e[0].buy;
    const dH = e[0].stopH - e[1].stopH;
    $("breakEven").innerHTML = `
      <div class="tile"><div class="tk">S1 is worth it only if one bad rod costs more than</div><div class="tv">${be ? eur(be) : "never"}</div><div class="ts">Assumed now: ${eur(plan.costPerBadPart)}</div></div>
      <div class="tile"><div class="tk">Price S1 must reach to match S2</div><div class="tv">${matchPrice > 0 ? eur(matchPrice) : "not reachable"}</div><div class="ts">Now ${eur(m.price[0])} per rod</div></div>
      <div class="tile"><div class="tk">Extra line-stop hours with S1 vs S2</div><div class="tv">${dH >= 0 ? "+" : ""}${dH.toFixed(1)} h</div><div class="ts">Delivery ${m.leadDays[0]} vs ${m.leadDays[1]} days</div></div>`;
  }
  function renderOutlook() {
    renderPriorities(); renderBreakEven();
    $("splitRead").textContent = state.split + "%";
    const plan = state.plan, m = state.measured;
    const strats = [
      { name: "Only S1", shares: [1, 0, 0], color: COLORS.s[0] }, { name: "Only S2", shares: [0, 1, 0], color: COLORS.s[1] },
      { name: "Only S3", shares: [0, 0, 1], color: COLORS.s[2] }, { name: `Split ${state.split}/${100 - state.split} S1/S2`, shares: [state.split / 100, 1 - state.split / 100, 0], color: COLORS.ink, dash: [6, 4] }];
    const sims = strats.map((st, i) => S.simulate(st.shares, m, plan, 400, 100 + i));
    const ds = [];
    strats.forEach((st, i) => {
      ds.push({ label: "_lo", data: sims[i].p10, borderWidth: 0, pointRadius: 0, fill: false });
      ds.push({ label: "_hi", data: sims[i].p90, borderWidth: 0, pointRadius: 0, fill: "-1", backgroundColor: hexA(st.color, 0.10) });
      ds.push({ label: st.name, data: sims[i].mean, borderColor: st.color, backgroundColor: st.color, borderDash: st.dash || [], borderWidth: 3, pointRadius: 0, fill: false, tension: 0.15 });
    });
    chart("outlookChart", {
      type: "line",
      data: { labels: Array.from({ length: plan.months }, (_, t) => t + 1), datasets: ds },
      options: {
        interaction: { mode: "index", intersect: false },
        scales: { x: { grid: { display: false }, title: axisTitle("Month") }, y: { title: axisTitle("Total cost so far"), ticks: { callback: v => "€" + v / 1000 + "k" } } },
        plugins: { legend: legendBottom({ usePointStyle: true, pointStyle: "line", boxWidth: 30, filter: it => !it.text.startsWith("_") }),
          tooltip: { filter: it => !it.dataset.label.startsWith("_"), callbacks: { title: c => `Month ${c[0].label}`, label: c => `${c.dataset.label}: ${eur(c.raw)}` } } }
      }
    });
    const best = Math.min(...sims.map(s => s.mean[s.mean.length - 1]));
    $("outlookTiles").innerHTML = strats.map((st, i) => {
      const s = sims[i], tot = s.mean[s.mean.length - 1];
      return `<div class="tile winner-tile" style="--c:${st.color}"><div class="tk">${st.name}</div><div class="tv">${eur(tot)}</div>
        <div class="ts">${tot - best < 1 ? '<span class="pill ok">lowest</span> ' : ""}${s.bad.toFixed(1)} bad rods &middot; ${Math.round(s.stopHours)} h stopped</div></div>`;
    }).join("");
  }
  const PLAN_FIELDS = [
    ["rodsPerYear", "Rods per year", "paper", 1], ["defectTrendPerYear", "Rise in bad parts per year (pts)", "paper", 0.01],
    ["priceRisePct", "Copper price rise per year (%)", "market", 0.5], ["costPerBadPart", "Cost of one bad rod (€)", "est", 10],
    ["urgentPerYear", "Urgent needs per year", "est", 1], ["shelfEmptyPct", "Chance shelf is empty (%)", "est", 1],
    ["stopHoursPerDay", "Hours lost per waiting day", "est", 1], ["stopCostPerHour", "Cost of one stop hour (€)", "est", 25],
    ["months", "Months", "est", 1]];
  const TAGS = { paper: '<span class="tag paper">paper</span>', est: '<span class="tag est">estimate</span>', market: '<span class="tag market">market</span>' };
  function buildPlanGrid() {
    $("planGrid").innerHTML = PLAN_FIELDS.map(f => `<div class="plan-item"><label for="pl-${f[0]}">${f[1]}${TAGS[f[2]]}</label><input type="number" id="pl-${f[0]}" step="${f[3]}" value="${state.plan[f[0]]}"></div>`).join("");
    PLAN_FIELDS.forEach(f => $(`pl-${f[0]}`).addEventListener("change", e => {
      let v = parseFloat(e.target.value);
      if (!(v >= 0)) { e.target.value = state.plan[f[0]]; return; }
      if (f[0] === "months") v = Math.round(Math.min(36, Math.max(12, v)));
      if (f[0] === "shelfEmptyPct") v = Math.min(100, v);
      e.target.value = v; state.plan[f[0]] = v; scheduleOutlook();
    }));
  }

  /* ================================================================ routing */
  function updateStatus() {
    const r = S.rankOf(S.evaluate(state).total);
    $("tabStatus").innerHTML = `<span>Weight <b class="num">${fmt(state.wC1, 2)}</b></span><span>Leader <b><span class="dot s${r[0] + 1}"></span>${NAMES[r[0]]}</b></span>`;
  }
  const RENDER = { paper: renderPaper, sensitivity: renderSensitivity, data: renderData, robust: () => renderRobust(false), outlook: renderOutlook };
  let current = "paper";
  function show(view) {
    if (!RENDER[view]) view = "paper";
    current = view;
    document.querySelectorAll(".view").forEach(v => { v.hidden = v.id !== "view-" + view; });
    document.querySelectorAll(".tabs a").forEach(a => a.classList.toggle("active", a.dataset.view === view));
    RENDER[view](); window.scrollTo({ top: 0 });
  }
  function changed() { mcDirty = true; updateStatus(); if (current === "robust") renderRobust(true); else RENDER[current](); }
  let timer = null;
  function scheduleOutlook() { clearTimeout(timer); timer = setTimeout(() => { if (current === "outlook") renderOutlook(); }, 120); }

  function setMode(m) {
    state.mode = m;
    $("modePaper").setAttribute("aria-pressed", m === "paper");
    $("modeMeasured").setAttribute("aria-pressed", m === "measured");
    changed();
  }
  $("modePaper").addEventListener("click", () => setMode("paper"));
  $("modeMeasured").addEventListener("click", () => setMode("measured"));
  $("resetAll").addEventListener("click", () => {
    Object.assign(state, { J: S.copyJudgments(S.PAPER_JUDGMENTS), measured: deep(S.MEASURED_DEFAULT), wC1: 0.5, prio: [4, 4, 4], split: 50, plan: deep(S.PLAN_DEFAULT) });
    $("wSlider").value = 0.5; $("splitSlider").value = 50;
    ["pCost", "pQual", "pSpeed"].forEach((id, i) => { $(id).value = state.prio[i]; });
    buildMatrices(); buildMeasuredTable(); buildPlanGrid(); setMode("paper");
  });
  $("wSlider").addEventListener("input", e => { state.wC1 = +e.target.value; changed(); });
  document.querySelectorAll("[data-w]").forEach(b => b.addEventListener("click", () => { state.wC1 = +b.dataset.w; $("wSlider").value = state.wC1; changed(); }));
  $("mcSteps").addEventListener("change", e => { state.mc.steps = +e.target.value; renderRobust(true); });
  $("mcRange").addEventListener("change", e => { state.mc.range = e.target.value.split(",").map(Number); renderRobust(true); });
  $("mcRuns").addEventListener("change", e => { state.mc.runs = +e.target.value; renderRobust(true); });
  $("mcRun").addEventListener("click", () => renderRobust(true));
  ["pCost", "pQual", "pSpeed"].forEach((id, i) => $(id).addEventListener("input", e => { state.prio[i] = +e.target.value; renderPriorities(); }));
  document.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => {
    state.prio = b.dataset.p.split(",").map(Number);
    ["pCost", "pQual", "pSpeed"].forEach((id, i) => { $(id).value = state.prio[i]; }); renderPriorities();
  }));
  $("splitSlider").addEventListener("input", e => { state.split = +e.target.value; $("splitRead").textContent = state.split + "%"; scheduleOutlook(); });
  $("resetPlan").addEventListener("click", () => { state.plan = deep(S.PLAN_DEFAULT); buildPlanGrid(); renderOutlook(); });
  window.addEventListener("hashchange", () => show(location.hash.slice(1)));

  buildMatrices(); buildMeasuredTable(); buildPlanGrid(); updateStatus();
  show(location.hash.slice(1) || "paper");
})(window.SDL);
