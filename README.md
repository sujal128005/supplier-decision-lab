# Supplier Decision Lab

An interactive, offline web application that re-analyses and extends the AHP/ANP supplier selection model of:

> Rodrigues, M., Šírová, E., & Mugurusi, G. (2022). *A supplier selection decision model using multi-criteria decision analysis in a small manufacturing company.* IFAC PapersOnLine, 55(10), 2773–2778. https://doi.org/10.1016/j.ifacol.2022.10.149

Built for the **Seminar course (ME496)**, Department of Mechanical Engineering, IIITDM Kurnool.
Course instructors: Dr. S. Anand Kumar and Dr. Anuj Kumar. Author: Sujal Negi (123ME0023).

---

## Contents

1. [What the project does](#1-what-the-project-does)
2. [Quick start](#2-quick-start)
3. [The five tabs](#3-the-five-tabs)
4. [Project structure](#4-project-structure)
5. [How the calculations work](#5-how-the-calculations-work)
6. [Data and where it comes from](#6-data-and-where-it-comes-from)
7. [Key results](#7-key-results)
8. [Documents in this repository](#8-documents-in-this-repository)
9. [Limitations](#9-limitations)
10. [References](#10-references)

---

## 1. What the project does

The paper chooses one of three suppliers of copper rods (a critical spare part) for a small Czech car-parts maker. Three managers (Maintenance, Production, Quality) compare six attributes on Saaty's 1–9 scale. The paper solves the problem twice:

| Method | Winner | Scores (S1 / S2 / S3) |
|---|---|---|
| AHP | Supplier 2 | 0.371 / 0.419 / 0.209 |
| ANP | Supplier 1 | 0.546 / 0.319 / 0.135 |

This project:

- **Rebuilds** both results from the paper's own tables (Tables 2–9) and matches them to 4 decimals.
- **Shows** that the ANP result equals an ordinary AHP calculation with the two criteria weighted 1 : 5, so the change of winner comes from one judgment, not from the network method.
- **Finds the tipping point**: the winner flips when the weight of Logistic-Economic crosses **0.442**.
- **Adds four improvements**: sensitivity analysis, scoring with real numbers, a Monte Carlo robustness test, and a 24-month cost simulation of buying plans.

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

## 3. The five tabs

The switch at the top right, **Opinions (paper)** / **Real numbers**, changes how price, delivery time and quality are scored in every tab. **Reset** returns everything to the paper's values.

| Tab | Type | What it shows | What you can change |
|---|---|---|---|
| **Paper's model** | From the paper | Supplier cards; paper result vs rebuilt result (AHP 1 : 1 and ANP 1 : 5); decision tree with live weights; all 8 pairwise tables with priorities and consistency ratio (CR) | Every pairwise judgment (slider per comparison) |
| **Sensitivity** | New | Final score of each supplier as the Logistic-Economic weight moves from 0 to 1; flip point; one-attribute sensitivity table | Group weight slider; presets for paper AHP (0.50) and ANP (0.17) |
| **Real numbers** | New | Editable measured values; attribute scores from opinions vs from real numbers; final scores both ways | Price, delivery days, defect rate per supplier |
| **Robustness** | New | Share of trials each supplier wins; finishing positions (1st / 2nd / 3rd); histogram of the S1 − S2 score gap | Judgment uncertainty (0, ±1, ±2 steps), weight range, number of trials |
| **2-year outlook** | New | Ranking for a chosen priority (cost / quality / speed); tipping points; month-by-month cost of four buying plans with an 80% band; totals per plan | Priority sliders and presets; split share S1/S2; all planning assumptions |

## 4. Project structure

```
supplier-decision-lab/
├── index.html              Page layout: top bar, 5 tabs, all sections
├── css/style.css           Styles (large type for projector use)
├── js/
│   ├── data.js             Every input number, with its source (paper / estimate / market)
│   ├── ahp.js              AHP maths: priorities, CR, scores, flip points, sensitivity, Monte Carlo
│   ├── sim.js              24-month cost simulation and break-even calculations
│   └── app.js              Screens, charts and controls (one shared state object)
├── assets/
│   ├── vendor/chart.umd.js Chart.js 4.4.1 (MIT licence, bundled for offline use)
│   └── fonts/              IBM Plex Sans / Mono, Archivo (bundled)
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

RI = 0.52 is the value used by the SuperDecisions software. With it, the program reproduces every inconsistency percentage printed in the paper (8.25%, 5.16%, 3.70%, 6.24%, 0.00%, 5.16%, 0.89%, 3.70%). The UI marks CR ≤ 5% green (Saaty's limit for three items), 5–10% amber and above 10% red.

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
2. *w* is drawn uniformly from the chosen range (default 0.1–0.9).
3. In real-number mode, every measured value varies by up to ±5%.
4. All scores are recomputed and the finishing positions are counted.

A supplier counts as a reliable winner if it wins at least 80% of trials.

### 5.8 Two-year cost simulation (`sim.js → simulate`)

Each month *t* (24 months, 400 runs per plan, seeds 100–103):

| Quantity | Model |
|---|---|
| Rods needed | Poisson(R / 12), shared between suppliers by the plan |
| Bad rods | Binomial(rods from supplier, defect rate *d<sub>i</sub>(t)*), *d<sub>i</sub>(t) = d<sub>i,2018</sub> + g·t/12* |
| Urgent needs | Poisson(U / 12) |
| Line stop | Each bad rod or urgent need: with probability *q* the shelf is empty and the line stops for the supplier's lead time × *h* hours per day |
| Price | *P<sub>i</sub>(t) = P<sub>i</sub> · (1 + r)<sup>t/12</sup>* |

```
Cost = rods × price  +  bad rods × c_b  +  stop hours × c
```

The chart shows the mean and the 10th–90th percentile band. `expectedCost` computes the same model without randomness to give exact tipping points:

- the bad-rod cost at which S1 and S2 cost the same
- the price S1 must reach to match S2
- the extra line-stop hours of S1 over S2

## 6. Data and where it comes from

Every number lives in `js/data.js` with a source tag.

| Data | Value | Source |
|---|---|---|
| Pairwise judgments (8 matrices) | Tables 2–9 | Paper |
| AHP / ANP final scores | Tables 10–11 | Paper |
| Price range | €230–350 | Paper, Section 3 |
| Delivery time range | 3–7 days | Paper, Section 3 |
| Defect range 2017 / 2018 | 5–13.33% / 6.67–15% | Paper, Section 3 |
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

All estimates can be edited in the UI (Real numbers tab, and Planning assumptions on the 2-year outlook tab).

## 7. Key results

| Finding | Value |
|---|---|
| AHP and ANP rebuilt from the paper's tables | Match to 4 decimals |
| Group weight that reproduces the paper's ANP result | *w* = 1/6 (quality 5 × logistics) |
| Flip point S1 ↔ S2 (opinions / real numbers) | 0.442 / 0.472 |
| Matrices above Saaty's 5% CR limit | 4 of 8 (Tables 2, 3, 5, 7) |
| Robustness, 5,000 trials (opinions) | S1 41.9%, S2 58.1%, S3 0% |
| Robustness, 5,000 trials (real numbers) | S1 46.0%, S2 54.0%, S3 0% |
| 24-month cost: only S1 / only S2 / only S3 / split 50-50 | €86,426 / €56,120 / €72,321 / €72,361 |
| Bad-rod cost at which S1 pays off | > €5,250 per rod |
| Price S1 must reach to match S2 | ≈ €188 per rod (now €350) |

**Conclusion:** Supplier 3 can be dropped. Suppliers 1 and 2 are nearly tied, and the answer depends on how the company weighs quality against logistics. Over two years Supplier 2 is cheaper, unless a defective rod is very costly.

## 8. Documents in this repository

| File | Contents |
|---|---|
| `docs/Seminar_Report.pdf` | Full seminar report: review, re-analysis, proposed model, results, references |
| `docs/Seminar_Presentation.pdf` | 8-slide seminar presentation |
| `docs/Seminar_Data_and_Charts.xlsx` *(if present)* | Every table and chart of the report, with sources (sheets T1–T8) |

## 9. Limitations

- The paper publishes only ranges for price, delivery time and defect rate, so per-supplier values are estimates.
- Individual managers' judgments are not published, so manager weighting is not modelled.
- The ANP supermatrix is not published, so ANP is matched through the group weight, not rebuilt step by step.
- Cost-simulation inputs marked "estimate" should be replaced with company data for a real decision.

## 10. References

1. Rodrigues, M., Šírová, E., & Mugurusi, G. (2022). A supplier selection decision model using multi-criteria decision analysis in a small manufacturing company. *IFAC PapersOnLine*, 55(10), 2773–2778.
2. Saaty, T. L. (1980). *The Analytic Hierarchy Process*. McGraw-Hill.
3. Saaty, T. L. (2005). *Theory and Applications of the Analytic Network Process*. RWS Publications.
4. Alegoz, M., & Yapicioglu, H. (2019). Supplier selection and order allocation decisions under quantity discount and fast service options. *Sustainable Production and Consumption*, 18, 179–189.
5. Chart.js 4.4.1, MIT licence. https://www.chartjs.org
