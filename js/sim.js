/*
 * sim.js
 * Two-year outlook: what the company should expect to spend and lose
 * under each buying strategy, month by month.
 *
 * For every month:
 *   rods needed       ~ Poisson(rods per year / 12), shared between suppliers by the strategy
 *   bad rods          ~ Binomial(rods from a supplier, that supplier's defect rate)
 *   urgent needs      ~ Poisson(urgent needs per year / 12)
 *   each bad rod or urgent need is a "wait". If the shelf is empty (given chance),
 *   the line stops for the supplier's lead time.
 * Costs:
 *   purchase  = rods x price (price rises with copper each year)
 *   quality   = bad rods x handling cost per bad rod
 *   line stop = stop days x hours lost per day x cost per hour
 */
window.SDL = window.SDL || {};

(function (S) {
  function poisson(lambda, rnd) {
    const L = Math.exp(-lambda); let k = 0, p = 1;
    do { k++; p *= rnd(); } while (p > L);
    return k - 1;
  }
  function binomial(n, p, rnd) { let k = 0; for (let i = 0; i < n; i++) if (rnd() < p) k++; return k; }
  function pickSupplier(shares, rnd) {
    const r = rnd(); let c = 0;
    for (let i = 0; i < 3; i++) { c += shares[i]; if (r < c) return i; }
    return 2;
  }

  S.defectAt = function (measured, plan, i, month) {
    return Math.min(60, measured.defect2018[i] + plan.defectTrendPerYear * (month / 12)) / 100;
  };
  S.priceAt = function (measured, plan, i, month) {
    return measured.price[i] * Math.pow(1 + plan.priceRisePct / 100, month / 12);
  };

  /* One strategy, many simulated futures. */
  S.simulate = function (shares, measured, plan, runs, seed) {
    const rnd = S.rng(seed || 11);
    const M = plan.months;
    const cum = Array.from({ length: M }, () => []);
    const tot = { purchase: 0, quality: 0, stop: 0, bad: 0, stopHours: 0, waits: 0 };
    const finals = [];
    for (let r = 0; r < runs; r++) {
      let c = 0;
      for (let t = 0; t < M; t++) {
        const need = poisson(plan.rodsPerYear / 12, rnd);
        const fromSup = [0, 0, 0];
        for (let k = 0; k < need; k++) fromSup[pickSupplier(shares, rnd)]++;
        const urgent = poisson(plan.urgentPerYear / 12, rnd);
        const urgentSup = [0, 0, 0];
        for (let k = 0; k < urgent; k++) urgentSup[pickSupplier(shares, rnd)]++;
        for (let i = 0; i < 3; i++) {
          if (!fromSup[i] && !urgentSup[i]) continue;
          const bad = binomial(fromSup[i], S.defectAt(measured, plan, i, t), rnd);
          const buy = fromSup[i] * S.priceAt(measured, plan, i, t);
          const qual = bad * plan.costPerBadPart;
          let stopH = 0;
          const waits = bad + urgentSup[i];
          for (let w = 0; w < waits; w++) {
            if (rnd() < plan.shelfEmptyPct / 100) stopH += measured.leadDays[i] * plan.stopHoursPerDay;
          }
          const stop = stopH * plan.stopCostPerHour;
          c += buy + qual + stop;
          tot.purchase += buy; tot.quality += qual; tot.stop += stop;
          tot.bad += bad; tot.stopHours += stopH; tot.waits += waits;
        }
        cum[t].push(c);
      }
      finals.push(c);
    }
    const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
    return {
      mean: cum.map(a => a.reduce((s, x) => s + x, 0) / a.length),
      p10: cum.map(a => q(a, 0.10)),
      p90: cum.map(a => q(a, 0.90)),
      purchase: tot.purchase / runs, quality: tot.quality / runs, stop: tot.stop / runs,
      bad: tot.bad / runs, stopHours: tot.stopHours / runs, waits: tot.waits / runs,
      finals
    };
  };

  /* Expected two-year cost without randomness, used for exact break-even numbers. */
  S.expectedCost = function (i, measured, plan, overrideBadCost) {
    const cb = overrideBadCost === undefined ? plan.costPerBadPart : overrideBadCost;
    let buy = 0, bad = 0;
    for (let t = 0; t < plan.months; t++) {
      const rods = plan.rodsPerYear / 12;
      buy += rods * S.priceAt(measured, plan, i, t);
      bad += rods * S.defectAt(measured, plan, i, t);
    }
    const urgent = plan.urgentPerYear * plan.months / 12;
    const stopH = (bad + urgent) * (plan.shelfEmptyPct / 100) * measured.leadDays[i] * plan.stopHoursPerDay;
    return { buy, bad, qual: bad * cb, stop: stopH * plan.stopCostPerHour, stopH, total: buy + bad * cb + stopH * plan.stopCostPerHour };
  };

  /* Bad-part cost at which supplier a and b cost the same over the period. */
  S.breakEvenBadCost = function (a, b, measured, plan) {
    const A0 = S.expectedCost(a, measured, plan, 0), B0 = S.expectedCost(b, measured, plan, 0);
    const dBad = A0.bad - B0.bad;                // extra bad parts of a over b
    if (Math.abs(dBad) < 1e-9) return null;
    const x = (B0.total - A0.total) / dBad;
    return x > 0 ? x : null;
  };

  /* Priority map: company weights cost, quality and speed; which supplier ranks first? */
  S.priorityWeights = function (J, cost, quality, speed) {
    const sum = cost + quality + speed || 1;
    const w1 = S.priorities(J.C1.m).p;                    // DeliveryTime, Price, Availability
    const w2 = S.priorities(J.C2.m).p;                    // Aftersales, Quality, Sustainability
    const speedSplit = w1[0] + w1[2];
    return {
      Price: cost / sum,
      DeliveryTime: speed / sum * w1[0] / speedSplit,
      Availability: speed / sum * w1[2] / speedSplit,
      Aftersales: quality / sum * w2[0],
      Quality: quality / sum * w2[1],
      Sustainability: quality / sum * w2[2]
    };
  };
})(window.SDL);
