import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {verifyReadModel,fetchReadModel} from '../src/lib/read-model.ts';
const bytes=await readFile(new URL('../static/app/meta.json',import.meta.url));
test('release identity accepts the exact snapshot and rejects truncation and same-size corruption',async()=>{
  await verifyReadModel('meta',bytes);
  await assert.rejects(verifyReadModel('meta',bytes.subarray(1)),/size mismatch/);
  const altered=Uint8Array.from(bytes);altered[100]^=1;
  await assert.rejects(verifyReadModel('meta',altered),/identity mismatch/);
});
test('read model retries a transient response once and validates before parsing',async()=>{
  let attempts=0;globalThis.fetch=async()=>++attempts===1?new Response('',{status:503}):new Response(bytes);
  const progress=[];const meta=await fetchReadModel('meta',value=>progress.push(value));
  assert.equal(attempts,2);assert.equal(meta.headline.products,JSON.parse(bytes).headline.products);assert.equal(progress.at(-1),1);
});
test('read model stops after bounded failures and does not retry identity errors or 404',async()=>{
  let attempts=0;globalThis.fetch=async()=>{attempts++;return new Response('',{status:503});};
  await assert.rejects(fetchReadModel('meta'),/request failed/);assert.equal(attempts,2);
  attempts=0;globalThis.fetch=async()=>{attempts++;return new Response('',{status:404});};
  await assert.rejects(fetchReadModel('meta'),/404/);assert.equal(attempts,1);
  attempts=0;const altered=Uint8Array.from(bytes);altered[100]^=1;globalThis.fetch=async()=>{attempts++;return new Response(altered);};
  await assert.rejects(fetchReadModel('meta'),/identity mismatch/);assert.equal(attempts,1);
});
