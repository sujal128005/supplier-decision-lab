# Supplier Decision Lab

An interactive, offline web application that re-analyses and extends the AHP/ANP supplier selection model of:

> Rodrigues, M., Šírová, E., & Mugurusi, G. (2022). *A supplier selection decision model using multi-criteria decision analysis in a small manufacturing company.* IFAC PapersOnLine, 55(10), 2773-2778. https://doi.org/10.1016/j.ifacol.2022.10.149

Built for the **Seminar course (ME496)**, Department of Mechanical Engineering, IIITDM Kurnool.
Course instructors: Dr. S. Anand Kumar and Dr. Anuj Kumar. Author: Sujal Negi (123ME0023).

---

## Contents

1. [What the project does](#1-what-the-project-does)
2. [Quick start](#2-quick-start)
3. [The page](#3-the-page-one-simple-page-eight-steps)
4. [Project structure](#4-project-structure)
5. [How the calculations work](#5-how-the-calculations-work)
6. [Data and where it comes from](#6-data-and-where-it-comes-from)
7. [Key results](#7-key-results)
8. [Documents in this repository](#8-documents-in-this-repository)
9. [Limitations](#9-limitations)
10. [References](#10-references)

---

## 1. What the project does

The paper chooses one of three suppliers of copper rods (a critical spare part) for a small Czech car-parts maker. Three managers (Maintenance, Production, Quality) compare six attributes on Saaty's 1-9 scale. The paper solves the problem twice:

| Method | Winner | Scores (S1 / S2 / S3) |
|---|---|---|
| AHP | Supplier 2 | 0.371 / 0.419 / 0.209 |
| ANP | Supplier 1 | 0.546 / 0.319 / 0.135 |

This project:

- **Rebuilds** both results from the paper's own tables (Tables 2-9) and matches them to 4 decimals.
- **Shows** that the ANP result equals an ordinary AHP calculation with the two criteria weighted 1 : 5, so the change of winner comes from one judgment, not from the network method.
- **Finds the tipping point**: the winner flips when the weight of Logistic-Economic crosses **0.442**.
- **Adds five improvements**: re-checking one answer in each inconsistent table, scoring with real numbers, the flip point, a 5,000-trial robustness test, and a 24-month cost of each buying plan.

## 2. Quick start

No installation, no internet and no `npm install` needed. Charts (Chart.js 4.4.1) and fonts are bundled.

**With Node.js (recommended)**

```bash
node server.js
```

The browser opens at **http://localhost:8080**. Press `Ctrl+C` to stop.

**Without Node.js**

```bash
python -m http.server 8080      # Windows
python3 -m http.server 8080     # macOS / Linux
```

Then open http://localhost:8080. On Windows you can also double-click `start.bat`.

**Different port**

```powershell
$env:PORT=8090; node server.js   # PowerShell
```
```bash
PORT=8090 node server.js         # macOS / Linux
```

> Open the page through the server. Opening `index.html` directly from disk may not load correctly in some browsers.

## 3. The page: paper's model vs my model

The page has two columns separated by a thick line:

- **Left (grey): Paper's model.** The paper's 8 answer tables exactly as published, all six attributes scored from opinions.
- **Right (green): My model.** The same inputs with two changes: (1) one doubtful answer re-checked (moved one step) in each table above 5% CR, (2) price, delivery time and part quality scored from real numbers.

Each row compares the same thing on both sides, with the working shown:

| Row | What it shows |
|---|---|
| 1 Input answers | The 8 tables (left editable, right follows; re-checked cells in green), CR of each, and the full eigenvector/CR working of one chosen table |
| 2 Attribute scores | Score of each supplier on each attribute and where it comes from (opinion or real numbers); measured values (editable) |
| 3 Final score | Global weight × score for every attribute; left matches paper Table 10 (w = 0.5) and Table 11 (w = 1/6) |
| 4 Flip point | Exact w at which Supplier 1 and Supplier 2 swap |
| 5 How sure | 5,000 random trials for each model |
| 6 Two-year cost | Only on the right: expected cost of each buying plan (inputs editable) |
| Why my model is better | Point-by-point comparison of both columns |

The group weight w (top bar) applies to both columns. **Reset to paper values** restores everything.

## 4. Project structure

```
supplier-decision-lab/
├── index.html              Page layout: summary and steps 1 to 8
├── css/style.css           Plain styles, large text
├── js/
│   ├── data.js             Every input number, with its source (paper / estimate / market)
│   ├── ahp.js              AHP maths: priorities, CR, scores, flip points, sensitivity, Monte Carlo
│   ├── sim.js              Two-year expected cost and break-even calculations
│   └── app.js              The two-column page: paper's model vs my model
├── assets/
│   ├── vendor/chart.umd.js Chart.js 4.4.1 (MIT licence, bundled for offline use)
├── server.js               Zero-dependency Node.js static server (port 8080)
├── start.bat / start.sh    Start scripts (Node, falling back to Python)
└── docs/                   Seminar report, presentation and data workbook
```

All code is plain HTML, CSS and JavaScript (ES2017+). There is no build step and no framework.

## 5. How the calculations work

### 5.1 Priorities from a pairwise matrix (`ahp.js → priorities`)

For a reciprocal matrix *A* (where *a<sub>ji</sub> = 1 / a<sub>ij</sub>*), the weights *w* are the principal eigenvector, *A w = λ<sub>max</sub> w*. They are found with the **power method**: multiply *A* by the vector, normalise, and repeat until the change is below 10⁻¹³.

### 5.2 Consistency ratio

```
CI = (λmax − n) / (n − 1)        CR = CI / RI        RI = 0.52 for n = 3
```

RI = 0.52 is the value used by the SuperDecisions software. With it, the program reproduces every inconsistency percentage printed in the paper (8.25%, 5.16%, 3.70%, 6.24%, 0.00%, 5.16%, 0.89%, 3.70%). The page marks CR ≤ 5% green (Saaty's limit for three items) and above 5% red.

### 5.3 Final score

```
S_i(w) = w · Σ_{a∈C1} v_a · p_{a,i}  +  (1 − w) · Σ_{a∈C2} v_a · p_{a,i}
```

- *w*: weight of C1 (Logistic-Economic)
- *v<sub>a</sub>*: weight of attribute *a* inside its group
- *p<sub>a,i</sub>*: score of supplier *i* on attribute *a*

With *w* = 0.5 this gives the paper's AHP result, and with *w* = 1/6 the paper's ANP result.

### 5.4 Flip point (`ahp.js → winnerFlips`)

Each score is a straight line in *w*, so the crossing of suppliers *i* and *j* is exact:

```
w* = [S_i(0) − S_j(0)] / ([S_i(0) − S_j(0)] − [S_i(1) − S_j(1)])
```

For S1 and S2 this is **0.442**.

### 5.5 One-attribute sensitivity (`ahp.js → attributeSensitivity`)

One attribute's global weight is moved up or down in 400 fine steps, with the other weights scaled so the total stays 1. The first weight at which the winner changes is reported.

### 5.6 Real-number scoring (`ahp.js → costScores`)

For price, delivery days and defect rate, lower is better:

```
p_i = (1 / x_i) / Σ_k (1 / x_k)
```

This keeps the real ratios: a supplier 1.5 times dearer gets a price score 1.5 times lower. Availability, aftersales and sustainability keep the managers' judgments.

### 5.7 Robustness test (`ahp.js → monteCarlo`)

In each trial (default 5,000, seeded random generator, seed 7):

1. Every judgment moves by −1, 0 or +1 step on the Saaty scale (or ±2, or none).
2. *w* is drawn uniformly from the chosen range (default 0.1-0.9).
3. In real-number mode, every measured value varies by up to ±5%.
4. All scores are recomputed and the finishing positions are counted.

A supplier counts as a reliable winner if it wins at least 80% of trials.

### 5.8 Re-checking doubtful answers (`app.js → fixTable`), my model only

For every table with CR above 5%, each single answer is moved one step on the Saaty scale (both directions), and the change giving the lowest CR is kept. This is repeated (at most 3 times) until CR ≤ 5%. With the paper's tables one change per table is enough:

| Table | Answer | Change | CR |
|---|---|---|---|
| T2 | Price vs Availability | 1/3 → 1/2 | 8.25% → 2.36% |
| T3 | Aftersales vs Sustainability | 2 → 1 | 5.16% → 0.00% |
| T5 | Part quality: S1 vs S2 | 3 → 2 | 6.24% → 1.36% |
| T7 | Aftersales: S2 vs S3 | 2 → 1 | 5.16% → 0.00% |

### 5.9 Two-year expected cost (`sim.js → expectedCost`), my model only

For each month *t* of 24:

| Quantity | Formula |
|---|---|
| Rods bought | R / 12 per month |
| Price | *P<sub>i</sub> · (1 + r)<sup>t/12</sup>* |
| Bad rods | rods × *d<sub>i</sub>(t)*, with *d<sub>i</sub>(t) = d<sub>i,2018</sub> + g·t/12* |
| Line-stop hours | (bad rods + urgent needs) × *q* × delivery days × *h* |

```
Cost = rods × price  +  bad rods × c_b  +  stop hours × c
```

A 50/50 split is the average of the S1 and S2 plans. From the same model the page gives the bad-rod cost at which S1 and S2 cost the same (about €5,250).

## 6. Data and where it comes from

Every number lives in `js/data.js` with a source tag.

| Data | Value | Source |
|---|---|---|
| Pairwise judgments (8 matrices) | Tables 2-9 | Paper |
| AHP / ANP final scores | Tables 10-11 | Paper |
| Price range | €230-350 | Paper, Section 3 |
| Delivery time range | 3-7 days | Paper, Section 3 |
| Defect range 2017 / 2018 | 5-13.33% / 6.67-15% | Paper, Section 3 |
| Yearly spend | €25,285 (2017), €25,480 (2018) | Paper, Section 3 |
| Per-supplier price, days, defects | 350/230/235 €, 7/3/5 days, 6.67/10/15 % | **Estimate** inside the paper's ranges, following its rankings |
| Rods per year, *R* | 90 | Derived: yearly spend / average price |
| Defect rise, *g* | 1.67 points / year | Paper: 2017 → 2018 rise |
| Copper price rise, *r* | 5% / year | Estimate; LME copper 2026 average ≈ 32% above 2025 |
| Bad-rod handling cost, *c<sub>b</sub>* | €150 | Estimate |
| Urgent needs per year, *U* | 4 | Estimate |
| Chance shelf is empty, *q* | 5% | Estimate |
| Hours lost per waiting day, *h* | 8 | Estimate (one shift) |
| Line-stop cost per hour, *c* | €300 | Estimate |

All estimates can be edited on the page (rows 2 and 6, right column).

## 7. Key results

| Finding | Value |
|---|---|
| AHP and ANP rebuilt from the paper's tables | Match to 4 decimals |
| Group weight that reproduces the paper's ANP result | *w* = 1/6 (quality 5 × logistics) |
| Flip point S1 ↔ S2 (opinions / real numbers) | 0.442 / 0.472 |
| Matrices above Saaty's 5% CR limit | 4 of 8 (Tables 2, 3, 5, 7) |
| Robustness, 5,000 trials (opinions) | S1 41.9%, S2 58.1%, S3 0% |
| Consistency after re-checking one answer per table | 8 of 8 tables within 5% |
| My model, w = 0.5 (S1 / S2 / S3) | 0.367 / 0.374 / 0.259, flip at 0.486 |
| Robustness, 5,000 trials (my model) | S1 47.5%, S2 52.5%, S3 0% |
| 24-month expected cost: only S1 / only S2 / only S3 / split 50-50 | €87,500 / €56,928 / €71,553 / €72,214 |
| Bad-rod cost at which S1 pays off | > €5,250 per rod |
| Price S1 must reach to match S2 | ≈ €188 per rod (now €350) |

**Conclusion:** Supplier 3 can be dropped. Suppliers 1 and 2 are nearly tied, and the answer depends on how the company weighs quality against logistics. Over two years Supplier 2 is cheaper, unless a defective rod is very costly.

## 8. Documents in this repository

| File | Contents |
|---|---|
| `docs/Seminar_Report.pdf` | Full seminar report: review, gaps, proposed model, results, references |
| `docs/Seminar_Presentation.pdf` | 7-slide seminar presentation |

## 9. Limitations

- The paper publishes only ranges for price, delivery time and defect rate, so per-supplier values are estimates.
- Individual managers' judgments are not published, so manager weighting is not modelled.
- The ANP supermatrix is not published, so ANP is matched through the group weight, not rebuilt step by step.
- Cost-simulation inputs marked "estimate" should be replaced with company data for a real decision.

## 10. References

1. Rodrigues, M., Šírová, E., & Mugurusi, G. (2022). A supplier selection decision model using multi-criteria decision analysis in a small manufacturing company. *IFAC PapersOnLine*, 55(10), 2773-2778.
2. Saaty, T. L. (1980). *The Analytic Hierarchy Process*. McGraw-Hill.
3. Saaty, T. L. (2005). *Theory and Applications of the Analytic Network Process*. RWS Publications.
4. Alegoz, M., & Yapicioglu, H. (2019). Supplier selection and order allocation decisions under quantity discount and fast service options. *Sustainable Production and Consumption*, 18, 179-189.
5. Chart.js 4.4.1, MIT licence. https://www.chartjs.org
