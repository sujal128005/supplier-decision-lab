/*
 * data.js
 * Every number used by the Supplier Decision Lab, with where it comes from.
 *
 * source codes used below:
 *   PAPER   = printed in Rodrigues, Sirova & Mugurusi (2022), IFAC PapersOnLine 55-10, 2773-2778
 *   RANGE   = the paper gives only a range; the per-supplier split is our assumption inside that range
 *   ASSUMED = not in the paper; a planning assumption the user can edit in the UI
 *   MARKET  = public copper-market figure (see SOURCES at the bottom)
 */
window.SDL = window.SDL || {};

SDL.SUPPLIERS = [
  { id: 0, short: "S1", name: "Supplier 1", place: "Germany",
    note: "Best part quality, highest price, farthest from the factory (PAPER)" },
  { id: 1, short: "S2", name: "Supplier 2", place: "Czech Republic, Central Bohemia",
    note: "Low price, fastest delivery in the paper's judgments" },
  { id: 2, short: "S3", name: "Supplier 3", place: "Czech Republic, North Bohemia",
    note: "Low price, weakest part quality in the paper's judgments" }
];

SDL.MANAGERS = [
  { role: "Maintenance manager", years: 4, background: "Senior electrical engineer",
    view: "Leads the purchase, negotiates price and delivery, controls spare-part stock." },
  { role: "Production manager", years: 5, background: "Senior mechanical engineer",
    view: "A line stop costs more than any delivery charge. Parts must never run out." },
  { role: "Quality manager", years: 10, background: "Senior mechanical engineer",
    view: "Zero-defect policy. Part quality matters far more than price or lead time." }
];

/* The six attributes and their two groups (PAPER, Fig. 1). */
SDL.GROUPS = [
  { key: "C1", name: "Logistic-Economic", attrs: ["DeliveryTime", "Price", "Availability"] },
  { key: "C2", name: "Quality-Sustainability", attrs: ["Aftersales", "Quality", "Sustainability"] }
];

SDL.ATTRS = {
  DeliveryTime:   { label: "Delivery cycle time", short: "Delivery time", group: "C1",
                    meaning: "Days from purchase order to arrival at the warehouse." },
  Price:          { label: "Price", short: "Price", group: "C1",
                    meaning: "Unit purchase price of one copper rod." },
  Availability:   { label: "Supplier availability", short: "Availability", group: "C1",
                    meaning: "How often the supplier responds to an emergency or unplanned order." },
  Aftersales:     { label: "Aftersales customer service", short: "Aftersales", group: "C2",
                    meaning: "How well the supplier responds after the sale." },
  Quality:        { label: "Part quality", short: "Quality", group: "C2",
                    meaning: "Share of parts accepted after the company's own inspection." },
  Sustainability: { label: "Sustainability", short: "Sustainability", group: "C2",
                    meaning: "Share of scrapped parts the supplier remanufactures." }
};
SDL.ATTR_ORDER = ["DeliveryTime", "Price", "Availability", "Aftersales", "Quality", "Sustainability"];

/* Group-consolidated pairwise judgments (geometric mean of the three managers), PAPER Tables 2-9.
   Row i, column j = how much row item is preferred over column item, Saaty 1-9 scale. */
SDL.PAPER_JUDGMENTS = {
  C1: { title: "Inside Logistic-Economic (Table 2)", items: ["Delivery time", "Price", "Availability"],
        m: [[1, 5, 4], [1/5, 1, 1/3], [1/4, 3, 1]], paperInconsistency: 8.25 },
  C2: { title: "Inside Quality-Sustainability (Table 3)", items: ["Aftersales", "Quality", "Sustain."],
        m: [[1, 1/3, 2], [3, 1, 3], [1/2, 1/3, 1]], paperInconsistency: 5.16 },
  DeliveryTime:   { title: "Suppliers on delivery time (Table 4)", items: ["S1", "S2", "S3"],
        m: [[1, 1/5, 1/3], [5, 1, 3], [3, 1/3, 1]], paperInconsistency: 3.70 },
  Quality:        { title: "Suppliers on part quality (Table 5)", items: ["S1", "S2", "S3"],
        m: [[1, 3, 7], [1/3, 1, 5], [1/7, 1/5, 1]], paperInconsistency: 6.24 },
  Availability:   { title: "Suppliers on availability (Table 6)", items: ["S1", "S2", "S3"],
        m: [[1, 1/3, 1/3], [3, 1, 1], [3, 1, 1]], paperInconsistency: 0.00 },
  Aftersales:     { title: "Suppliers on aftersales service (Table 7)", items: ["S1", "S2", "S3"],
        m: [[1, 3, 3], [1/3, 1, 2], [1/3, 1/2, 1]], paperInconsistency: 5.16 },
  Price:          { title: "Suppliers on price (Table 8)", items: ["S1", "S2", "S3"],
        m: [[1, 1/6, 1/8], [6, 1, 1], [8, 1, 1]], paperInconsistency: 0.89 },
  Sustainability: { title: "Suppliers on sustainability (Table 9)", items: ["S1", "S2", "S3"],
        m: [[1, 3, 5], [1/3, 1, 3], [1/5, 1/3, 1]], paperInconsistency: 3.70 }
};

