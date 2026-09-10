import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const src=readFileSync('supabase/functions/service-flow/connect.ts','utf8');
const c=vm.createContext({URLSearchParams,AbortSignal,Date});vm.runInContext(src.replaceAll('export ',''),c);
function database(initial={}){
  let row={professional_id:'pro',account_id:null,creation_key:'stable-key',account_api:'v1',embedded_started_at:null,embedded_contact_email:null,...initial};
  const db={from(table){assert.equal(table,'connect_accounts');let patch=null,filters=[];return {
    upsert(){return Promise.resolve({data:null,error:null});},
    select(){return this;}, update(p){patch=p;return this;},
    eq(k,v){filters.push(r=>r[k]===v);return this;},is(k,v){filters.push(r=>r[k]===v);return this;},
    single(){return Promise.resolve({data:{...row},error:null});},
    then(resolve){if(patch&&filters.every(f=>f(row))) row={...row,...patch};return Promise.resolve({data:null,error:null}).then(resolve);}
  };}};
  return {db,get:()=>row};
}
const payload=c.accountPayload('pro','FR','provider@example.test');assert.equal(payload.dashboard,'none');assert.equal(payload.identity.country,'fr');assert.equal(payload.configuration.merchant,undefined);
const current={dashboard:'none',defaults:{responsibilities:{requirements_collector:'application'}},configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:{status:'active'},payouts:{status:'active'}}}}}};
assert.equal(c.accountReady(current,'v2'),true);
assert.equal(c.accountReady({...current,configuration:{}},'v2'),false);
const restricted=structuredClone(current);restricted.configuration.recipient.capabilities.stripe_balance.payouts.status='restricted';assert.equal(c.accountReady(restricted,'v2'),false);
const opts=c.sessionOptions({account_id:'acct_owner',account_api:'v2'},current);
assert.equal(opts.account,'acct_owner');
// Stripe rejects a session when onboarding and payouts disagree on bank collection.
for(const comp of ['account_onboarding','account_management','notification_banner','payouts'])
  assert.equal(opts[`components[${comp}][features][external_account_collection]`],'true');
