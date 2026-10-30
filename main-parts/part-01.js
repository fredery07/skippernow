"use strict";

const SUPABASE_URL = "https://pzvlarwsfvhenrniepkw.supabase.co";
const SUPABASE_KEY = "sb_publishable_OxikOn1mhDcxkAVAucN5Lg_za-bJMS5";
const VAPID_PUBLIC_KEY = "BNfnw1q9WxkOJi7P6yKG5KL3-BdkaMU_Ru_yqau2RUFTaN_opf3iiM5naGS1IpeOU66_KSL8uY6-Win0QhK_DNg";
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:window.localStorage,storageKey:"skippernow-auth"}
});
const STRIPE_PUBLISHABLE_KEY = "pk_live_51TwnxRJJhgwiG0WlcXaWITovqG9bkHSlXJeouhV983HkCRS7y16owMkph4Itjit3CB8sLEWJLrYkX4sUkOvjy0RE00eviyEiHS";
let stripeClient = null;
let stripeLoadingPromise = null;
function loadStripeClient(){
  if(stripeClient) return Promise.resolve(stripeClient);
  if(stripeLoadingPromise) return stripeLoadingPromise;
  stripeLoadingPromise = new Promise((resolve,reject)=>{
    const ready = ()=>{
      if(!window.Stripe){ reject(new Error(t("payment.unavailable"))); return; }
      stripeClient = window.Stripe(STRIPE_PUBLISHABLE_KEY);
      resolve(stripeClient);
    };
    if(window.Stripe){ ready(); return; }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3/";
    script.async = true;
    script.onload = ready;
    script.onerror = ()=>reject(new Error(t("payment.unavailable")));
    document.head.appendChild(script);
  }).catch(error=>{ stripeLoadingPromise = null; throw error; });
  return stripeLoadingPromise;
}

function urlBase64ToUint8Array(base64String){
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c=>c.charCodeAt(0)));
}
async function enablePushNotifications(){
  try{
    if(!("serviceWorker" in navigator) || !("PushManager" in window)){ alert(t("push.unsupported")); return false; }
    if(!currentUser){ return false; }
    const permission = await Notification.requestPermission();
    if(permission !== "granted"){ return false; }
    const reg = await navigator.serviceWorker.register("/sw.js");
    let sub = await reg.pushManager.getSubscription();
    if(!sub){
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }
    // Always use the verified Supabase auth identity, not a cached profile.
    const {data: authData, error: authError} = await db.auth.getUser();
    if(authError || !authData?.user?.id || authData.user.id !== currentUser.id){
      throw new Error("Session expirée ou compte différent : reconnectez-vous à SkipperNow.");
    }
    const saveSubscription = async (subscription) => {
      const json = subscription.toJSON();
      if(!json.endpoint || !json.keys?.p256dh || !json.keys?.auth){
        throw new Error("Abonnement push incomplet.");
      }
      // Avoid an UPSERT on the globally unique endpoint: it can conflict
      // with an endpoint owned by a different account, which RLS must reject.
      const {data: existing, error: lookupError} = await db.from("push_subscriptions")
        .select("id").eq("user_id", authData.user.id).eq("endpoint", json.endpoint).maybeSingle();
      if(lookupError) throw lookupError;
      const payload = {p256dh: json.keys.p256dh, auth: json.keys.auth};
      const result = existing
        ? await db.from("push_subscriptions").update(payload).eq("id", existing.id).eq("user_id", authData.user.id)
        : await db.from("push_subscriptions").insert({
            user_id: authData.user.id, endpoint: json.endpoint, ...payload
          });
      if(result.error) throw result.error;
    };
    try{
      await saveSubscription(sub);
    }catch(error){
      // A browser can retain an endpoint linked to a previously signed-in user.
      // RLS must stay enabled: renew the browser subscription instead of taking
      // ownership of another user's record.
      if(!/row-level security|42501/i.test(String(error?.message || error))) throw error;
      await sub.unsubscribe();
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
      await saveSubscription(sub);
    }
    localStorage.setItem("skippernow-push-enabled", "1");
    return true;
  }catch(e){ console.error(e); return false; }
}
async function notifyRecipient(userId, title, body, url){
  try{
    await fetch(SUPABASE_URL + "/functions/v1/send-push-notification", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({userId, title, body, url: url || "https://skippernow.fr"})
    });
  }catch(e){}
}
let paymentElementsInstance = null;
let currentPaymentMissionId = null;

