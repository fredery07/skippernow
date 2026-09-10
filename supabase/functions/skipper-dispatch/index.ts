import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:cors});
const norm=(v:string|null|undefined)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const distanceKm=(a:any,b:any)=>{const R=6371,rad=(x:number)=>x*Math.PI/180,dLat=rad(Number(b.lat)-Number(a.lat)),dLon=rad(Number(b.lng)-Number(a.lng)),x=Math.sin(dLat/2)**2+Math.cos(rad(Number(a.lat)))*Math.cos(rad(Number(b.lat)))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));};
const canonicalPort=(text:string,ports:any[])=>{const n=norm(text);return ports.find(p=>n.includes(norm(p.name)))||null;};

async function push(admin:any,userId:string,title:string,body:string,url:string){
  try{
    const {data:secrets}=await admin.from("app_secrets").select("key,value").in("key",["VAPID_PUBLIC_KEY","VAPID_PRIVATE_KEY"]);
    const pub=secrets?.find((s:any)=>s.key==="VAPID_PUBLIC_KEY")?.value,priv=secrets?.find((s:any)=>s.key==="VAPID_PRIVATE_KEY")?.value;
    if(!pub||!priv)return 0;
    webpush.setVapidDetails("mailto:contact@skippernow.fr",pub,priv);
    const {data:subs}=await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id",userId);
    let sent=0; const payload=JSON.stringify({title,body,url});
    for(const s of subs||[]){try{await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},payload);sent++;}catch(e:any){if([404,410].includes(e?.statusCode))await admin.from("push_subscriptions").delete().eq("id",s.id);}}
    return sent;
  }catch{return 0;}
}

async function context(req:Request){
  const auth=req.headers.get("Authorization"); if(!auth)throw new Error("Non authentifié");
  const client=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_ANON_KEY")!,{global:{headers:{Authorization:auth}}});
  const {data:{user},error}=await client.auth.getUser(); if(error||!user)throw new Error("Non authentifié");
  const admin=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  return {user,admin};
}

async function rentalFor(admin:any,id:string){
  const {data,error}=await admin.from("boat_rental_requests").select("*,boats(id,name,brand,model,home_port,boat_type)").eq("id",id).single();
  if(error||!data)throw new Error("Location introuvable"); return data;
}

