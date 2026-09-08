import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const shared=readFileSync('supabase/functions/_shared/payment.ts','utf8').replace(/^import .*;\n/m,'').replaceAll('export ','');
const base={id:'mission1',client_id:'client1',status:'accepted',payment_status:'unpaid',amount_cents:12000,urgent_fee_cents:1000,currency:'eur',stripe_payment_intent_id:null};
const intent={id:'pi_test1',metadata:{mission_id:'mission1'},amount:13000,amount_received:13000,currency:'eur',status:'requires_payment_method',client_secret:'test_secret'};
async function run(name,mission={},pi={},user='client1'){
 const m={...base,...mission}, p={...intent,...pi};let postCount=0, stripeCount=0, lastHeaders;
 const admin={from(){let filters=[],patch;const q={select(){return q},update(v){patch=v;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},single(){return Promise.resolve({data:filters.every(([k,v])=>m[k]===v)?{...m}:null})},then(resolve){let matches=filters.every(([k,v])=>m[k]===v);if(matches&&patch)Object.assign(m,patch);return Promise.resolve({data:matches?[{id:m.id}]:[]}).then(resolve)}};return q}};
 const context=vm.createContext({Request,Response,URLSearchParams,Date,console,createClient:()=>({...admin,auth:{getUser:async()=>({data:{user:user?{id:user}:null}})}}),Deno:{env:{get:()=> 'test'},serve(fn){context.handler=fn}},fetch:async(_url,options)=>{stripeCount++;lastHeaders=options.headers;if(options.method==='POST')postCount++;return Response.json(p)}});
 vm.runInContext(shared+readFileSync('supabase/functions/'+name+'/index.ts','utf8').replace(/^import .*;\n/m,''),context);
 const invoke=()=>context.handler(new Request('https://local.test',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({missionId:'mission1',paymentIntentId:'pi_test1'})}));
 const response=await invoke();return {m,response,body:await response.json(),get posts(){return postCount},get calls(){return stripeCount},lastHeaders,invoke};
}
for(const state of ['pending','quoted','cancelled','completed']){const r=await run('smooth-function',{status:state});assert.equal(r.response.status,409);assert.equal(r.calls,0)}
let r=await run('smooth-function',{}, {},null);assert.equal(r.response.status,401);assert.equal(r.calls,0);
r=await run('smooth-function',{}, {},'stranger');assert.equal(r.response.status,404);assert.equal(r.calls,0);
r=await run('smooth-function',{payment_status:'paid'});assert.equal(r.response.status,409);assert.equal(r.calls,0);
r=await run('smooth-function');assert.equal(r.body.amount,13000);assert.equal(r.m.stripe_payment_intent_id,'pi_test1');assert.equal(r.lastHeaders['Idempotency-Key'],'mission-mission1');await r.invoke();assert.equal(r.posts,1);
r=await run('smooth-function',{stripe_payment_intent_id:'pi_test1'},{status:'processing'});assert.equal(r.body.processing,true);assert.equal(r.posts,0);
for(const pi of [{metadata:{mission_id:'other'}},{amount:1},{currency:'usd'},{amount_received:1}]){r=await run('clever-processor',{}, {...pi,status:'succeeded'});assert.equal(r.response.status,400);assert.equal(r.m.payment_status,'unpaid');}
r=await run('clever-processor',{}, {status:'succeeded'});assert.equal(r.body.ok,true);assert.equal(r.m.status,'in_progress');assert.equal(r.m.payment_status,'paid');assert.ok(r.m.paid_at);await r.invoke();assert.equal(r.m.status,'in_progress');
r=await run('clever-processor',{status:'completed',payment_status:'transferred',stripe_payment_intent_id:'pi_test1'}, {status:'succeeded'});assert.equal(r.body.ok,true);assert.equal(r.m.payment_status,'transferred');
// Actual UI predicates: paid missions never offer another payment; provider messages work.
const html=readFileSync('index.html','utf8');const code=html.slice(html.indexOf('function statusPillClass'),html.indexOf('window.openInvoice'));
const ui=vm.createContext({t:(k)=>k,esc:String,money:String,currentUser:{id:'pro1'},currentLang:'fr'});vm.runInContext(code,ui);
const card=(m,c='client',reviews=new Set())=>ui.requestCard({...base,provider_id:'pro1',...m},c,reviews);
assert.match(card({}),/data-pay-mission/);assert.doesNotMatch(card({payment_status:'transferred'}),/data-pay-mission/);
assert.match(card({status:'completed'}),/data-leave-review/);assert.doesNotMatch(card({status:'completed'},'client',new Set(['mission1'])),/data-leave-review/);
assert.match(card({status:'in_progress'},'pro'),/data-complete/);assert.match(card({}),/client1\|pro1/);
console.log('PASS: payment authorization, amount/currency/mission binding, reuse, repeat confirmation, mission advancement and dashboard actions');
