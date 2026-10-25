import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceBit, SOURCE_IDS } from '../pipeline/source-bits.js';
import { assessFeed } from '../pipeline/shops.js';
import { popcount } from '../src/lib/store.js';
import { chooseListingKey } from '../pipeline/ingest.js';

test('permanent pharmacy filter bits survive source omissions and catalogue reordering', () => {
  const ranks = ['mydawa', 'garnet', 'faiz', 'pharmaplus'];
  assert.deepEqual(ranks.map(sourceBit), [16, 0, 17, 15]);
  assert.equal(new Set(SOURCE_IDS.map(sourceBit)).size, SOURCE_IDS.length);
  assert.equal(sourceBit('onestop'), 14);
  assert.throws(() => sourceBit('unregistered'), /permanent URL bit/);
});

test('source masks preserve high pharmacy bits beyond the old 16-bit ceiling', () => {
  for (const value of [1 << 16, 1 << 17, (1 << 17) | 1, 0x7fffffff, 0xffffffff]) {
    assert.equal(popcount(value), (value >>> 0).toString(2).replaceAll('0', '').length);
  }
});

test('explicit per-record stock evidence permits a genuine single-state catalogue', () => {
  const feed = { rows: 1050, distinctStatuses: ['In Stock'], inStock: 1050, outOfStock: 0, unknown: 0 };
  assert.equal(assessFeed(feed).publishes_oos, false);
  assert.equal(assessFeed({ ...feed, captureComplete: true, verifiedStock: true }).publishes_oos, true);
  assert.equal(assessFeed({ ...feed, captureComplete: true }).publishes_oos, false);
});

test('a reconciled small source is distinguished from a truncated scrape', () => {
  const feed = { rows: 25, distinctStatuses: ['In Stock', 'Out of Stock'], inStock: 20, outOfStock: 5, unknown: 0 };
  assert.equal(assessFeed(feed).quarantined, true);
  assert.equal(assessFeed({ ...feed, captureComplete: true }).quarantined, false);
});

test('rare reused product URLs select the truly unique source SKU', () => {
  const rows=Array.from({length:1000},(_,i)=>['Product '+i,null,null,null,100,'In Stock','https://example.test/'+(i===999?998:i),null,'SKU-'+i]);
  assert.deepEqual(chooseListingKey(rows),{strategy:'sku',cardinality:1000});
});