async function candidateStillFree(admin:any,skipperId:string,r:any){
  const day=String(r.starts_at).slice(0,10);
  const [{data:p},{data:u},{data:m},{data:d}]=await Promise.all([
    admin.from("profiles").select("role,verified,available,suspended").eq("id",skipperId).single(),
    admin.from("skipper_unavailability").select("id").eq("skipper_id",skipperId).eq("unavailable_date",day).limit(1),
    admin.from("missions").select("id").eq("skipper_id",skipperId).in("status",["accepted","in_progress","awaiting_validation","paid"]).lt("starts_at",r.ends_at).gt("ends_at",r.starts_at).limit(1),
    admin.from("boat_rental_skipper_dispatches").select("id,rental_id,boat_rental_requests!inner(starts_at,ends_at)").eq("assigned_skipper_id",skipperId).eq("status","assigned")
  ]);
  if(!p||p.role!=="skipper"||!p.verified||!p.available||p.suspended||u?.length||m?.length)return false;
  if((d||[]).some((x:any)=>x.rental_id!==r.id&&x.boat_rental_requests?.starts_at<r.ends_at&&x.boat_rental_requests?.ends_at>r.starts_at))return false;
  return true;
}

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
  if(req.method!=="POST")return reply({error:"Méthode non autorisée"},405);
  try{
    const {user,admin}=await context(req); const input=await req.json();
    if(input.action==="start"){
      const r=await rentalFor(admin,String(input.requestId||""));
      if(user.id!==r.owner_id&&user.id!==r.renter_id)return reply({error:"Accès refusé"},403);
      if(!r.wants_skipper)return reply({error:"Aucun skipper demandé"},409);
      if(!["accepted","confirmed"].includes(r.status))return reply({error:"Le propriétaire doit d’abord accepter la location"},409);
      let {data:dispatch}=await admin.from("boat_rental_skipper_dispatches").select("*").eq("rental_id",r.id).maybeSingle();
      if(dispatch?.status==="assigned")return reply({assigned:true,skipperId:dispatch.assigned_skipper_id});
      if(!dispatch){const ins=await admin.from("boat_rental_skipper_dispatches").insert({rental_id:r.id}).select("*").single();if(ins.error)throw ins.error;dispatch=ins.data;}
      const [{data:profiles},{data:ports},{data:unavailable},{data:busy},{data:allAvailability},{data:assigned}]=await Promise.all([
        admin.from("profiles").select("id,home_port,travel_radius_km,rating,rating_count").eq("role","skipper").eq("verified",true).eq("available",true).eq("suspended",false),
        admin.from("ports").select("name,lat,lng").eq("active",true),
        admin.from("skipper_unavailability").select("skipper_id").eq("unavailable_date",String(r.starts_at).slice(0,10)),
        admin.from("missions").select("skipper_id").not("skipper_id","is",null).in("status",["accepted","in_progress","awaiting_validation","paid"]).lt("starts_at",r.ends_at).gt("ends_at",r.starts_at),
        admin.from("availabilities").select("skipper_id,starts_at,ends_at,port"),
        admin.from("boat_rental_skipper_dispatches").select("assigned_skipper_id,rental_id,boat_rental_requests!inner(starts_at,ends_at)").eq("status","assigned").not("assigned_skipper_id","is",null)
      ]);
      const ps=ports||[],target=canonicalPort(r.boats?.home_port||"",ps),un=new Set((unavailable||[]).map((x:any)=>x.skipper_id)),busySet=new Set((busy||[]).map((x:any)=>x.skipper_id));
      const eligible=(profiles||[]).filter((p:any)=>{
        if(un.has(p.id)||busySet.has(p.id))return false;
        if((assigned||[]).some((x:any)=>x.assigned_skipper_id===p.id&&x.rental_id!==r.id&&x.boat_rental_requests?.starts_at<r.ends_at&&x.boat_rental_requests?.ends_at>r.starts_at))return false;
        const ownAvail=(allAvailability||[]).filter((a:any)=>a.skipper_id===p.id);
        if(ownAvail.length&&!ownAvail.some((a:any)=>a.starts_at<=r.starts_at&&a.ends_at>=r.ends_at))return false;
        const home=canonicalPort(p.home_port||"",ps);
        if(target&&home){const km=distanceKm(home,target);if(p.travel_radius_km!=null)return km<=Number(p.travel_radius_km);return home.name===target.name;}
        const a=norm(p.home_port),b=norm(r.boats?.home_port);return !!a&&!!b&&(a.includes(b)||b.includes(a));
      }).map((p:any)=>{const home=canonicalPort(p.home_port||"",ps);return {...p,_distance:target&&home?distanceKm(home,target):9999};})
        .sort((a:any,b:any)=>a._distance-b._distance||Number(b.rating||0)-Number(a.rating||0)).slice(0,10);
      if(!eligible.length)return reply({ok:true,dispatchId:dispatch.id,notified:0,message:"Aucun skipper disponible dans la zone pour ce créneau."});
      await admin.from("boat_rental_skipper_candidates").upsert(eligible.map((p:any)=>({dispatch_id:dispatch.id,skipper_id:p.id,status:"notified",notified_at:new Date().toISOString()})),{onConflict:"dispatch_id,skipper_id",ignoreDuplicates:true});
      const boat=[r.boats?.brand,r.boats?.model].filter(Boolean).join(" ")||r.boats?.name||"bateau";
      await Promise.all(eligible.map((p:any)=>push(admin,p.id,"Nouvelle mission skipper",`${r.boats?.home_port||"Port"} · ${new Date(r.starts_at).toLocaleDateString("fr-FR")} · ${boat}. Premier skipper qui accepte = mission attribuée.`,`https://skippernow.fr/?skipper_dispatch=${dispatch.id}`)));
      return reply({ok:true,dispatchId:dispatch.id,notified:eligible.length});
    }
    if(input.action==="inbox"){
      const {data:p}=await admin.from("profiles").select("role").eq("id",user.id).single();if(p?.role!=="skipper")return reply({offers:[]});
      const {data:c}=await admin.from("boat_rental_skipper_candidates").select("dispatch_id,status,notified_at,boat_rental_skipper_dispatches(status,assigned_skipper_id,rental_id,boat_rental_requests(starts_at,ends_at,guest_count,boats(name,brand,model,home_port,boat_type)))").eq("skipper_id",user.id).order("notified_at",{ascending:false}).limit(30);
      return reply({offers:c||[]});
    }
    if(["accept","decline"].includes(input.action)){
      const dispatchId=String(input.dispatchId||"");
      const {data:c}=await admin.from("boat_rental_skipper_candidates").select("*").eq("dispatch_id",dispatchId).eq("skipper_id",user.id).maybeSingle();if(!c)return reply({error:"Cette proposition ne vous est pas destinée"},403);
      if(input.action==="decline"){await admin.from("boat_rental_skipper_candidates").update({status:"declined",responded_at:new Date().toISOString()}).eq("dispatch_id",dispatchId).eq("skipper_id",user.id).eq("status","notified");return reply({ok:true});}
      const {data:d}=await admin.from("boat_rental_skipper_dispatches").select("*,boat_rental_requests(*)").eq("id",dispatchId).single();if(!d)return reply({error:"Mission introuvable"},404);
      if(d.status!=="searching")return reply({won:d.assigned_skipper_id===user.id,message:d.assigned_skipper_id===user.id?"Mission déjà attribuée à vous.":"Un autre skipper a déjà accepté cette mission."},409);
      if(!await candidateStillFree(admin,user.id,d.boat_rental_requests))return reply({error:"Vous n’êtes plus disponible sur ce créneau."},409);
      const now=new Date().toISOString();
      const win=await admin.from("boat_rental_skipper_dispatches").update({status:"assigned",assigned_skipper_id:user.id,assigned_at:now,updated_at:now}).eq("id",dispatchId).eq("status","searching").is("assigned_skipper_id",null).select("id");
      if(win.error)throw win.error;if(!win.data?.length){await admin.from("boat_rental_skipper_candidates").update({status:"lost",responded_at:now}).eq("dispatch_id",dispatchId).eq("skipper_id",user.id);return reply({won:false,message:"Un autre skipper vient d’accepter avant vous."},409);}
      await admin.from("boat_rental_skipper_candidates").update({status:"lost",responded_at:now}).eq("dispatch_id",dispatchId).neq("skipper_id",user.id).eq("status","notified");
      await admin.from("boat_rental_skipper_candidates").update({status:"accepted",responded_at:now}).eq("dispatch_id",dispatchId).eq("skipper_id",user.id);
      const r=d.boat_rental_requests;await Promise.all([push(admin,r.renter_id,"Skipper trouvé","Un skipper a accepté votre demande. Votre réservation peut continuer.","https://skippernow.fr/?dashboard=boat-rentals"),push(admin,r.owner_id,"Skipper trouvé","Un skipper a accepté la mission liée à votre bateau.","https://skippernow.fr/?dashboard=boat-rentals")]);
      return reply({ok:true,won:true});
    }
    return reply({error:"Action inconnue"},400);
  }catch(e:any){return reply({error:String(e?.message||e)},400);}
});
