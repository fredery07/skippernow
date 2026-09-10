import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const src=fs.readFileSync(new URL('../supabase/functions/mission-documents/index.ts',import.meta.url),'utf8');
const user={id:'11111111-1111-1111-1111-111111111111'};
const client={id:'22222222-2222-2222-2222-222222222222'};
const other={id:'33333333-3333-3333-3333-333333333333'};
const m={id:'44444444-4444-4444-4444-444444444444',provider_id:user.id,client_id:client.id,payment_status:'paid',stripe_payment_intent_id:'pi_confirmed',amount_cents:6000,currency:'eur'};
const profile={role:'provider',verified:true,suspended:false};
let actor=user,p=profile,queries=[],signed=0;
const db={from(table){const filters={};const query={select(){return query},eq(k,v){filters[k]=v;return query},order(){return query},single(){return query},maybeSingle(){return query},then(resolve){queries.push({table,filters});let data=table==='profiles'?p:table==='missions'?m:table==='mission_invoices'?(filters.id==='55555555-5555-5555-5555-555555555555'&&filters.mission_id===m.id?{id:filters.id,object_path:m.id+'/invoice.pdf'}:null):null;return Promise.resolve({data,error:null}).then(resolve)}};return query},storage:{from(){return {async createSignedUrl(path,expires,options){signed++;assert.equal(expires,60);assert.ok(options.download.endsWith('.pdf'));return {data:{signedUrl:'https://example.test/'+path}}}}}}};
const scope={Response,Request,FormData,File,TextDecoder,Uint8Array,crypto,AbortSignal,console,context:async()=>({user:actor,admin:db}),cors:{},Deno:{serve(){},env:{get(){return ''}}}};
vm.createContext(scope);vm.runInContext(src.replace(/^import .*;\n/m,'').replaceAll('export ',''),scope);
const {canRead,canUpload,validatePdf,paymentReceipt,handle}=scope;
assert.equal(canRead(m,user,profile),true);assert.equal(canRead(m,client,{role:'client'}),true);assert.equal(canRead(m,other,{role:'admin'}),true);
assert.equal(canRead(m,other,profile),false);assert.equal(canRead(m,user,{...profile,suspended:true}),false);
assert.equal(canUpload(m,user,profile),true);assert.equal(canUpload(m,client,{role:'client',verified:true}),false);assert.equal(canUpload(m,other,{role:'admin',verified:true}),false);
assert.equal(canUpload(m,user,{...profile,verified:false}),false);assert.equal(canUpload({...m,payment_status:'unpaid'},user,profile),false);
assert.equal(canUpload({...m,provider_id:other.id,skipper_id:user.id},user,profile),false);
validatePdf(new TextEncoder().encode('%PDF-1.7\ncontent\n%%EOF'));
assert.throws(()=>validatePdf(new TextEncoder().encode('<html>not a pdf</html>')));assert.throws(()=>validatePdf(new Uint8Array(8388609)));
const pi={id:'pi_confirmed',status:'succeeded',metadata:{mission_id:m.id},amount_received:6000,amount:6000,currency:'eur'};
const charge={id:'ch_paid',payment_intent:pi.id,paid:true,amount_captured:6000,currency:'eur',created:1789059600,amount_refunded:1000};
const receipt=paymentReceipt(pi,charge,m);assert.equal(receipt.total,6000);assert.equal(receipt.refunded,1000);assert.equal(receipt.reference,'SN-ch_paid');assert.ok(!('platform_fee_cents' in receipt));
for(const bad of [{...pi,metadata:{mission_id:other.id}},{...pi,status:'processing'},{...pi,amount_received:1},{...pi,currency:'usd'},{...pi,id:'pi_other'}])assert.throws(()=>paymentReceipt(bad,charge,m));
assert.throws(()=>paymentReceipt(pi,{...charge,payment_intent:'pi_other'},m));
async function call(body){return handle(new Request('https://test',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer test'},body:JSON.stringify(body)}));}
actor=other;p=profile;let res=await call({action:'download',missionId:m.id,documentId:'55555555-5555-5555-5555-555555555555'});assert.equal(res.status,403);assert.equal(signed,0);
actor=client;p={role:'client'};res=await call({action:'download',missionId:m.id,documentId:'66666666-6666-6666-6666-666666666666'});assert.equal(res.status,404);assert.equal(signed,0);
res=await call({action:'download',missionId:m.id,documentId:'55555555-5555-5555-5555-555555555555',object_path:'another-mission/secret.pdf'});assert.equal(res.status,200);assert.equal(signed,1);assert.equal(res.headers.get('Cache-Control'),'no-store');
p={role:'admin',suspended:true};res=await call({action:'download',missionId:m.id,documentId:'55555555-5555-5555-5555-555555555555'});assert.equal(res.status,403);assert.equal(signed,1);
const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');for(const x of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(x[2].trim()&&!x[1].includes('application/ld+json'))new vm.Script(x[2]);

function referenceDb(existing,race=false){
  let saved=existing,insertCalls=0;
  return {get inserts(){return insertCalls},from(){let inserting=false;const q={select(){return q},eq(){return q},maybeSingle(){return q},single(){return q},insert(){inserting=true;return q},then(resolve){
    if(inserting){insertCalls++;saved={id:7,issued_at:'2026-12-31T23:59:00Z',mission_id:m.id};return Promise.resolve(race?{error:{code:'23505'}}:{data:saved}).then(resolve);}
    return Promise.resolve({data:saved}).then(resolve);
  }};return q;}};
}
for(const race of [false,true]){
 const refs=referenceDb(null,race);
 assert.equal(await scope.receiptReference(refs,m.id,'ch_paid'),'SN-2026-000007');
 assert.equal(await scope.receiptReference(refs,m.id,'ch_paid'),'SN-2026-000007');
 assert.equal(refs.inserts,1);
}
await assert.rejects(()=>scope.receiptReference(referenceDb({id:7,issued_at:'2026-12-31T23:59:00Z',mission_id:other.id}),m.id,'ch_paid'));
console.log('PASS: stable numbered receipts, repeated downloads, concurrent creation conflict, mission binding');
console.log('PASS: role and mission isolation, provider-only upload, PDF validation, confirmed payment/refunds, document ID isolation, signed URL privacy, HTML syntax');
