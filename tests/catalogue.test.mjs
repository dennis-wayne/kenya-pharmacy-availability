import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { loadStore, loadListings, listingsFor, popcount } from '../src/lib/store.js';
import { EMPTY, runFilter, encodeFilters, decodeFilters, facetCounts, inStockCoverage, shopCounts, sourceBreakdown } from '../src/lib/filters.js';
import { buildCsv } from '../src/lib/export.js';
const payloads = Object.fromEntries(await Promise.all(['meta','products','listings'].map(async name => [name, JSON.parse(await readFile(new URL(`../static/app/${name}.json`, import.meta.url), 'utf8'))])));
const calls = [];
const bytes = Object.fromEntries(await Promise.all(['meta','products','listings'].map(async name=>[name,await readFile(new URL(`../static/app/${name}.json`,import.meta.url))])));
globalThis.fetch = async url => {
  calls.push(url);
  const key = String(url).split('/').at(-1).replace('.json','');
  return new Response(bytes[key]);
};
const store = await loadStore();
const expected = predicate => Array.from({length:store.P.n},(_,i)=>i).filter(predicate).sort((a,b)=>a-b);
const actual = filters => runFilter(store, {...EMPTY,...filters}).rows.sort((a,b)=>a-b);
const bits = mask => Array.from({length:32},(_,bit)=>!!(mask & (1<<bit))).filter(Boolean).length;

