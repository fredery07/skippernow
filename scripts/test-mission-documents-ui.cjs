const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const {parseHTML}=require('linkedom');
const {window,document}=parseHTML('<html><body><div id="invoiceContent"></div></body></html>');
let authCallback,payload,mode='client';
const scope={window,document,URL,Intl,Date,FormData,AbortSignal,console,currentLang:'fr',currentUser:{id:'client'},SUPABASE_URL:'https://example.supabase.co',SUPABASE_KEY:'public',esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),openModal(){},closeModal(){},db:{auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:scope.currentUser.id}}}}),onAuthStateChange:f=>{authCallback=f}}},fetch:async(_url,opts)=>{payload=JSON.parse(opts.body);let data;
if(payload.action==='list')data={documents:[{id:'pdf',invoice_number:'F-1<script>alert(1)</script>',issuer_name:'Boat company',created_at:'2026-09-10T10:00:00Z',document_kind:'invoice'}],hasPayment:true,canUpload:mode==='provider'};
else if(payload.action==='receipt')data={receipt:{reference:'SN-2026-000007',paymentReference:'pi_paid',paidAt:'2026-09-10T10:00:00Z',total:6000,refunded:1000,currency:'eur',missionId:'mission',port:'Cannes',description:'Nettoyage <img src=x onerror=alert(1)>'}};
return {ok:true,json:async()=>data}}};
vm.createContext(scope);vm.runInContext(fs.readFileSync(__dirname+'/../mission-documents.js','utf8'),scope);
(async()=>{
await window.openInvoice('mission');assert.ok(document.body.textContent.includes('Reçu et facture'));assert.equal(document.querySelector('[data-upload]'),null);assert.equal(document.querySelector('[data-document-list] script'),null);
const button=document.querySelector('[data-receipt-load]');button.click();await new Promise(r=>setImmediate(r));assert.ok(document.body.textContent.includes('60,00'));assert.ok(document.body.textContent.includes('SN-2026-000007'));assert.ok(!document.body.textContent.includes('pi_paid'));assert.ok(document.body.textContent.includes('10,00'));assert.equal(document.querySelector('[data-receipt] img'),null);assert.ok(!document.body.textContent.includes('Net professionnel'));
authCallback('SIGNED_OUT',null);assert.equal(document.querySelector('#invoiceContent').textContent,'');
mode='provider';scope.currentUser={id:'provider'};await window.openInvoice('mission');assert.ok(document.querySelector('[data-upload]'));assert.equal(document.querySelector('[name="file"]').getAttribute('accept'),'application/pdf,.pdf');assert.ok(document.querySelector('[name="confirmed"]').hasAttribute('required'));
mode='admin';scope.currentUser={id:'admin'};authCallback('SIGNED_IN',{user:{id:'admin'}});await window.openInvoice('mission');assert.ok(document.querySelector('[data-document-list] button'));assert.equal(document.querySelector('[data-upload]'),null);
console.log('PASS UI: receipt/refund rendering, XSS escaping, provider upload form, client/admin read-only, sign-out cleanup');
})().catch(e=>{console.error(e);process.exitCode=1});
