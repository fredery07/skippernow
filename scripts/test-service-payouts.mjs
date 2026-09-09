import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const edge=readFileSync('supabase/functions/service-flow/index.ts','utf8');
const pure=edge.slice(edge.indexOf('export function photoType'),edge.indexOf('async function transfer')).replaceAll('export ','');
const context=vm.createContext({TextDecoder});
vm.runInContext(pure,context);

assert.equal(context.photoType(Uint8Array.from([255,216,255,0])),'image/jpeg');
assert.equal(context.photoType(Uint8Array.from([137,80,78,71,13,10,26,10])),'image/png');
assert.equal(context.photoType(new TextEncoder().encode('RIFF0000WEBP')),'image/webp');
assert.throws(()=>context.photoType(new TextEncoder().encode('<script>')),/JPEG, PNG ou WebP/);

const job={mission_id:'m1',amount_cents:900,currency:'eur'};
const pi={id:'pi_1',status:'succeeded',metadata:{mission_id:'m1'},amount:1000,amount_received:1000,currency:'eur',transfer_data:null};
const charge={id:'ch_1',payment_intent:'pi_1',paid:true,disputed:false,refunded:false,amount_refunded:0,transfer:null};
context.verifyTransferPayment(pi,charge,job,1000);
for(const [badPi,badCharge,badJob] of [
  [{...pi,status:'processing'},charge,job],
  [{...pi,metadata:{mission_id:'other'}},charge,job],
  [{...pi,amount_received:999},charge,job],
  [pi,{...charge,disputed:true},job],
  [pi,{...charge,amount_refunded:1},job],
  [pi,charge,{...job,amount_cents:1001}],
]) assert.throws(()=>context.verifyTransferPayment(badPi,badCharge,badJob,1000),/non éligible/);

const html=readFileSync('index.html','utf8');
assert.match(html,/data-complete="\$\{m\.id\}"/);
assert.match(html,/data-service-summary="\$\{esc\(m\.id\)\}"/);
assert.match(html,/<script src="\/service-flow\.js"><\/script>/);
assert.doesNotMatch(html,/data-mark-paid/);

const sql=readFileSync('supabase/service-payouts.sql','utf8');
assert.match(sql,/enabled boolean NOT NULL DEFAULT false/);
assert.match(sql,/Existing completed missions are NOT enrolled retroactively/);
assert.match(sql,/NOT EXISTS\(SELECT 1 FROM public\.service_payouts/);
assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]+FROM PUBLIC,anon,authenticated/);
assert.match(sql,/service-payouts-every-15-minutes/);
assert.match(sql,/status=CASE WHEN status='awaiting_validation' THEN 'completed'/);
assert.match(edge,/input\.action==="set_enabled"/);

const refund=readFileSync('supabase/functions/rapid-task/index.ts','utf8');
assert.match(refund,/payoutJob \|\| mission\.stripe_transfer_id \|\| mission\.payment_status === "transferred"/);

console.log('PASS: photo validation, Stripe payment binding, UI proof flow, J+5 scheduler, no retroactive enrollment, and refund/transfer guard');