test('16-bit population counts match independent bit iteration across every mask', () => {
  for(let value=0;value<=65535;value++) assert.equal(popcount(value),bits(value));
});
test('loading the catalogue does not fetch source-detail payload', () => assert.deepEqual(calls,['app/meta.json','app/products.json']));
test('all URL dimensions round-trip without changing query grammar', () => {
  const f={...EMPTY,q:'Amoxicillin / Clavulanate & 500mg',types:[1,3],clinicalOnly:true,bands:[1],matchBands:[0],review:'needs_review',gaps:[1],forms:[0],shopsAny:[1,3],shopsAll:[1,2],stockIn:[0],stockOut:[2],listedMin:2,listedMax:5,oosMin:1,oosMax:3,priceMin:0,priceMax:2000,confMin:.7,monograph:'without',contested:true,packKinds:[1],categories:[2,4],therapeutic:[3]};
  assert.deepEqual(decodeFilters(encodeFilters(f)),f);
  assert.equal(encodeFilters(EMPTY).toString(),'');
});
test('product and ingredient search match independent substring oracle', () => {
  for(const q of ['amoxicillin','paracetamol','500mg','NO SUCH PRODUCT 987xyz']) assert.deepEqual(actual({q}),expected(i=>store.P.nameLower[i].includes(q)||store.P.ingredientLower[i].includes(q)));
});
test('ANY and ALL pharmacy masks remain distinct', () => {
  const mask=3;
  assert.deepEqual(actual({shopsAny:[0,1]}),expected(i=>(store.P.listedMask[i]&mask)!==0));
  assert.deepEqual(actual({shopsAll:[0,1]}),expected(i=>(store.P.listedMask[i]&mask)===mask));
});
test('broad in-stock coverage excludes raw availability from non-reporting sources',()=>{
  const covered=inStockCoverage(store,Array.from({length:store.P.n},(_,i)=>i));
  assert.deepEqual([...covered].sort((a,b)=>a-b),expected(i=>bits(store.P.inMask[i])>=5));
  assert.deepEqual(covered.filter(i=>store.P.clinical[i]).sort((a,b)=>a-b),expected(i=>store.P.clinical[i]===1&&bits(store.P.inMask[i])>=5));
  assert.deepEqual(Array.from(store.P.nIn),payloads.products.nIn,'Raw aggregate remains intact for CSV compatibility');
});
test('source facets use permanent bits even when absent sources leave gaps',()=>{
  const counts=shopCounts(store,EMPTY,'shopsAny');
  const breakdown=sourceBreakdown(store,Array.from({length:store.P.n},(_,i)=>i));
  for(const source of store.shops){
    const bit=1<<source.bit;
    assert.equal(counts.listed[source.bit],expected(i=>(store.P.listedMask[i]&bit)!==0).length);
    assert.deepEqual(actual({shopsAny:[source.bit]}),expected(i=>(store.P.listedMask[i]&bit)!==0));
    assert.equal(breakdown.find(r=>r.shop.pharmacy_id===source.pharmacy_id).listed,counts.listed[source.bit]);
  }
});
test('listing source indexes resolve separately from source filter bits',async()=>{
  await loadListings(store);const counts=new Map();
  for(let row=0;row<store.listings.count;row++){
    const source=store.shops[store.listings.shop[row]];
    assert.ok(source);
    assert.ok(store.P.listedMask[store.listings.product[row]]&(1<<source.bit));
    counts.set(source.pharmacy_id,(counts.get(source.pharmacy_id)||0)+1);
  }
  for(const source of store.shops)assert.equal(counts.get(source.pharmacy_id),source.listings);
});
test('stock filters use judged evidence masks and compose with clinical and price bounds', () => {
  const reporting = store.shops.filter(s=>s.publishes_oos).map(s=>s.bit);
  const mask=reporting.reduce((m,b)=>m|(1<<b),0);
  assert.deepEqual(actual({stockIn:reporting}),expected(i=>(store.P.inMask[i]&mask)!==0));
  assert.deepEqual(actual({stockOut:reporting,clinicalOnly:true,priceMin:100,priceMax:2000}),expected(i=>(store.P.oosMask[i]&mask)!==0&&store.P.clinical[i]===1&&Number.isFinite(store.P.priceMed[i])&&store.P.priceMed[i]>=100&&store.P.priceMed[i]<=2000));
});
test('facet counts exclude their own dimension while preserving all others', () => {
  const f={...EMPTY,q:'500',clinicalOnly:true,types:[0]};
  const counts=facetCounts(store,f,'types',store.D.type.length,i=>store.P.type[i]);
  const oracle=Array(store.D.type.length).fill(0);
  for(const i of expected(i=>store.P.clinical[i]===1&&(store.P.nameLower[i].includes('500')||store.P.ingredientLower[i].includes('500')))) oracle[store.P.type[i]]++;
  assert.deepEqual(Array.from(counts),oracle);
});
test('existing pack-kind URL dimension applies its declared product filter',()=>{
  for(let kind=0;kind<store.D.packKind.length;kind++) assert.deepEqual(actual({packKinds:[kind]}),expected(i=>store.P.packKind[i]===kind));
});
test('reference-link filter retains existing flag semantics',()=>{
  assert.deepEqual(actual({monograph:'with'}),expected(i=>store.P.hasMonograph[i]===1));
  assert.deepEqual(actual({monograph:'without'}),expected(i=>store.P.hasMonograph[i]===0));
});
test('CSV retains columns, filtered membership, blank prices, state labels and quoting',()=>{
  const csv=buildCsv(store,{...EMPTY,q:'amoxicillin'});
  const rows=runFilter(store,{...EMPTY,q:'amoxicillin'},{key:'oos',dir:'desc'}).rows;
  assert.equal(csv.count,rows.length);
  assert.equal(csv.text.split('\n')[0],'product_key,name,type,is_clinical,form,pack,active_ingredient,pharmacies_listing,pharmacies_eligible,pharmacies_oos,pharmacies_in_stock,cluster_band,price_min,price_median,price_max,match_confidence,match_band,review_state,class_gap_reason,'+store.shops.map(s=>s.pharmacy_id).join(','));
  assert.ok(csv.text.includes(store.P.key[rows[0]]));
  const small={...store,shops:[],P:{...store.P,n:1,key:['key'],name:['Quoted "name",\nnext line'],nameLower:['quoted'],ingredientLower:[''],priceMin:[NaN],priceMed:[NaN],priceMax:[NaN]}};
  const escaped=buildCsv(small,EMPTY).text;
  assert.ok(escaped.includes('"Quoted ""name"",\nnext line"'));
  assert.ok(!escaped.includes('NaN'));
});
test('listing requests deduplicate, retain source evidence and recover after failure',async()=>{
  store.listings=null;
  const original=globalThis.fetch;
  let n=0;
  globalThis.fetch=async url=>{n++; if(n<=2) throw new Error('temporary offline'); return original(url);};
  await assert.rejects(loadListings(store),/temporary offline/);
  const [a,b]=await Promise.all([loadListings(store),loadListings(store)]);
  assert.equal(a,b);assert.equal(n,3);
  const selected=store.P.inMask.findIndex(mask=>mask!==0);
  const detail=listingsFor(store,selected);
  assert.ok(detail.length>0);
  for(const row of detail) {assert.ok(['in_stock','out_of_stock','not_published'].includes(row.state));assert.ok(!row.url||/^https?:\/\//.test(row.url));}
  globalThis.fetch=original;
});
test('representative full-catalogue filtering stays within a practical local budget',()=>{
  const samples=[];
  for(let i=0;i<20;i++){const start=performance.now();runFilter(store,{...EMPTY,q:'500',clinicalOnly:true,priceMax:5000});samples.push(performance.now()-start);}
  samples.sort((a,b)=>a-b);
  assert.ok(samples[18]<200,`p95 ${samples[18].toFixed(2)}ms`);
  console.log(`Filter latency: median ${samples[10].toFixed(2)}ms; p95 ${samples[18].toFixed(2)}ms on this host`);
});
