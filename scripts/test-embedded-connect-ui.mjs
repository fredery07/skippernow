// Run with linkedom available (npm install --no-save linkedom).
// Stripe/db are test doubles; no account creation or money movement occurs.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const {parseHTML}=createRequire(import.meta.url)('linkedom');
const {window}=parseHTML('<html><head></head><body><main></main></body></html>');
Object.defineProperty(window.HTMLSelectElement.prototype,'value',{get(){return this.querySelector('option[selected]')?.value||''},set(v){for(const o of this.querySelectorAll('option')) o.toggleAttribute('selected',o.value===v)}});
let owner='pro',authListener,connected=false,ready=false,sessionCalls=0,logoutCalls=0,initCalls=0,created=[];
const instances=[];
window.StripeConnect={init(options){
  initCalls++;assert.equal(options.publishableKey,'pk_live_test_fixture');
  const instance={options,create(name){
    created.push(name);const el=window.document.createElement('stripe-test-component');el.setAttribute('data-component',name);
    el.setOnLoadError=fn=>el.fail=fn;el.setOnLoaderStart=fn=>el.loading=fn;el.setOnExit=fn=>el.exit=fn;return el;
  },logout:async()=>{logoutCalls++}};instances.push(instance);return instance;
}};
const context=vm.createContext({window,document:window.document,Intl,FormData,Date,setTimeout,clearTimeout,
  currentLang:'fr',STRIPE_PUBLISHABLE_KEY:'pk_live_test_fixture',SUPABASE_URL:'https://fixture.test',SUPABASE_KEY:'fixture',
  db:{auth:{getSession:async()=>({data:{session:owner?{user:{id:owner},access_token:'fixture'}:null}}),onAuthStateChange(fn){authListener=fn}}},
  fetch:async(url,options)=>{
    const data=JSON.parse(options.body);
    if(data.action==='account_status') return {ok:true,json:async()=>({connected,ready,country:connected?'FR':null})};
    assert.equal(data.action,'embedded_session');sessionCalls++;connected=true;
    return {ok:true,json:async()=>({client_secret:'fixture_'+owner,livemode:true})};
  }});
vm.runInContext(readFileSync('service-flow.js','utf8'),context);
const main=window.document.querySelector('main');await context.mountConnectSetup(main);
assert.equal(sessionCalls,0,'merely viewing Payments must not create an account');
assert.equal(main.querySelector('select').value,'FR');
await main.querySelector('[data-connect]').onclick();
assert.equal(initCalls,1);assert.equal(sessionCalls,1);assert.ok(created.includes('account-onboarding'));
assert.equal(await instances[0].options.fetchClientSecret(),'fixture_pro');assert.equal(sessionCalls,1);
assert.equal(await instances[0].options.fetchClientSecret(),'fixture_pro');assert.equal(sessionCalls,2,'secret refresh uses authenticated server');
await main.querySelector('[data-payouts]').onclick();assert.equal(initCalls,1,'one Stripe instance per user session');
assert.equal(main.querySelector('[data-form] [data-component]').getAttribute('data-component'),'payouts');
ready=true;await main.querySelector('[data-refresh]').onclick();
await main.querySelector('[data-connect]').onclick();
assert.equal(main.querySelector('[data-form] [data-component]').getAttribute('data-component'),'account-management');
owner=null;authListener('SIGNED_OUT',null);await new Promise(resolve=>setImmediate(resolve));
assert.equal(logoutCalls,1);assert.equal(main.querySelector('[data-connect-components]').childElementCount,0);
await assert.rejects(instances[0].options.fetchClientSecret(),/Session terminée/);
owner='other';connected=false;ready=false;main.replaceChildren();await context.mountConnectSetup(main);
await main.querySelector('[data-connect]').onclick();assert.equal(initCalls,2);
assert.equal(await instances[1].options.fetchClientSecret(),'fixture_other');
owner='third';authListener('SIGNED_IN',{user:{id:owner}});main.replaceChildren();await context.mountConnectSetup(main);
await main.querySelector('[data-connect]').onclick();
owner=null;authListener('SIGNED_OUT',null);
await assert.rejects(instances[2].options.fetchClientSecret(),/Session terminée/,'unused first secret must also be invalid after logout');
console.log('PASS: embedded onboarding, management and payout views; no creation on first view; secret refresh; sign-out and user-switch isolation.');
