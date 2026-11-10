/*
 * ahp.js
 * The decision maths: AHP priorities, consistency check, group weights,
 * measured-data scores, tipping points and the robustness (Monte Carlo) test.
 */
window.SDL = window.SDL || {};

(function (S) {
  /* Priority vector of a pairwise matrix = its principal eigenvector, found by power iteration.
     Also returns lambda-max and the consistency ratio (CR). */
  S.priorities = function (M) {
    const n = M.length;
    let p = new Array(n).fill(1 / n);
    for (let it = 0; it < 200; it++) {
      const q = M.map(row => row.reduce((s, x, j) => s + x * p[j], 0));
      const sum = q.reduce((a, b) => a + b, 0);
      const next = q.map(x => x / sum);
      const diff = next.reduce((m, x, i) => Math.max(m, Math.abs(x - p[i])), 0);
      p = next;
      if (diff < 1e-13) break;   // converged
    }
    const Mp = M.map(row => row.reduce((s, x, j) => s + x * p[j], 0));
    const lambda = Mp.reduce((s, x, i) => s + x / p[i], 0) / n;
    const ci = (lambda - n) / (n - 1);
    const cr = Math.max(0, ci / S.RANDOM_INDEX);
    return { p, lambda, ci, cr };
  };

  S.copyJudgments = function (J) {
    const out = {};
    for (const k in J) out[k] = { ...J[k], m: J[k].m.map(r => r.slice()) };
    return out;
  };

  /* Lower is better for price, lead time and defect rate, so score = (1/x) normalised. */
  S.costScores = function (values) {
    const inv = values.map(v => 1 / Math.max(v, 1e-9));
    const s = inv.reduce((a, b) => a + b, 0);
    return inv.map(v => v / s);
  };

  /* Local scores of the three suppliers on each attribute.
     mode "paper": all six from the managers' judgments.
     mode "measured": price, delivery time and quality from real numbers; the rest from judgments. */
  S.localScores = function (J, mode, measured) {
    const L = {};
    S.ATTR_ORDER.forEach(a => { L[a] = S.priorities(J[a].m).p; });
    if (mode === "measured") {
      L.Price = S.costScores(measured.price);
      L.DeliveryTime = S.costScores(measured.leadDays);
      L.Quality = S.costScores(measured.defect2018);
    }
    return L;
  };

  /* Global weight of each attribute = group weight x weight inside the group. */
  S.attributeWeights = function (J, wC1) {
    const w1 = S.priorities(J.C1.m).p, w2 = S.priorities(J.C2.m).p;
    const W = {};
    S.GROUPS[0].attrs.forEach((a, i) => { W[a] = wC1 * w1[i]; });
    S.GROUPS[1].attrs.forEach((a, i) => { W[a] = (1 - wC1) * w2[i]; });
    return W;
  };

  /* Final score of each supplier for given attribute weights W and local scores L. */
  S.scoreWith = function (W, L) {
    return [0, 1, 2].map(i => S.ATTR_ORDER.reduce((s, a) => s + W[a] * L[a][i], 0));
  };

  S.evaluate = function (state, wC1) {
    const L = S.localScores(state.J, state.mode, state.measured);
    const W = S.attributeWeights(state.J, wC1 === undefined ? state.wC1 : wC1);
    const total = S.scoreWith(W, L);
    const parts = S.ATTR_ORDER.map(a => ({ attr: a, values: [0, 1, 2].map(i => W[a] * L[a][i]) }));
    return { L, W, total, parts };
  };

  S.rankOf = function (scores) {
    return [0, 1, 2].slice().sort((a, b) => scores[b] - scores[a]);
  };

  /* The scores are straight lines in wC1, so every crossing can be found exactly. */
  S.groupLines = function (state) {
    const a = S.evaluate(state, 0).total;   // all weight on Quality-Sustainability
    const b = S.evaluate(state, 1).total;   // all weight on Logistic-Economic
    return { at0: a, at1: b };
  };
  S.winnerFlips = function (state) {
    const { at0, at1 } = S.groupLines(state);
    const flips = [];
    for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) {
      const d0 = at0[i] - at0[j], d1 = at1[i] - at1[j];
      if (d0 * d1 < 0) {
        const w = d0 / (d0 - d1);
        const sc = [0, 1, 2].map(k => at0[k] + w * (at1[k] - at0[k]));
        const top = S.rankOf(sc)[0];
        // only crossings at the top of the ranking change the recommended supplier
        if (top === i || top === j || Math.abs(sc[i] - sc[top]) < 1e-9) flips.push({ w, pair: [i, j] });
      }
    }
    return flips.sort((x, y) => x.w - y.w);
  };

  /* One-at-a-time sensitivity: raise or lower one attribute's global weight
     (others rescaled to keep the total at 1) and find where the winner changes. */
  S.attributeSensitivity = function (state) {
    const L = S.localScores(state.J, state.mode, state.measured);
    const W0 = S.attributeWeights(state.J, state.wC1);
    const base = S.rankOf(S.scoreWith(W0, L))[0];
    return S.ATTR_ORDER.map(a => {
      const w0 = W0[a];
      const at = x => {
        const W = {};
        S.ATTR_ORDER.forEach(b => { W[b] = b === a ? x : W0[b] * (1 - x) / (1 - w0); });
        return S.scoreWith(W, L);
      };
      let flipAt = null, newWinner = null;
      for (let k = 1; k <= 400; k++) {            // scan 0..1 in fine steps, nearest flip to w0 wins
        const up = w0 + (1 - w0) * k / 400, dn = w0 - w0 * k / 400;
        const ru = S.rankOf(at(up))[0], rd = S.rankOf(at(dn))[0];
        if (ru !== base) { flipAt = up; newWinner = ru; break; }
        if (rd !== base) { flipAt = dn; newWinner = rd; break; }
      }
      return { attr: a, weight: w0, flipAt, newWinner, base };
    });
  };

  /* --- Robustness test --- */
  function nearestStep(v) {
    let best = 0, d = 1e9;
    S.SAATY_VALUES.forEach((x, i) => { const e = Math.abs(Math.log(x) - Math.log(v)); if (e < d) { d = e; best = i; } });
    return best;
  }
  S.nearestStep = nearestStep;
  S.jitter = function (M, steps, rnd) {
    const A = M.map(r => r.slice());
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
      let k = nearestStep(A[i][j]) + Math.floor(rnd() * (2 * steps + 1)) - steps;
      k = Math.min(S.SAATY_VALUES.length - 1, Math.max(0, k));
      A[i][j] = S.SAATY_VALUES[k]; A[j][i] = 1 / S.SAATY_VALUES[k];
    }
    return A;
  };

  /* Small seeded random generator so a run can be repeated exactly. */
  S.rng = function (seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5; let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  };

  S.monteCarlo = function (state, opts) {
    const rnd = S.rng(opts.seed || 7);
    const N = opts.runs, steps = opts.steps, lo = opts.wMin, hi = opts.wMax;
    const rankCount = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];   // [supplier][position]
    const gaps = [];                                       // S1 score minus S2 score
    const measuredNoise = opts.measuredNoise || 0;          // +/- % on measured numbers
    for (let n = 0; n < N; n++) {
      const J = {};
      for (const k in state.J) J[k] = { m: S.jitter(state.J[k].m, steps, rnd) };
      const meas = {};
      for (const k in state.measured) meas[k] = state.measured[k].map(v => v * (1 + measuredNoise / 100 * (2 * rnd() - 1)));
      const w = lo + (hi - lo) * rnd();
      const L = S.localScores(J, state.mode, meas);
      const sc = S.scoreWith(S.attributeWeights(J, w), L);
      S.rankOf(sc).forEach((sup, pos) => { rankCount[sup][pos]++; });
      gaps.push(sc[0] - sc[1]);
    }
    return {
      winShare: rankCount.map(r => r[0] / N),
      rankShare: rankCount.map(r => r.map(c => c / N)),
      gaps
    };
  };
})(window.SDL);
