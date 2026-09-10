import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});

Deno.serve(async req=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({error:"Méthode non autorisée"},405);
  try{
    const auth=req.headers.get("Authorization");
    if(!auth) return reply({error:"Non authentifié"},401);
    const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
    const {data:{user}}=await client.auth.getUser();
    if(!user) return reply({error:"Non authentifié"},401);
    const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:profile}=await admin.from("profiles").select("role,suspended").eq("id",user.id).single();
    if(!profile || !["skipper","provider"].includes(profile.role) || profile.suspended) return reply({error:"Compte professionnel requis"},403);

    const {data:secrets}=await admin.from("app_secrets").select("key,value").in("key",["VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY"]);
    const pub=secrets?.find((s:any)=>s.key==="VAPID_PUBLIC_KEY")?.value;
    const priv=secrets?.find((s:any)=>s.key==="VAPID_PRIVATE_KEY")?.value;
    if(!pub||!priv) return reply({error:"Notifications non configurées"},503);
    webpush.setVapidDetails("mailto:contact@skippernow.fr",pub,priv);

    const {data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",user.id);
    let sent=0,removed=0;
    const payload=JSON.stringify({title:"Test SkipperNow ✅",body:"Les notifications sont bien actives sur cet appareil.",url:"https://skippernow.fr/?dashboard=notifications"});
    for(const s of subs||[]){
      try{
        await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);
        sent++;
      }catch(e:any){
        if([404,410].includes(Number(e?.statusCode))){await admin.from("push_subscriptions").delete().eq("id",s.id);removed++;}
      }
    }
    return reply({ok:true,sent,removed});
  }catch(e){return reply({error:e instanceof Error?e.message:"Erreur"},400);}
});
