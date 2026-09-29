(function(){
  "use strict";
  const text=(fr,en,es)=>({fr,en,es})[(document.documentElement.lang||"fr").slice(0,2)]||fr;
  function mount(){
    const bio=document.querySelector("#profileBio");
    if(!bio||document.querySelector("#providerBioAssistant")||!["provider","skipper"].includes(currentProfile?.role))return;
    const box=document.createElement("section");
    box.id="providerBioAssistant";
    box.className="note-box";
    box.style.margin="12px 0 18px";
    box.innerHTML='<strong>✨ '+text("Aide IA pour votre présentation","AI writing assistant","Ayuda de IA para tu presentación")+'</strong><p class="muted">'+text("Indiquez ce qui vous distingue. La proposition restera modifiable et ne sera publiée qu’après votre enregistrement.","Describe what makes you different. You can edit the suggestion before saving.","Cuenta qué te diferencia. Podrás editar la propuesta antes de guardarla.")+'</p><label for="bioAiDetails">'+text("Votre spécialité ou façon de travailler","Your specialty or approach","Tu especialidad o forma de trabajar")+'</label><textarea id="bioAiDetails" rows="2" maxlength="450"></textarea><div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><select id="bioAiTone" aria-label="'+text("Ton","Tone","Tono")+'"><option value="professionnel">'+text("Professionnel","Professional","Profesional")+'</option><option value="chaleureux">'+text("Chaleureux","Friendly","Cercano")+'</option><option value="premium">Premium</option></select><button id="bioAiGenerate" type="button" class="small-btn fill">'+text("Proposer une biographie","Suggest a biography","Proponer una biografía")+'</button></div><p id="bioAiMessage" role="status" class="muted"></p><textarea id="bioAiSuggestion" rows="5" style="display:none;width:100%"></textarea><button id="bioAiUse" type="button" class="small-btn" style="display:none;margin-top:8px">'+text("Utiliser ce texte","Use this text","Usar este texto")+'</button>';
    bio.closest(".field")?.after(box);
    const button=box.querySelector("#bioAiGenerate"),message=box.querySelector("#bioAiMessage"),suggestion=box.querySelector("#bioAiSuggestion"),use=box.querySelector("#bioAiUse");
    button.onclick=async()=>{
      button.disabled=true;message.textContent=text("Rédaction en cours…","Writing…","Redactando…");
      try{
        const {data:{session}}=await db.auth.getSession();
        if(!session)throw Error(text("Reconnectez-vous pour continuer.","Please sign in again.","Vuelve a iniciar sesión."));
        const response=await fetch(SUPABASE_URL+"/functions/v1/generate-provider-bio",{method:"POST",headers:{Authorization:"Bearer "+session.access_token,apikey:SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({detail:box.querySelector("#bioAiDetails").value,tone:box.querySelector("#bioAiTone").value,language:(document.documentElement.lang||"fr").slice(0,2)})});
        const data=await response.json();if(!response.ok||!data.bio)throw Error(data.error||"Erreur de génération.");
        suggestion.value=data.bio;suggestion.style.display="block";use.style.display="inline-flex";
        message.textContent=text("Relisez et adaptez le texte avant de l’utiliser.","Review and edit the text before using it.","Revisa y edita el texto antes de usarlo.");
      }catch(error){message.textContent=error.message||text("Service indisponible.","Service unavailable.","Servicio no disponible.");}
      finally{button.disabled=false;}
    };
    use.onclick=()=>{bio.value=suggestion.value;bio.dispatchEvent(new Event("input",{bubbles:true}));bio.focus();message.textContent=text("Texte inséré. Enregistrez votre profil pour le publier.","Text inserted. Save your profile to publish it.","Texto insertado. Guarda tu perfil para publicarlo.");};
  }
  new MutationObserver(mount).observe(document.querySelector("#dashboardBody")||document.body,{childList:true,subtree:true});mount();
})();