/* Final rankings printed in the paper (Tables 10-12). */
SDL.PAPER_RESULTS = {
  AHP: [0.371467, 0.419439, 0.209094],
  ANP: [0.546076, 0.318691, 0.135233]
};

/* Measured facts. The paper prints only ranges, so the split per supplier is ours. */
SDL.FACTS = {
  priceRange: "EUR 230 to 350 per rod (PAPER)",
  annualSpend: "EUR 25,285 in 2017 and EUR 25,480 in 2018 (PAPER)",
  defectRange2017: "5% to 13.33% (PAPER)",
  defectRange2018: "6.67% to 15% (PAPER), rising at all three suppliers",
  leadRange: "3 to 7 days, steady (PAPER)"
};

SDL.MEASURED_DEFAULT = {
  //            S1     S2     S3
  price:      [350,   230,   235],     // RANGE: S1 is the most expensive; S2 and S3 judged equal on price
  leadDays:   [7,     3,     5],       // RANGE: S1 is farthest; S2 is fastest in Table 4
  defect2017: [5.00,  8.33,  13.33],   // RANGE: S1 best quality, S3 worst (Table 5)
  defect2018: [6.67,  10.00, 15.00]    // RANGE
};

/* Planning assumptions for the two-year outlook. All editable in the UI. */
SDL.PLAN_DEFAULT = {
  rodsPerYear: 90,          // ASSUMED from PAPER: EUR ~25,400 a year / average price ~EUR 280 = about 90 rods
  costPerBadPart: 150,      // ASSUMED: inspection, return freight and paperwork for one rejected rod (EUR)
  urgentPerYear: 4,         // ASSUMED: unplanned breakdowns a year that need a rod at once
  shelfEmptyPct: 5,         // ASSUMED: chance no spare rod is on the shelf when one is needed (%)
  stopHoursPerDay: 8,       // ASSUMED: production hours lost for each day the line waits
  stopCostPerHour: 300,     // ASSUMED: cost of one hour of line stop (EUR)
  defectTrendPerYear: 1.67, // from PAPER: every supplier's defect rate rose about 1.67 points from 2017 to 2018
  priceRisePct: 5,          // ASSUMED, informed by MARKET: copper prices rose sharply in 2025-2026
  months: 24
};

/* Saaty's 1-9 scale, as shown to the managers. */
SDL.SAATY_VALUES = [1/9, 1/8, 1/7, 1/6, 1/5, 1/4, 1/3, 1/2, 1, 2, 3, 4, 5, 6, 7, 8, 9];
SDL.SAATY_WORDS = {
  1: "Equal", 2: "Equal to moderate", 3: "Moderately more", 4: "Moderate to strong",
  5: "Strongly more", 6: "Strong to very strong", 7: "Very strongly more",
  8: "Very strong to extreme", 9: "Extremely more"
};
SDL.RANDOM_INDEX = 0.52;   // value SuperDecisions uses for a 3x3 matrix; reproduces the paper's percentages

SDL.SOURCES = [
  { text: "Rodrigues, M., Sirova, E., Mugurusi, G. (2022). A supplier selection decision model using multi-criteria decision analysis in a small manufacturing company. IFAC PapersOnLine 55-10, 2773-2778.",
    url: "https://doi.org/10.1016/j.ifacol.2022.10.149" },
  { text: "Saaty, T. L. (1980). The Analytic Hierarchy Process. McGraw-Hill.", url: "" },
  { text: "Crux Investor (2026). LME copper averaged USD 13,075.57 per tonne in 2026 so far, 32% above the 2025 average.",
    url: "https://www.cruxinvestor.com/posts/copper-prices-hold-firm-despite-a-fivefold-refined-surplus-shifting-the-focus-to-chinas-demand-growth" },
  { text: "Fastmarkets (2026). LME three-month copper peaked intraday at USD 14,875 per tonne on 10 September 2026.",
    url: "https://fastmarkets.com/insights/base-metals-head-to-lme-week-2026-with-record-low-tcs-war-hit-supply-chains" }
];
