/*
 * app.js
 * Two columns with the same inputs:
 *   LEFT  = paper's model: the paper's answers (Tables 2-9), all six attributes from opinions.
 *   RIGHT = my model: the same answers with one doubtful answer re-checked in each table above
 *           CR 5%, and price, delivery time and part quality scored from measured numbers.
 * Every step shows its working so each number can be checked by hand.
 */
(function (S) {
  const $ = id => document.getElementById(id);
  const clone = o => JSON.parse(JSON.stringify(o));
  const f3 = x => x.toFixed(3), f4 = x => x.toFixed(4);
  const pc = x => (x * 100).toFixed(1) + "%", pc2 = x => (x * 100).toFixed(2) + "%";
  const eur = x => "€" + Math.round(x).toLocaleString("en-GB");
  const SUP = ["Supplier 1", "Supplier 2", "Supplier 3"], SS = ["S1", "S2", "S3"];
  const COL = ["#1f5fa8", "#d9822b", "#6b7280"];
  const LIMIT = 0.05, KEYS = () => Object.keys(J);
  const TNO = { C1: "T2", C2: "T3", DeliveryTime: "T4", Quality: "T5", Availability: "T6", Aftersales: "T7", Price: "T8", Sustainability: "T9" };
  const REAL = { Price: "price", DeliveryTime: "leadDays", Quality: "defect2018" };

  let J, meas, plan, w, mc = null;
  function resetAll() { J = S.copyJudgments(S.PAPER_JUDGMENTS); meas = clone(S.MEASURED_DEFAULT); plan = clone(S.PLAN_DEFAULT); w = 0.5; }
  function frac(v) { if (Math.abs(v - 1) < 1e-9) return "1"; return v > 1 ? String(Math.round(v)) : "1/" + Math.round(1 / v); }

  /* My model, change 1: in a table above CR 5%, try every one-step change of one answer and keep the
     one with the lowest CR; repeat (at most 3 times) until CR <= 5%. */
  function fixTable(M) {
    let A = M.map(r => r.slice()); const changes = [];
    for (let round = 0; round < 3 && S.priorities(A).cr > LIMIT + 1e-9; round++) {
      let best = null;
      for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
        const s = S.nearestStep(A[i][j]);
        for (const d of [-1, 1]) {
          const k = s + d; if (k < 0 || k >= S.SAATY_VALUES.length) continue;
          const B = A.map(r => r.slice()); B[i][j] = S.SAATY_VALUES[k]; B[j][i] = 1 / S.SAATY_VALUES[k];
          const cr = S.priorities(B).cr;
          if (!best || cr < best.cr - 1e-12) best = { i, j, from: A[i][j], to: B[i][j], cr, B };
        }
      }
      changes.push(best); A = best.B;
    }
    return { A, changes };
  }
  function fixedJ() { const F = S.copyJudgments(J); for (const k in F) F[k].m = fixTable(J[k].m).A; return F; }

  /* The two sides. */
  function side(s, ww) {
    const isR = s === "R";
    return { J: isR ? fixedJ() : J, mode: isR ? "measured" : "paper", measured: meas, wC1: ww === undefined ? w : ww };
  }
  const winner = sc => S.rankOf(sc)[0];

  const charts = {};
  function chart(id, cfg) {
    if (charts[id]) charts[id].destroy();
    cfg.options = Object.assign({ responsive: true, maintainAspectRatio: false, animation: false }, cfg.options || {});
    charts[id] = new Chart($(id), cfg);
  }
  Chart.defaults.font.size = 14; Chart.defaults.color = "#222";

  /* ---------- 1. input tables ---------- */
  const OPTS = S.SAATY_VALUES.map((v, i) => `<option value="${i}">${frac(v)}</option>`).join("");
  function buildTables() {
    ["L", "R"].forEach(sd => {
      $("tabs" + sd).innerHTML = KEYS().map(k => {
        const it = J[k].items;
        let h = `<div class="mat"><h4>${TNO[k]}: ${J[k].title.replace(/ \(Table \d\)/, "")}</h4><table class="data"><tr><th></th>${it.map(x => `<th>${x}</th>`).join("")}</tr>`;
        for (let i = 0; i < 3; i++) {
          h += `<tr><th>${it[i]}</th>`;
          for (let j = 0; j < 3; j++) {
            if (i === j) h += `<td>1</td>`;
            else if (sd === "L" && j > i) h += `<td><select data-k="${k}" data-i="${i}" data-j="${j}">${OPTS}</select></td>`;
            else h += `<td class="mono" id="c${sd}-${k}-${i}-${j}"></td>`;
          }
          h += `</tr>`;
        }
        return h + `</table><div class="cr" id="cr${sd}-${k}"></div></div>`;
      }).join("");
    });
    document.querySelectorAll("#tabsL select").forEach(sel => sel.addEventListener("change", () => {
      const { k, i, j } = sel.dataset, v = S.SAATY_VALUES[+sel.value];
      J[k].m[i][j] = v; J[k].m[j][i] = 1 / v; renderAll(true);
    }));
    const opts = KEYS().map(k => `<option value="${k}">${TNO[k]}: ${J[k].title.replace(/ \(Table \d\)/, "")}</option>`).join("");
    document.querySelectorAll("select.pick").forEach(p => {
      p.innerHTML = opts;
      p.addEventListener("change", () => { document.querySelectorAll("select.pick").forEach(q => q.value = p.value); renderWorking(); });
    });
  }
  function crSpan(cr) { return `<span class="${cr <= LIMIT + 1e-9 ? "ok" : "bad"}">CR ${pc2(cr)}</span>`; }
  function renderTables() {
    const F = fixedJ();
    document.querySelectorAll("#tabsL select").forEach(sel => { const { k, i, j } = sel.dataset; sel.value = S.nearestStep(J[k].m[i][j]); });
    let failL = 0, failR = 0;
    for (const k of KEYS()) {
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
        if (i === j) continue;
        const cl = $(`cL-${k}-${i}-${j}`); if (cl) cl.textContent = frac(J[k].m[i][j]);
        const cr = $(`cR-${k}-${i}-${j}`);
        cr.textContent = frac(F[k].m[i][j]);
        cr.className = "mono" + (Math.abs(F[k].m[i][j] - J[k].m[i][j]) > 1e-9 ? " chg" : "");
      }
      const pL = S.priorities(J[k].m), pR = S.priorities(F[k].m);
      if (pL.cr > LIMIT + 1e-9) failL++; if (pR.cr > LIMIT + 1e-9) failR++;
      $(`crL-${k}`).innerHTML = `${crSpan(pL.cr)} · w: ${pL.p.map(f3).join(", ")}`;
      $(`crR-${k}`).innerHTML = `${crSpan(pR.cr)} · w: ${pR.p.map(f3).join(", ")}`;
    }
    $("crL").innerHTML = `Consistency: <span class="bad">${failL} of 8 tables above 5%</span>`;
    $("crR").innerHTML = `Consistency: <span class="${failR ? "bad" : "ok"}">${8 - failR} of 8 tables within 5%</span> (${KEYS().reduce((n, k) => n + fixTable(J[k].m).changes.length, 0)} answers re-checked)`;
  }
  function working(M, items, paperCR) {
    const r = S.priorities(M), Aw = M.map(row => row.reduce((s, x, j) => s + x * r.p[j], 0));
    let h = `<table class="data"><tr><th></th>${items.map(x => `<th>${x}</th>`).join("")}<th>w</th><th>A·w</th><th>(A·w)÷w</th></tr>`;
    for (let i = 0; i < 3; i++) h += `<tr><th>${items[i]}</th>${M[i].map(x => `<td>${frac(x)}</td>`).join("")}<td><b>${f4(r.p[i])}</b></td><td>${f4(Aw[i])}</td><td>${f4(Aw[i] / r.p[i])}</td></tr>`;
    h += `</table><div class="formula">λmax = average of last column = ${f4(r.lambda)}
CI = (λmax − 3) ÷ 2 = ${f4(r.ci)}
CR = CI ÷ RI = ${f4(r.ci)} ÷ 0.52 = ${pc2(r.cr)}  ${r.cr <= LIMIT + 1e-9 ? "within 5%" : "ABOVE 5%"}${paperCR !== undefined ? `  (paper prints ${paperCR.toFixed(2)}%)` : ""}</div>`;
    return h + `<p class="note">RI = 0.52 is the random index used by SuperDecisions, the software the paper used; with it every CR equals the paper's printed value.</p>`;
  }
  function renderWorking() {
    const k = document.querySelector("select.pick").value, F = fixedJ();
    $("workL").innerHTML = working(J[k].m, J[k].items, J[k].paperInconsistency);
    const ch = fixTable(J[k].m).changes;
    $("workR").innerHTML = working(F[k].m, J[k].items) +
      `<p class="note">${ch.length ? "Re-checked: " + ch.map(c => `${J[k].items[c.i]} vs ${J[k].items[c.j]}: ${frac(c.from)} → ${frac(c.to)}`).join("; ") : "No change needed: this table already passes."}</p>`;
  }

  /* ---------- 2. attribute scores ---------- */
  function scoresTable(sd) {
    const st = side(sd), L = S.localScores(st.J, st.mode, meas);
    const v1 = S.priorities(st.J.C1.m).p, v2 = S.priorities(st.J.C2.m).p;
    let h = `<table class="data full"><tr><th class="l">Attribute</th><th>Weight in group</th><th>S1</th><th>S2</th><th>S3</th><th>Scored from</th></tr>`;
    S.ATTR_ORDER.forEach(a => {
      const g = S.ATTRS[a].group, v = g === "C1" ? v1[S.GROUPS[0].attrs.indexOf(a)] : v2[S.GROUPS[1].attrs.indexOf(a)];
      const real = sd === "R" && REAL[a];
      const what = { Price: "price", DeliveryTime: "delivery days", Quality: "bad-part rate" }[a];
      let src = real ? `<span class="src-real">real numbers (${what})</span>` : `<span class="src-op">opinion (${TNO[a]})</span>`;
      h += `<tr><td class="l">${S.ATTRS[a].short} (${g})</td><td>${f3(v)}</td>${L[a].map(x => `<td>${real ? "<b>" + f3(x) + "</b>" : f3(x)}</td>`).join("")}<td>${src}</td></tr>`;
    });
    h += `</table>`;
    const p = L.Price, r = Math.max(...meas.price) / Math.min(...meas.price);
    h += `<p class="win">Price: real gap ${r.toFixed(2)}×, score gap <b class="${sd === "L" ? "bad" : "ok"}">${(Math.max(...p) / Math.min(...p)).toFixed(2)}×</b></p>`;
    return h;
  }
  const MEAS_ROWS = [["price", "Price per rod (€)", "€230 to €350"], ["leadDays", "Delivery time (days)", "3 to 7 days"], ["defect2018", "Bad parts 2018 (%)", "6.67% to 15%"]];
  function buildMeasured() {
    $("measTable").innerHTML = `<tr><th class="l">Value</th><th>S1</th><th>S2</th><th>S3</th><th>Paper's range</th><th class="l">Working: 1/x ÷ Σ(1/x)</th></tr>` +
      MEAS_ROWS.map(([k, lab, rng]) => `<tr><td class="l">${lab}</td>${[0, 1, 2].map(i => `<td><input type="number" step="any" data-k="${k}" data-i="${i}"></td>`).join("")}<td>${rng}</td><td class="l mono" id="mw-${k}"></td></tr>`).join("");
    document.querySelectorAll("#measTable input").forEach(inp => inp.addEventListener("change", () => {
      const v = parseFloat(inp.value); if (v > 0) { meas[inp.dataset.k][+inp.dataset.i] = v; renderAll(true); }
    }));
  }
  function renderScores() {
    $("scoresL").innerHTML = scoresTable("L");
    $("scoresR").innerHTML = scoresTable("R");
    document.querySelectorAll("#measTable input").forEach(inp => { inp.value = meas[inp.dataset.k][+inp.dataset.i]; });
    MEAS_ROWS.forEach(([k]) => {
      const inv = meas[k].map(x => 1 / x), s = inv.reduce((a, b) => a + b, 0);
      $("mw-" + k).textContent = `${inv.map(f4).join(", ")} ÷ ${f4(s)}`;
    });
  }

  /* ---------- 3. final score ---------- */
  function finalTable(sd) {
    const st = side(sd), ev = S.evaluate(st);
    let h = `<table class="data full"><tr><th class="l">Attribute</th><th>Global weight</th>${SS.map(s => `<th>${s}: weight × score</th>`).join("")}</tr>`;
    S.ATTR_ORDER.forEach(a => {
      h += `<tr><td class="l">${S.ATTRS[a].short}</td><td>${f4(ev.W[a])}</td>${ev.L[a].map(x => `<td>${f4(ev.W[a])} × ${f3(x)} = <b>${f4(ev.W[a] * x)}</b></td>`).join("")}</tr>`;
    });
    h += `<tr class="total"><td class="l" colspan="2">Final score</td>${ev.total.map(x => `<td>${f4(x)}</td>`).join("")}</tr>`;
    if (sd === "L") {
      if (Math.abs(w - 0.5) < 0.002) h += `<tr class="ref"><td class="l" colspan="2">Paper, Table 10 (AHP)</td>${S.PAPER_RESULTS.AHP.map(x => `<td>${f4(x)}</td>`).join("")}</tr>`;
      if (Math.abs(w - 1 / 6) < 0.002) h += `<tr class="ref"><td class="l" colspan="2">Paper, Table 11 (ANP)</td>${S.PAPER_RESULTS.ANP.map(x => `<td>${f4(x)}</td>`).join("")}</tr>`;
    }
    const t = ev.total, o = S.rankOf(t);
    h += `</table><p class="win">Winner at w = ${w.toFixed(3)}: <b>${SUP[o[0]]}</b>, lead over ${SUP[o[1]]} = ${f4(t[o[0]] - t[o[1]])}</p>`;
    if (sd === "L") {
      const okA = S.evaluate(side("L", 0.5)).total.every((x, i) => Math.abs(x - S.PAPER_RESULTS.AHP[i]) < 5e-5);
      const okN = S.evaluate(side("L", 1 / 6)).total.every((x, i) => Math.abs(x - S.PAPER_RESULTS.ANP[i]) < 5e-5);
      h += okA && okN ? `<p class="note"><span class="ok">Check passed:</span> at w = 0.5 this equals the paper's AHP result (Table 10), and at w = 1/6 its ANP result (Table 11), to 4 decimals. The paper's two methods differ only in this one weight.</p>`
                      : `<p class="note">Inputs have been changed, so the result no longer equals the paper's Tables 10 and 11. Press "Reset to paper values" to compare again.</p>`;
    }
    return h;
  }

  /* ---------- 4. flip point ---------- */
  /* Exact crossings of the top supplier along w (scores are straight lines in w). */
  function flipInfo(sd) {
    const st = side(sd), { at0, at1 } = S.groupLines(st), fl = S.winnerFlips(st);
    const segs = [], pts = [0].concat(fl.map(f => f.w), [1]);
    for (let k = 0; k < pts.length - 1; k++) {
      const m = (pts[k] + pts[k + 1]) / 2;
      segs.push({ from: pts[k], to: pts[k + 1], win: winner(at0.map((x, i) => x + m * (at1[i] - x))) });
    }
    const everWin = new Set(segs.map(g => g.win));
    return { at0, at1, fl, segs, never: [0, 1, 2].filter(i => !everWin.has(i)) };
  }
  function renderFlip(sd) {
    const F = flipInfo(sd), { at0, at1, fl } = F;
    let txt = `S(0) = ${at0.map(f4).join(", ")}   (w = 0: only quality group)
S(1) = ${at1.map(f4).join(", ")}   (w = 1: only logistic group)`;
    fl.forEach(f => {
      const [i, j] = f.pair, d0 = at0[i] - at0[j], d1 = at1[i] - at1[j];
      txt += `\nS${i + 1} = S${j + 1} at w* = ${f4(d0)} ÷ (${f4(d0)} − (${f4(d1)})) = <b>${f3(f.w)}</b>`;
    });
    if (!fl.length) txt += `\nNo crossing at the top between w = 0 and w = 1.`;
    const desc = F.segs.map(g => `${SUP[g.win]} wins for w from ${f3(g.from)} to ${f3(g.to)}`).join("; ");
    const nev = F.never.length ? ` ${F.never.map(i => SUP[i]).join(" and ")} never ${F.never.length > 1 ? "win" : "wins"}.` : "";
    $("flip" + sd).innerHTML = `<div class="formula">${txt}</div><p class="win">${desc}.${nev}</p>`;
    const xs = Array.from({ length: 21 }, (_, i) => i / 20);
    chart("chartFlip" + sd, {
      type: "line",
      data: { labels: xs.map(x => x.toFixed(2)), datasets: [0, 1, 2].map(i => ({ label: SUP[i], data: xs.map(x => at0[i] + x * (at1[i] - at0[i])), borderColor: COL[i], backgroundColor: COL[i], borderWidth: 3, pointRadius: 0 })) },
      options: { plugins: { title: { display: true, text: fl.length ? `Flip point w* = ${fl.map(f => f3(f.w)).join(", ")}` : "No flip point" } },
        scales: { x: { title: { display: true, text: "w" }, ticks: { maxTicksLimit: 11 } }, y: { min: 0, title: { display: true, text: "Final score" } } } }
    });
    return F;
  }

  /* ---------- 5. trials ---------- */
  function runMC() {
    const N = Math.max(100, Math.min(20000, parseInt($("mcRuns").value) || 5000));
    const opt = { runs: N, steps: 1, wMin: 0.1, wMax: 0.9, seed: 7 };
    mc = { N, L: S.monteCarlo(side("L"), Object.assign({}, opt, { measuredNoise: 0 })), R: S.monteCarlo(side("R"), Object.assign({}, opt, { measuredNoise: 5 })) };
    ["L", "R"].forEach(sd => {
      const r = mc[sd];
      $("mc" + sd).innerHTML = `<table class="data full"><tr><th class="l">Supplier</th><th>1st</th><th>2nd</th><th>3rd</th></tr>` +
        SUP.map((s, i) => `<tr><td class="l">${s}</td>${r.rankShare[i].map((x, p) => `<td>${p === 0 ? "<b>" + pc(x) + "</b>" : pc(x)}</td>`).join("")}</tr>`).join("") + `</table>`;
      chart("chartMC" + sd, {
        type: "bar",
        data: { labels: SUP, datasets: [{ label: "% of trials won", data: r.winShare.map(x => x * 100), backgroundColor: sd === "L" ? "#8c96a6" : "#1b7a32" }] },
        options: { plugins: { legend: { display: false }, title: { display: true, text: `% of ${N.toLocaleString("en-GB")} trials won (80% = safe choice)` } }, scales: { y: { min: 0, max: 100 } } }
      });
    });
  }

  /* ---------- 6. cost ---------- */
  const PLAN_ROWS = [
    ["rodsPerYear", "Rods needed per year", "paper: yearly spend ÷ average price"],
    ["defectTrendPerYear", "Rise in bad parts (% points a year)", "paper: 2017 to 2018 rise"],
    ["priceRisePct", "Copper price rise (% a year)", "estimate"],
    ["costPerBadPart", "Handling cost of one bad rod (€)", "estimate"],
    ["urgentPerYear", "Urgent breakdowns per year", "estimate"],
    ["shelfEmptyPct", "Chance spare shelf is empty (%)", "estimate"],
    ["stopHoursPerDay", "Hours lost per day of waiting", "estimate (one shift)"],
    ["stopCostPerHour", "Cost of one hour of line stop (€)", "estimate"]
  ];
  function buildPlan() {
    $("planTable").innerHTML = `<tr><th class="l">Input</th><th>Value</th><th class="l">Source</th></tr>` +
      PLAN_ROWS.map(([k, lab, src]) => `<tr><td class="l">${lab}</td><td><input type="number" step="any" data-k="${k}"></td><td class="l"><span class="tag">${src}</span></td></tr>`).join("");
    document.querySelectorAll("#planTable input").forEach(inp => inp.addEventListener("change", () => {
      const v = parseFloat(inp.value); if (v >= 0) { plan[inp.dataset.k] = v; renderAll(false); }
    }));
  }
  let costCache;
  function renderCost() {
    document.querySelectorAll("#planTable input").forEach(inp => { inp.value = plan[inp.dataset.k]; });
    const e = [0, 1, 2].map(i => S.expectedCost(i, meas, plan));
    const split = {}; ["buy", "bad", "qual", "stop", "stopH", "total"].forEach(k => { split[k] = (e[0][k] + e[1][k]) / 2; });
    const plans = [...e, split], names = ["Only S1", "Only S2", "Only S3", "Split 50/50"];
    const rows = [
      ["A. Buying = rods × price", p => eur(p.buy)],
      [`Bad rods expected`, p => p.bad.toFixed(1)],
      [`B. Handling = bad rods × €${plan.costPerBadPart}`, p => eur(p.qual)],
      [`Line-stop hours`, p => p.stopH.toFixed(1)],
      [`C. Line stops = hours × €${plan.stopCostPerHour}`, p => eur(p.stop)]
    ];
    let h = `<table class="data full"><tr><th class="l">24 months</th>${names.map(n => `<th>${n}</th>`).join("")}</tr>` +
      rows.map(([lab, fn]) => `<tr><td class="l">${lab}</td>${plans.map(p => `<td>${fn(p)}</td>`).join("")}</tr>`).join("") +
      `<tr class="total"><td class="l">Total = A + B + C</td>${plans.map(p => `<td>${eur(p.total)}</td>`).join("")}</tr></table>`;
    const be = S.breakEvenBadCost(0, 1, meas, plan);
    const best = plans.map(p => p.total).indexOf(Math.min(...plans.map(p => p.total)));
    h += `<p class="win">Cheapest: <b>${names[best]}</b>. Supplier 1 pays off only if one bad rod costs more than <b>${be ? eur(be) : "-"}</b>.</p>`;
    $("costR").innerHTML = h;
    chart("chartCost", {
      type: "bar",
      data: { labels: names, datasets: [
        { label: "A. Buying", data: plans.map(p => p.buy), backgroundColor: "#1f5fa8" },
        { label: "B. Handling bad rods", data: plans.map(p => p.qual), backgroundColor: "#e0b400" },
        { label: "C. Line stops", data: plans.map(p => p.stop), backgroundColor: "#b42318" }] },
      options: { plugins: { title: { display: true, text: "Expected 2-year cost (€)" } }, scales: { x: { stacked: true }, y: { stacked: true } } }
    });
    costCache = { e, be };
  }

  /* ---------- verdict ---------- */
  function renderVerdict(FL, FR) {
    const tL = S.evaluate(side("L")).total, tR = S.evaluate(side("R")).total;
    const aA = S.evaluate(side("L", 0.5)).total, aN = S.evaluate(side("L", 1 / 6)).total;
    const failL = KEYS().filter(k => S.priorities(J[k].m).cr > LIMIT + 1e-9).length;
    const F = fixedJ(), failR = KEYS().filter(k => S.priorities(F[k].m).cr > LIMIT + 1e-9).length;
    const pL = S.localScores(J, "paper", meas).Price, pR = S.localScores(F, "measured", meas).Price;
    const ratio = a => (Math.max(...a) / Math.min(...a)).toFixed(2) + "×";
    const real = (Math.max(...meas.price) / Math.min(...meas.price)).toFixed(2) + "×";
    const wins = r => r.winShare.map((x, i) => `S${i + 1} ${pc(x)}`).join(", ");
    const { e, be } = costCache;
    const row = (k, p, m) => `<tr><td class="l"><b>${k}</b></td><td class="l p">${p}</td><td class="l m">${m}</td></tr>`;
    $("verdict").innerHTML = `<table class="data"><tr><th class="l" style="width:18%">Point</th><th class="l" style="width:41%">Paper's model</th><th class="l">My model</th></tr>
      ${row("Same inputs?", "Paper Tables 2 to 9", "Same tables; only the doubtful answers re-checked")}
      ${row("Answer", `AHP: ${SUP[winner(aA)]} (${f3(Math.max(...aA))}); ANP: ${SUP[winner(aN)]} (${f3(Math.max(...aN))}). ` + (winner(aA) !== winner(aN) ? `<span class="bad">Two winners, no reason given.</span>` : `Same winner.`), `${SUP[winner(tR)]} at w = ${w.toFixed(3)} (S1 / S2 / S3 = ${tR.map(f3).join(" / ")}). <span class="ok">The weight that changes the winner is shown.</span>`)}
      ${row("Consistency", `<span class="bad">${failL} of 8 tables above 5%</span>`, `<span class="ok">${8 - failR} of 8 tables within 5%</span>`)}
      ${row("Price scoring", `Real gap ${real} scored as <span class="bad">${ratio(pL)}</span>`, `Real gap ${real} scored as <span class="ok">${ratio(pR)}</span>`)}
      ${row("Flip point", `${FL.fl.length ? "w = " + FL.fl.map(f => f3(f.w)).join(", ") : "none"}, not reported in the paper`, `${FR.fl.length ? "w = " + FR.fl.map(f => f3(f.w)).join(", ") : "none"}, shown to the managers`)}
      ${row("How sure?", `Not checked. (Our test: ${wins(mc.L)})`, `Tested: ${wins(mc.R)}`)}
      ${row("Cost", `<span class="bad">Not shown</span>`, `S2 ${eur(e[1].total)}, S1 ${eur(e[0].total)}, S3 ${eur(e[2].total)}; S1 pays off only above ${be ? eur(be) : "-"} per bad rod`)}
      ${row("Can it be checked?", "Hidden inside SuperDecisions software", "Every step shows the numbers and the working")}
    </table>`;
  }

  function renderAll(withMC) {
    renderTables(); renderWorking(); renderScores();
    $("finalL").innerHTML = finalTable("L"); $("finalR").innerHTML = finalTable("R");
    const FL = renderFlip("L"), FR = renderFlip("R");
    if (withMC || !mc) runMC();
    renderCost(); renderVerdict(FL, FR);
    $("wInput").value = w.toFixed(3);
  }

  resetAll(); buildTables(); buildMeasured(); buildPlan();
  $("wInput").addEventListener("change", () => { const v = parseFloat($("wInput").value); if (v >= 0 && v <= 1) { w = v; renderAll(false); } });
  document.querySelectorAll("button[data-w]").forEach(b => b.addEventListener("click", () => { w = parseFloat(b.dataset.w); renderAll(false); }));
  $("runMC").addEventListener("click", () => { runMC(); renderVerdict(flipInfo("L"), flipInfo("R")); });
  $("reset").addEventListener("click", () => { resetAll(); renderAll(true); });
  renderAll(true);
  window.__ready = true;
})(window.SDL);
