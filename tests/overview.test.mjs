import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadStore } from "../src/lib/store.js";
import { EMPTY, runFilter } from "../src/lib/filters.js";
import {
  availabilityScenarios,
  buildOverviewModel,
  productEvidence,
} from "../src/lib/overview-model.js";
const bytes = Object.fromEntries(
  await Promise.all(
    ["meta", "products"].map(async (key) => [
      key,
      await readFile(new URL(`../static/app/${key}.json`, import.meta.url)),
    ]),
  ),
);
globalThis.fetch = async (url) =>
  new Response(bytes[String(url).split("/").at(-1).replace(".json", "")]);
const store = await loadStore();
const raw = JSON.parse(bytes.products);
const model = buildOverviewModel(store);
const bits = (mask) =>
  Array.from({ length: 32 }, (_, i) => Boolean(mask & (1 << i))).filter(Boolean)
    .length;

test("Overview availability uses rated listing counts and keeps unknown feeds separate", () => {
  const reporting = store.meta.pharmacies.filter(
    (p) => p.present_in_snapshot && p.publishes_oos,
  );
  const stock = reporting.reduce((n, p) => n + p.in_stock, 0);
  const rated = reporting.reduce((n, p) => n + p.in_stock + p.out_of_stock, 0);
  assert.equal(model.scenarios[0].inStock, stock);
  assert.equal(model.scenarios[0].total, rated);
  assert.equal(model.scenarios[0].rate, (100 * stock) / rated);
  assert.equal(model.scenarios[1].total, store.meta.headline.listings);
  assert.equal(
    model.scenarios[1].inStock,
    stock + store.meta.headline.not_published,
  );
  assert.equal(model.reporting.length, reporting.length);
  assert.equal(model.listedOnly.length, store.shops.length-reporting.length);
  for (const p of model.reporting)
    assert.equal(p.rate, (100 * p.in_stock) / (p.in_stock + p.out_of_stock));
  assert.equal(availabilityScenarios([])[0].rate, null);
});
test("Overview clinical queue count matches its complete drill-down and independent criteria", () => {
  const oracle = raw.key
    .map((_, i) => i)
    .filter(
      (i) =>
        raw.clinical[i] === 1 &&
        raw.nOos[i] >= 2 &&
        store.D.matchBand[raw.matchBand[i]] !== "low" &&
        store.D.review[raw.review[i]] === "auto",
    );
  assert.deepEqual(
    [...model.reportable].sort((a, b) => a - b),
    oracle,
  );
  assert.deepEqual(
    runFilter(
      store,
      { ...EMPTY, ...model.clinicalPatch },
      { key: "oos", dir: "desc" },
    ).rows,
    model.reportable,
  );
  assert.equal(
    model.clinicalMulti,
    raw.key.filter((_, i) => raw.clinical[i] === 1 && raw.nOos[i] >= 2).length,
  );
});
test("Coverage groups partition products and each drill-down preserves exact membership", () => {
  assert.equal(
    model.coverage.reduce((n, b) => n + b.count, 0),
    raw.key.length,
  );
  for (const b of model.coverage) {
    const oracle = raw.nListed
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v >= b.min && (!b.max || v <= b.max))
      .map(({ i }) => i);
    const actual = runFilter(store, {
      ...EMPTY,
      listedMin: b.min,
      listedMax: b.max,
    }).rows.sort((a, b) => a - b);
    assert.equal(b.count, oracle.length);
    assert.deepEqual(actual, oracle);
  }
  assert.equal(
    model.broad.length,
    raw.inMask.filter((mask) => bits(mask) >= 5).length,
  );
  assert.equal(model.broadClinical.length,raw.inMask.filter((mask,i)=>bits(mask)>=5&&raw.clinical[i]===1).length);
});
test("Price histogram excludes missing/nonpositive values and assigns every boundary once", () => {
  assert.equal(
    model.price.reduce((n, b) => n + b.count, 0),
    raw.priceMed.filter((v) => v != null && Number.isFinite(v) && v > 0).length,
  );
  const values = [250, 250.1, 500, 500.1, 1000, 2500, 5000, 10000, 10000.1];
  const fixture = buildOverviewModel({
    ...store,
    allRows: [],
    allStats: { ...model.stats, prices: values },
  });
  assert.deepEqual(
    fixture.price.map((b) => b.count),
    [1, 2, 2, 1, 1, 1, 1],
  );
});
test("Named pharmacy evidence faithfully decodes judged masks and never substitutes raw in counts", () => {
  for (const i of [...model.reportable, ...model.broad]) {
    const evidence = productEvidence(store, i);
    const oracle = (mask) =>
      store.shops.filter((p) => mask & (1 << p.bit)).map((p) => p.name);
    assert.deepEqual(evidence.inStock, oracle(raw.inMask[i]));
    assert.deepEqual(evidence.out, oracle(raw.oosMask[i]));
    assert.deepEqual(
      evidence.unrated,
      oracle(raw.listedMask[i] & ~(raw.inMask[i] | raw.oosMask[i])),
    );
    assert.equal(evidence.countIn, bits(raw.inMask[i]));
  }
});
