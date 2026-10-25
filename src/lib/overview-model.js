import { EMPTY, inStockCoverage, runFilter, summarise } from "./filters.js";
import { popcount } from "./store.js";

/** Overview keeps listing-grain rates separate from resolved-product counts. */
export function availabilityScenarios(pharmacies) {
  const present = pharmacies.filter((p) => p.present_in_snapshot);
  const reporting = present.filter((p) => p.publishes_oos);
  const rate = (rows) => {
    const inStock = rows.reduce((n, p) => n + p.in_stock, 0);
    const out = rows.reduce((n, p) => n + p.out_of_stock, 0);
    return {
      inStock,
      total: inStock + out,
      rate: inStock + out ? (100 * inStock) / (inStock + out) : null,
    };
  };
  const dominant = [...reporting].sort(
    (a, b) => b.out_of_stock - a.out_of_stock,
  )[0];
  return [
    {
      key: "reporting",
      label: "Stock-reporting sources",
      ...rate(reporting),
      note: `${reporting.length} sources with a usable stock signal. This is the headline basis.`,
    },
    {
      key: "all",
      label: "Assume every unrated listing is in stock",
      ...rate(
        present.map((p) => ({
          ...p,
          in_stock: p.publishes_oos
            ? p.in_stock + Math.max(0, p.listings-p.in_stock-p.out_of_stock)
            : p.listings,
          out_of_stock: p.publishes_oos ? p.out_of_stock : 0,
        })),
      ),
      note: "Sensitivity only. Missing stock signals are treated as available under this assumption.",
    },
    ...(dominant && reporting.length > 1
      ? [
          {
            key: "without",
            label: `Exclude ${dominant.name}`,
            ...rate(
              reporting.filter((p) => p.pharmacy_id !== dominant.pharmacy_id),
            ),
            note: "Sensitivity only. Removes the source contributing the most stockout reports.",
          },
        ]
      : []),
  ];
}

export function buildOverviewModel(store) {
  const { P, D, meta } = store;
  const rows =
    store.allRows ?? runFilter(store, EMPTY, { key: "oos", dir: "desc" }).rows;
  const stats = store.allStats ?? summarise(store, rows);
  const clinicalPatch = {
    clinicalOnly: true,
    oosMin: 2,
    review: "auto",
    matchBands: D.matchBand
      .map((name, i) => (name !== "low" ? i : -1))
      .filter((i) => i >= 0),
  };
  const reportable =
    store.overview?.reportable ??
    runFilter(
      store,
      { ...EMPTY, ...clinicalPatch },
      { key: "oos", dir: "desc" },
    ).rows;
  const broad = store.overview?.widelyAvailable ?? inStockCoverage(store, rows);
  const reporting = store.shops
    .filter((p) => p.publishes_oos)
    .map((p) => ({
      ...p,
      rated: p.in_stock + p.out_of_stock,
      rate:
        p.in_stock + p.out_of_stock
          ? (100 * p.in_stock) / (p.in_stock + p.out_of_stock)
          : null,
    }))
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));
  const listedOnly = store.shops.filter((p) => !p.publishes_oos);
  const coverage = [
    { label: "1 source", min: 1, max: 1, count: 0 },
    { label: "2–4 sources", min: 2, max: 4, count: 0 },
    { label: "5+ sources", min: 5, max: 0, count: 0 },
  ];
  for (const i of rows) {
    const bucket = coverage.find(
      (b) => P.nListed[i] >= b.min && (!b.max || P.nListed[i] <= b.max),
    );
    if (bucket) bucket.count++;
  }
  const edges = [250, 500, 1000, 2500, 5000, 10000, Infinity];
  const price = edges.map((max, i) => ({
    label: [
      "≤250",
      "250–500",
      "500–1k",
      "1k–2.5k",
      "2.5k–5k",
      "5k–10k",
      ">10k",
    ][i],
    count: 0,
    max,
  }));
  for (const value of stats.prices) price.find((b) => value <= b.max).count++;
  return {
    rows,
    stats,
    reportable,
    clinicalMulti: rows.filter((i) => P.clinical[i] === 1 && P.nOos[i] >= 2)
      .length,
    clinicalPatch,
    broad,
    broadClinical: broad.filter((i) => P.clinical[i] === 1),
    reporting,
    listedOnly,
    coverage,
    price,
    scenarios: availabilityScenarios(meta.pharmacies),
    reviewCount:
      store.overview?.reviewCount ??
      rows.filter((i) => D.review[P.review[i]] === "needs_review").length,
  };
}

export function productEvidence(store, i) {
  const { P, shops } = store;
  const names = (mask) =>
    shops.filter((s) => mask & (1 << s.bit)).map((s) => s.name);
  return {
    inStock: names(P.inMask[i]),
    out: names(P.oosMask[i]),
    unrated: names(P.listedMask[i] & ~(P.inMask[i] | P.oosMask[i])),
    countIn: popcount(P.inMask[i]),
  };
}