for(const comp of ['account_onboarding','account_management','notification_banner','payouts']) assert.equal(opts[`components[${comp}][features][disable_stripe_user_authentication]`],'true');
assert.equal(opts['components[payouts][features][standard_payouts]'],'false');
assert.equal(opts['components[payouts][features][edit_payout_schedule]'],'false');
assert.equal(opts['components[payments][enabled]'],undefined);
let state=database(),creates=[];
const api=async(path,body,key)=>{if(!body) return {data:[],has_more:false};creates.push({body,key});return {id:'acct_new'};};
await c.ensureAccount(state.db,'pro','FR','provider@example.test',api);await c.ensureAccount(state.db,'pro','US','changed@example.test',api);
assert.equal(creates.length,1);assert.equal(state.get().account_api,'v2');
// A timeout followed by a retry uses exactly the same payload/key despite changed country.
state=database();creates=[];let fail=true;
const interrupted=async(path,body,key)=>{if(!body) return {data:[],has_more:false};creates.push({body,key});if(fail){fail=false;throw new Error('network');}return {id:'acct_retry'};};
await assert.rejects(c.ensureAccount(state.db,'pro','FR','provider@example.test',interrupted),/network/);
await c.ensureAccount(state.db,'pro','US','changed@example.test',interrupted);assert.deepEqual(creates[0],creates[1]);
// A parallel first click cannot change the stored creation payload.
state=database();creates=[];await Promise.all([c.ensureAccount(state.db,'pro','FR','provider@example.test',api),c.ensureAccount(state.db,'pro','US','changed@example.test',api)]);assert.ok(creates.every(x=>JSON.stringify(x)===JSON.stringify(creates[0])));
// A previously created account is recovered without creating a second one.
state=database();let calls=0;
await c.ensureAccount(state.db,'pro','FR','provider@example.test',async(path,body)=>{assert.equal(body,undefined);calls++;return {data:[{id:'acct_old',metadata:{professional_id:'pro'}}],has_more:false};});assert.equal(state.get().account_id,'acct_old');assert.equal(calls,1);
// Past Stripe retention, fail closed even when a listing has no matching account.
state=database({embedded_started_at:'2020-01-01',embedded_country:'FR'});
await assert.rejects(c.ensureAccount(state.db,'pro','FR','provider@example.test',async(path,body)=>{assert.equal(body,undefined);return {data:[],has_more:false};}),/support/);
// Ambiguous matches must never silently pick a recipient.
state=database();await assert.rejects(c.ensureAccount(state.db,'pro','FR','provider@example.test',async()=>({data:[{id:'a',metadata:{professional_id:'pro'}},{id:'b',metadata:{professional_id:'pro'}}],has_more:false})),/Plusieurs/);
// Execute the actual edge handler: clients/unverified/suspended providers cannot issue sessions.
let handler,sessionOptionsSeen,errorScenario=false,diagnostic;
const edge=readFileSync('supabase/functions/service-flow/index.ts','utf8').replace(/^import .*;\n/gm,'').replaceAll('export ','');
let role='client',verified=true,suspended=false;
const edgeDb={from(table){return {select(){return this},eq(k,v){assert.equal(v,'owner');return this},single(){return {data:{role,verified,suspended}}},maybeSingle(){return {data:{professional_id:'owner',account_id:'acct_owner',account_api:'v2'}}},update(value){if(value.last_error) diagnostic=value.last_error;return this},then(resolve){return Promise.resolve({data:null}).then(resolve)}}}};
const env=vm.createContext({Deno:{serve(fn){handler=fn}},Response,Request,URLSearchParams,TextDecoder,
 context:async()=>({user:{id:'owner',email:'owner@example.test'},admin:edgeDb}),cors:{},reply:(body,status=200)=>new Response(JSON.stringify(body),{status}),
 ensureAccount:async(db,owner,country,email)=>{assert.equal(owner,'owner');assert.equal(email,'owner@example.test');return {account_id:'acct_owner',account_api:'v2'}},
 retrieveAccount:async()=>current,accountReady:c.accountReady,sessionOptions:c.sessionOptions,
 connectStripe:async(path,body)=>{if(errorScenario) throw Object.assign(new Error('Indisponible'),{stripe_code:'fixture_error',stripe_param:'dashboard',stripe_request_id:'req_fixture',raw_secret:'must_not_persist'});assert.equal(path,'v1/account_sessions');sessionOptionsSeen=body;return {client_secret:'secret_for_owner',livemode:true}}});
vm.runInContext(edge,env);
const request=()=>new Request('https://example.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'embedded_session',account_id:'acct_victim',professional_id:'victim',email:'attacker@example.test',contact_email:'attacker@example.test'})});
assert.equal((await handler(request())).status,403);
role='provider';verified=false;assert.equal((await handler(request())).status,403);
verified=true;suspended=true;assert.equal((await handler(request())).status,403);
suspended=false;const response=await handler(request());assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(sessionOptionsSeen.account,'acct_owner');
console.log('PASS: owner-only sessions; no provider money-movement permissions; capability restrictions; account recovery, concurrency and expired retry guards.');

errorScenario=true;assert.equal((await handler(request())).status,400);assert.equal(diagnostic.code,'fixture_error');assert.equal(diagnostic.request_id,'req_fixture');assert.equal(diagnostic.raw_secret,undefined);console.log('PASS: safe server diagnostics omit sensitive Stripe payloads.');

// Regression: the exact legacy invalid_fields failure gains an email without
// rotating the creation key or resetting its deadline.
const started=new Date().toISOString();
state=database({embedded_started_at:started,embedded_country:'FR',last_error:{code:'invalid_fields'}});creates=[];
await c.ensureAccount(state.db,'pro','US',' provider@example.test ',api);
assert.equal(creates[0].body.contact_email,'provider@example.test');
assert.equal(creates[0].body.identity.country,'fr');
assert.equal(creates[0].key,'connect-embedded-v2-stable-key');
assert.equal(state.get().embedded_started_at,started);
// Missing/invalid contact emails cannot reach account creation.
for(const email of [undefined,'','   ','not-an-email']){
  state=database();creates=[];
  await assert.rejects(c.ensureAccount(state.db,'pro','FR',email,api),/e-mail valide/);
  assert.equal(creates.length,0);
}
console.log('PASS: recipient contact email; legacy validation retry; missing email rejected; authenticated email cannot be overridden by request input.');
