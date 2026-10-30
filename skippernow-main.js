Warning: truncated output (original token count: 127978)
Total output lines: 5540

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

const I18N = {
  fr:{
    "nav.login":"Se connecter","nav.signup":"Créer un compte","nav.myAccount":"Mon espace",
    "notif.unreadMessages":"message(s) non lu(s)","notif.quotesReceived":"devis reçu(s) à examiner","notif.awaitingValidation":"mission(s) à valider","notif.newRequests":"nouvelle(s) demande(s) disponible(s)",
    "notif.pendingValidations":"profil(s) en attente de validation","notif.adminNewRequests":"nouvelle(s) demande(s) client à traiter","notif.refundRequests":"demande(s) de remboursement","notif.openDisputes":"litige(s) ouvert(s)","notif.empty":"Aucune notification pour le moment.",
    "push.unsupported":"Les notifications ne sont pas prises en charge sur ce navigateur.","push.enable":"Activer les notifications","push.enabled":"Notifications activées !",
    "hero.eyebrow":"UNE PLATEFORME. TOUT LE NAUTISME.",
    "seo.titleDefault":"SkipperNow | Skippers, bateaux, services & expériences en mer","seo.descDefault":"Réservez un skipper, trouvez un bateau, un service nautique ou une expérience en mer avec SkipperNow, partout dans le monde.",
    "seo.title.skipper":"Trouver un skipper à {port} | SkipperNow","seo.desc.skipper":"Réservez un skipper professionnel vérifié à {port}. Paiement sécurisé, réponse rapide, même à la dernière minute.",
    "seo.title.day_sailor":"Marin à la journée à {port} | SkipperNow","seo.desc.day_sailor":"Trouvez un marin à la journée disponible à {port} pour vos missions ponctuelles (nettoyage, avitaillement, aide au port...).",
    "seo.title.cleaning":"Prestataire nautique à {port} | SkipperNow","seo.desc.cleaning":"Trouvez un prestataire nautique vérifié à {port} : nettoyage, entretien, mécanique et plus.",
    "hero.title":"La mer commence ici.",
    "hero.subtitle":"Louez un bateau, trouvez un skipper ou réservez un service nautique, partout où vous naviguez.",
    "hero.trust1":"Profils vérifiés","hero.trust2":"Réponse rapide","hero.trust3":"Paiement sécurisé",
    "hero.ctaProviders":"Services nautiques","hero.ctaBoats":"Trouver un bateau","hero.ctaSkipper":"Trouver un skipper",
    "search.portLabel":"PORT DE DÉPART — MONDE ENTIER","search.portPlaceholder":"Ex. Cannes, Miami, Ibiza…",
    "search.dateLabel":"DATE","search.durationLabel":"DURÉE","search.submit":"Rechercher",
    "duration.half":"Demi-journée","duration.day":"Journée","duration.multi":"Plusieurs jours","duration.daysLabel":"NOMBRE DE JOURS",
    "rental.badge":"LOCATION DE BATEAUX","rental.title":"Mettre mon bateau en location","providersShowcase.badge":"PRESTATAIRES INSCRITS","providersShowcase.title":"Professionnels vérifiés disponibles","providersShowcase.subtitle":"Découvrez uniquement les profils réellement validés par SkipperNow.","providersShowcase.viewAll":"Voir les professionnels","providersShowcase.empty":"Aucun prestataire inscrit pour le moment.",
    "categories.badge":"CATÉGORIES","categories.title":"De quoi avez-vous besoin ?","categories.skipperDesc":"Sortie, location, convoyage et prise en main du bateau.","categories.daySailorDesc":"Aide à bord, manutention, convoyage court.","categories.providersDesc":"Nettoyage, entretien, mécanique, avitaillement et services à quai.","categories.boatRentalTitle":"Location de bateau","categories.boatRentalDesc":"Trouvez le bateau adapté à votre destination.","categories.experienceTitle":"Expériences en mer","categories.experienceDesc":"Excursions, sorties et expériences nautiques.","browseByType.title":"Le bateau idéal pour chacune de vos envies","browseByPort.title":"Nos destinations phares","boatType.motor":"Moteur","boatType.sailboat":"Voilier","boatType.rib":"Semi-rigide","boatType.catamaran":"Catamaran",
    "results.compactJoin.skipper":"Vous êtes skipper dans cette zone ? Rejoignez SkipperNow et recevez vos premières demandes.",
    "results.compactJoin.day_sailor":"Vous proposez de l'aide à bord dans cette zone ? Rejoignez SkipperNow et recevez vos premières demandes.",
    "results.compactJoin.cleaning":"Vous proposez des services nautiques dans cette zone ? Rejoignez SkipperNow et recevez vos premières demandes.",
    "rental.text":"Créez votre compte propriétaire, ajoutez photos, caractéristiques, port d'attache et disponibilités. Vous pourrez ensuite proposer la location avec ou sans skipper.",
    "rental.cta":"Mettre mon bateau en location","rental.ctaShort":"Vous êtes propriétaire ? Mettre mon bateau en location","rental.examplesBadge":"BATEAUX DISPONIBLES",
    "rental.examplesTitle":"Bateaux disponibles","rental.examplesSubtitle":"Trouvez votre prochain bateau, partout où SkipperNow est présent.","rental.viewAll":"Voir toutes les annonces","rental.empty":"Aucun bateau publié pour le moment. Soyez le premier propriétaire à proposer le vôtre !","rental.emptyTitle":"Les premières annonces arrivent","rental.emptyText":"SkipperNow ouvre progressivement de nouveaux ports. Vous pouvez déjà publier gratuitement votre bateau.","rental.emptyCta":"Publier mon bateau",
    "results.skippersHeading":"Skippers disponibles","results.skippersSub":"Professionnels vérifiés près de votre port de départ",
    "results.daySailorsHeading":"Marins à la journée disponibles","results.daySailorsSub":"Aide à bord et missions ponctuelles près de votre port de départ",
    "results.cleaningHeading":"Prestataires disponibles","results.cleaningSub":"Nettoyage, services à quai et entretien près de votre port de départ",
    "results.count.cleaning.one":"1 prestataire","results.count.cleaning.other":"{n} prestataires",
    "results.emptyCleaningText":"Aucun prestataire vérifié sur ce port pour l'instant. Vous proposez du nettoyage ou des services à quai sur la Côte d'Azur ? Rejoignez SkipperNow dès maintenant.",
    "results.empty":"Aucun profil vérifié pour cette recherche.",
    "results.emptyTitle":"Soyez parmi les premiers !",
    "results.emptySkipperText":"Aucun skipper vérifié sur ce port pour l'instant. Vous êtes skipper professionnel sur la Côte d'Azur ? Rejoignez SkipperNow dès maintenant.",
    "results.emptyDaySailorText":"Aucun marin à la journée disponible pour l'instant. Vous proposez de l'aide à bord ou des missions ponctuelles ? Inscrivez-vous.",
    "results.emptyCtaDaySailor":"Devenir marin à la journée",
    "results.count.skipper.one":"1 skipper","results.count.skipper.other":"{n} skippers",
    "results.count.day_sailor.one":"1 marin à la journée","results.count.day_sailor.other":"{n} marins à la journée",
    "tabs.skippers":"Skippers","tabs.daySailors":"Marins à la journée","tabs.cleaning":"Services nautiques",
    "card.experience":"an(s) d'expérience","card.newOnPlatform":"Nouveau sur SkipperNow","card.priceOnRequest":"Sur demande","card.priceNote":"tarif confirmé avant réservation","card.priceFrom":"À partir de","card.verifiedBadge":"Vérifié","card.featuredBadge":"Mis en avant",
    "card.superSkipperBadge":"Super Skipper","card.recommendedProviderBadge":"Prestataire recommandé",
    "boatDetail.verifiedBadge":"Bateau vérifié",
    "dash.verifyBoat":"Vérifier le bateau","dash.unverifyBoat":"Retirer la vérification","dash.boatVerifyChecklist":"Avant de vérifier ce bateau, confirmez avoir contrôlé :\n\n✓ Les photos sont réelles et récentes\n✓ L'assurance du bateau est à jour\n✓ Les informations (modèle, année, capacité) sont cohérentes\n\nCliquez sur OK pour valider la vérification.","dash.markFeatured":"Mettre en avant","dash.unfeature":"Retirer la mise en avant",
    "stats.missions":"missions réalisées","stats.pros":"professionnels vérifiés","stats.rating":"note moyenne","launch.banner":"Lancement prioritaire sur la Côte d'Azur : Cannes, Antibes, Nice, Monaco et Saint-Tropez.","seaCarousel.caption":"Vos plus belles sorties en mer commencent ici",
    "trustProcess.title":"Une réservation plus sûre, étape par étape","trustProcess.subtitle":"Des règles claires pour protéger les clients comme les professionnels.","trustProcess.verifyTitle":"Profils contrôlés","trustProcess.verifyText":"Les profils professionnels sont examinés avant d'être affichés comme vérifiés.","trustProcess.quoteTitle":"Prix accepté avant paiement","trustProcess.quoteText":"Le professionnel propose son tarif et vous choisissez avant de payer.","trustProcess.contactTitle":"Coordonnées protégées","trustProcess.contactText":"Les échanges restent sur SkipperNow pour limiter les contournements et les abus.",
    "quickRequest.title":"Vous ne trouvez pas exactement ce qu'il vous faut ?","quickRequest.subtitle":"Déposez une demande : les professionnels disponibles pourront vous répondre avec leur tarif.","quickRequest.cta":"Déposer une demande gratuite","quickRequest.openTitle":"Demande ouverte aux professionnels","quickRequest.cardText":"Aucun profil ne correspond ? Envoyez votre besoin aux professionnels disponibles.",
    "card.available":"Disponible","card.unavailable":"Indisponible","card.unavailableOn":"Indisponible le","card.viewProfile":"Voir le profil",
    "how.title":"Comment ça marche ?",
    "how.step1Title":"Trouvez","how.step1Text":"Choisissez un skipper, un bateau, un service ou une expérience.",
    "how.step2Title":"Réservez","how.step2Text":"Envoyez votre demande et échangez avec le professionnel.",
    "how.step3Title":"Profitez","how.step3Text":"Paiement sécurisé et service réalisé en toute simplicité.",
    "gallery.title":"L'expérience SkipperNow","gallery.subtitle":"Des sorties en mer inoubliables, partout dans le monde",
    "logbook.title":"Carnet de bord","logbook.subtitle":"La Côte d'Azur, port après port — la route que suivent nos skippers","logbook.seeSkippers":"Voir les skippers →","logbook.nm":"nm","activities.title":"Expériences en mer","activities.subtitle":"Découvrez des sorties et expériences proposées autour de votre destination.","activities.discover":"Découvrir →","activities.filterShowing":"Sorties à","activities.reserve":"Trouver un skipper →",
    "join.title":"Rejoindre SkipperNow",
    "join.ownerTitle":"Propriétaire","join.ownerText":"Ajoutez votre bateau et recevez des demandes de location.","join.ownerCta":"Ajouter mon bateau",
    "join.skipperTitle":"Skipper","join.skipperText":"Créez votre profil et recevez des missions.","join.skipperCta":"Devenir skipper",
    "join.providerTitle":"Prestataire","join.providerText":"Proposez vos services nautiques aux plaisanciers et propriétaires.","join.providerCta":"Devenir prestataire",
    "footer.tagline":"La plateforme mondiale pour vos besoins nautiques : skippers, bateaux, services et expériences en mer.","seoFooter.title":"Nos destinations dans le monde",
    "footer.platform":"Plateforme","footer.findSkipper":"Trouver un skipper","footer.findProvider":"Trouver un prestataire","footer.findBoat":"Trouver un bateau",
    "footer.pros":"Professionnels","footer.becomePro":"Devenir prestataire","footer.addBoat":"Mettre un bateau en location",
    "footer.infoTitle":"Informations","footer.about":"À propos","footer.contact":"Contact","footer.terms":"Conditions générales","footer.privacy":"Confidentialité","footer.mentions":"Mentions légales","footer.cookies":"Cookies","footer.rights":"Tous droits réservés.",
    "legal.eyebrow":"INFORMATIONS LÉGALES",
    "legal.mentionsTitle":"Mentions légales","legal.mentionsBody":"Éditeur du site : SkipperNow, exploité par Fredery Therond, entrepreneur individuel, immatriculé sous le n° SIRET 881 423 446 00049 (SIREN 881 423 446), dont le siège est situé 5 rue Sévigné, 06110 Le Cannet, France.\n\nDirecteur de la publication : Fredery Therond.\n\nHébergement : GitHub, Inc.\n\nContact : skippernow@outlook.fr.",
    "legal.cguTitle":"Conditions générales d'utilisation","legal.cguBody":"1. Objet — Les présentes conditions générales d'utilisation (« CGU ») ont pour objet de définir les modalités et conditions dans lesquelles SkipperNow met à disposition sa plateforme de mise en relation entre clients, skippers, prestataires nautiques et propriétaires de bateaux (ci-après la « Plateforme »), ainsi que les droits et obligations des parties dans ce cadre.\n\n2. Définitions — « Utilisateur » désigne toute personne inscrite sur la Plateforme, qu'elle agisse en tant que Client ou en tant que Skipper/Prestataire. « Client » désigne l'utilisateur qui recherche une prestation nautique. « Skipper/Prestataire » désigne l'utilisateur qui propose une prestation ou la location d'un bateau. « Mission » désigne la prestation convenue entre un Client et un Skipper/Prestataire via la Plateforme.\n\n3. Acceptation — L'inscription sur la Plateforme implique l'acceptation pleine et entière des présentes CGU. L'Utilisateur qui n'accepte pas ces conditions doit s'abstenir d'utiliser la Plateforme.\n\n4. Accès à la Plateforme — L'inscription est réservée aux personnes majeures disposant de la pleine capacité juridique. Les Skippers/Prestataires garantissent qu'ils disposent des qualifications, diplômes et assurances requis par la réglementation applicable à l'activité exercée.\n\n5. Compte utilisateur — Chaque Utilisateur garantit l'exactitude, l'actualité et la sincérité des informations fournies lors de son inscription et s'engage à les maintenir à jour, notamment son numéro de téléphone afin de pouvoir être contacté en cas d'urgence.\n\n6. Rôle de SkipperNow — SkipperNow agit exclusivement en tant qu'intermédiaire technique permettant la mise en relation entre Utilisateurs. SkipperNow n'est pas partie aux contrats conclus entre Clients et Skippers/Prestataires et n'intervient pas dans l'exécution matérielle des Missions.\n\n7. Comportement des Utilisateurs — Chaque Utilisateur s'engage à un usage loyal et de bonne foi de la Plateforme, à ne pas contourner les outils de messagerie ou de paiement intégrés, et à respecter les Règles de la communauté SkipperNow.\n\n8. Propriété intellectuelle — La Plateforme, sa structure, son contenu et les éléments qui la composent (textes, logos, base de données) sont protégés par le droit de la propriété intellectuelle et demeurent la propriété de SkipperNow ou de ses partenaires.\n\n9. Responsabilité — SkipperNow met en œuvre les moyens raisonnables pour assurer le bon fonctionnement de la Plateforme mais ne saurait garantir une disponibilité continue. SkipperNow ne saurait être tenue responsable de la bonne exécution des Missions, de la qualité des prestations fournies par les Skippers/Prestataires, ni des dommages résultant de leur relation avec les Clients.\n\n10. Suspension et résiliation — SkipperNow se réserve le droit de suspendre ou de supprimer, sans préavis, le compte de tout Utilisateur en cas de manquement aux présentes CGU ou aux Règles de la communauté.\n\n11. Données personnelles — Le traitement des données à caractère personnel des Utilisateurs est décrit dans la Politique de confidentialité, partie intégrante des présentes CGU.\n\n12. Modification — SkipperNow peut modifier les présentes CGU à tout moment. Les Utilisateurs en seront informés par tout moyen approprié et la poursuite de l'utilisation de la Plateforme après notification vaut acceptation des CGU modifiées.\n\n13. Droit applicable et litiges — Les présentes CGU sont soumises au droit français. En cas de litige, une solution amiable sera recherchée avant toute action judiciaire. À défaut, conformément aux articles L.616-1 et suivants du Code de la consommation, tout consommateur a le droit de recourir gratuitement à un médiateur de la consommation. Les tribunaux français sont seuls compétents.",
    "legal.cgvTitle":"Conditions générales de vente","legal.cgvBody":"1. Champ d'application — Les présentes conditions générales de vente (« CGV ») s'appliquent à toute réservation de prestation nautique, de service de skipper ou de location de bateau conclue par l'intermédiaire de la Plateforme SkipperNow.\n\n2. Prestations concernées — Sont concernées les prestations proposées par les Skippers/Prestataires référencés sur la Plateforme : navigation accompagnée, location de bateau avec ou sans skipper, cours de navigation, convoyage et prestations nautiques assimilées.\n\n3. Prix — Les prix des prestations sont fixés librement par chaque Skipper/Prestataire ou propriétaire. Le prix total affiché au Client avant paiement inclut la commission de service SkipperNow, clairement indiquée et distincte du prix de la prestation.\n\n4. Réservation — La réservation est confirmée dès validation du paiement par le Client. Un récapitulatif de la Mission (dates, prestation, prix, coordonnées) est alors accessible depuis l'espace personnel des deux parties.\n\n5. Paiement — Le paiement est collecté par SkipperNow pour le compte du Skipper/Prestataire, via son prestataire de paiement sécurisé (Stripe). Les fonds sont conservés par SkipperNow jusqu'à la réalisation de la Mission, puis reversés au Skipper/Prestataire, déduction faite de la commission de service.\n\n6. Commission — SkipperNow perçoit une commission sur chaque transaction réalisée via la Plateforme, dont le taux est affiché avant toute confirmation de réservation.\n\n7. Facturation — Un reçu récapitulatif est généré automatiquement pour chaque prestation payée et reste consultable et téléchargeable depuis l'espace utilisateur.\n\n8. Annulation et remboursement — Les conditions d'annulation et de remboursement applicables sont détaillées dans la Politique d'annulation et la Politique de remboursement, parties intégrantes des présentes CGV.\n\n9. Absence de droit de rétractation — Conformément à l'article L.221-28 9° du Code de la consommation, le droit de rétractation ne s'applique pas aux prestations de services liées à des activités de loisirs devant être fournies à une date ou selon une périodicité déterminée, telles que les prestations nautiques proposées sur la Plateforme.\n\n10. Réclamations — Toute réclamation relative à une prestation doit être adressée en premier lieu au Skipper/Prestataire concerné via la messagerie de la Plateforme, puis, à défaut de résolution, à SkipperNow via skippernow@outlook.fr.\n\n11. Droit applicable — Les présentes CGV sont soumises au droit français.",
    "legal.privacyTitle":"Politique de confidentialité","legal.privacyBody":"1. Responsable de traitement — Le responsable du traitement des données à caractère personnel collectées sur la Plateforme est Fredery Therond, exploitant SkipperNow en tant qu'entrepreneur individuel (SIRET 881 423 446 00049), contactable à l'adresse skippernow@outlook.fr.\n\n2. Données collectées — SkipperNow collecte : les données d'identité et de contact (nom, prénom, email, numéro de téléphone) ; les données de profil (photo, présentation, qualifications) ; les documents de vérification professionnelle des Skippers/Prestataires (diplômes, permis) ; les données de connexion et d'usage de la Plateforme ; les données de paiement, traitées directement par notre prestataire de paiement Stripe et jamais stockées en clair par SkipperNow.\n\n3. Finalités — Ces données sont utilisées pour : permettre la création et la gestion du compte utilisateur ; assurer la mise en relation entre Clients et Skippers/Prestataires ; permettre de contacter l'utilisateur, y compris en cas d'urgence lors d'une Mission ; gérer les réservations et les paiements ; vérifier les qualifications déclarées par les Skippers/Prestataires ; assurer la sécurité et prévenir la fraude sur la Plateforme ; répondre aux obligations légales et réglementaires applicables.\n\n4. Base légale — Les traitements reposent selon les cas sur l'exécution du contrat liant l'Utilisateur à SkipperNow, sur le consentement de l'Utilisateur, sur l'intérêt légitime de SkipperNow à assurer la sécurité de la Plateforme, ou sur le respect d'obligations légales.\n\n5. Destinataires — Les données sont accessibles à l'équipe SkipperNow et, le cas échéant, transmises à nos prestataires techniques (hébergement, paiement) dans la stricte mesure nécessaire à l'exécution de leurs missions. Elles ne sont ni vendues ni cédées à des tiers à des fins commerciales.\n\n6. Durée de conservation — Les données sont conservées pendant la durée de la relation contractuelle, puis archivées pendant les durées imposées par les obligations légales et comptables applicables, avant suppression ou anonymisation.\n\n7. Droits des Utilisateurs — Conformément au Règlement Général sur la Protection des Données (RGPD), chaque Utilisateur dispose d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de ses données, exerçable à tout moment auprès de skippernow@outlook.fr. Chaque Utilisateur dispose également du droit d'introduire une réclamation auprès de la Commission Nationale de l'Informatique et des Libertés (CNIL).\n\n8. Sécurité — SkipperNow met en œuvre les mesures techniques et organisationnelles raisonnables pour protéger les données des Utilisateurs contre tout accès non autorisé, perte ou divulgation.\n\n9. Confidentialité — Les informations personnelles des Utilisateurs, notamment leurs coordonnées, ne sont visibles que par l'équipe SkipperNow et, dans la stricte mesure nécessaire à la réalisation d'une Mission, par l'autre partie concernée par cette Mission.",
    "legal.cancellationTitle":"Politique d'annulation","legal.cancellationBody":"1. Annulation avant paiement — Le Client peut annuler une demande de réservation librement et sans frais tant que la Mission n'a pas encore été payée, directement depuis son espace personnel.\n\n2. Annulation après paiement — Une fois le paiement effectué, l'annulation par le Client est soumise aux conditions spécifiques définies par le Skipper/Prestataire ou le propriétaire du bateau concerné, précisées sur la fiche de l'annonce avant réservation. À défaut de conditions particulières, le Client est invité à contacter le Skipper/Prestataire via la messagerie de la Plateforme pour convenir des modalités d'annulation.\n\n3. Annulation par le professionnel — Si le Skipper/Prestataire ou le propriétaire annule une Mission déjà payée, le Client est intégralement remboursé, sans délai injustifié.\n\n4. Cas de force majeure — En cas d'annulation liée à des conditions météorologiques dangereuses ou à tout autre cas de force majeure empêchant la réalisation de la Mission dans des conditions de sécurité satisfaisantes, aucune pénalité n'est due par le Client et un remboursement ou un report de la Mission est proposé.\n\n5. Modalités — Toute demande d'annulation doit être effectuée depuis l'espace utilisateur ou signalée à skippernow@outlook.fr afin d'être traitée dans les meilleurs délais.",
    "legal.refundTitle":"Politique de remboursement","legal.refundBody":"1. Motifs de remboursement — Un Client peut demander un remboursement, total ou partiel, lorsque la prestation n'a pas été réalisée, a été annulée par le professionnel après paiement, ou présente un écart significatif avec la description de l'annonce.\n\n2. Procédure — La demande de remboursement s'effectue depuis l'espace personnel du Client, dans un délai raisonnable après la fin de la Mission concernée, en précisant le motif et, si possible, les éléments justificatifs (messages échangés, photos, description de la situation).\n\n3. Instruction — Chaque demande est examinée individuellement par l'équipe SkipperNow, qui peut solliciter des précisions complémentaires auprès des deux parties avant de statuer.\n\n4. Décision — SkipperNow peut approuver un remboursement total, un remboursement partiel proportionné au préjudice constaté, ou refuser la demande si celle-ci n'est pas justifiée, en motivant sa décision.\n\n5. Traitement — Les remboursements approuvés sont initiés via notre prestataire de paiement Stripe. Le délai de réception effective des fonds dépend des délais bancaires habituels, généralement de quelques jours ouvrés.\n\n6. Commission de service — En cas de remboursement intégral imputable au professionnel ou à SkipperNow, la commission de service perçue par SkipperNow sur la transaction concernée est également remboursée au Client.",
    "legal.cookiesTitle":"Gestion des cookies","legal.cookiesBody":"1. Qu'est-ce qu'un cookie — Un cookie est un petit fichier déposé sur votre appareil lors de la navigation sur la Plateforme, permettant de mémoriser certaines informations d'une visite à l'autre.\n\n2. Cookies strictement nécessaires — Ces cookies sont indispensables au fonctionnement de la Plateforme (connexion à votre compte, sécurité, mémorisation de la langue choisie). Ils ne peuvent pas être désactivés sans altérer le fonctionnement du site.\n\n3. Cookies de mesure d'audience — SkipperNow peut utiliser, le cas échéant, des cookies permettant de mesurer la fréquentation et l'usage de la Plateforme afin d'en améliorer le fonctionnement. Ces données sont traitées de façon agrégée et ne visent pas à identifier individuellement les Utilisateurs à des fins commerciales.\n\n4. Cookies publicitaires — Aucun cookie publicitaire tiers n'est utilisé à ce jour sur la Plateforme.\n\n5. Durée de conservation — Les cookies déposés ont une durée de vie limitée, n'excédant pas 13 mois, conformément aux recommandations de la CNIL.\n\n6. Gestion des cookies — Vous pouvez à tout moment configurer votre navigateur pour accepter, refuser ou être averti avant le dépôt de cookies. Le refus de certains cookies peut affecter le bon fonctionnement de certaines fonctionnalités de la Plateforme.",
    "legal.communityTitle":"Règles de la communauté","legal.communityBody":"1. Exactitude des informations — Chaque Utilisateur s'engage à fournir des informations exactes et à jour sur son profil, ses qualifications et ses annonces, notamment ses coordonnées de contact permettant d'être joint en cas d'urgence.\n\n2. Respect mutuel — Les échanges entre Utilisateurs, via la messagerie intégrée ou lors des Missions, doivent rester courtois et respectueux. Tout propos discriminatoire, injurieux ou menaçant est strictement interdit.\n\n3. Usage loyal de la Plateforme — Les Utilisateurs s'engagent à ne pas contourner la Plateforme pour éviter les frais de service, notamment en incitant l'autre partie à finaliser une réservation initiée sur SkipperNow en dehors de la Plateforme.\n\n4. Respect des engagements — Chaque Utilisateur s'engage à honorer les réservations acceptées et à prévenir l'autre partie dans les meilleurs délais en cas d'imprévu.\n\n5. Sécurité en mer — Les Skippers/Prestataires s'engagent à exercer leur activité dans le respect strict de la réglementation maritime et des règles de sécurité applicables, et à ne jamais mettre en danger la sécurité des Clients.\n\n6. Signalement — Tout Utilisateur constatant un comportement contraire aux présentes règles est invité à le signaler à l'équipe SkipperNow via skippernow@outlook.fr.\n\n7. Sanctions — Tout manquement aux présentes règles peut entraîner, selon sa gravité, un avertissement, une suspension temporaire ou une suppression définitive du compte de l'Utilisateur concerné.",
    "providerModal.eyebrow":"SERVICES NAUTIQUES","providerModal.title":"Trouver un prestataire","providerModal.intro":"Choisissez le service dont vous avez besoin près de votre port.",
    "activity.cleaning":"Préparation et services à quai","activity.cleaningDesc":"Nettoyage, rinçage, avitaillement, amarrage et assistance au départ.",
    "activity.shipyard":"Chantier et entretien","activity.shipyardDesc":"Antifouling, peinture, petites réparations, mise à l'eau.",
    "activity.daySailor":"Marin à la journée","activity.daySailorDesc":"Aide à bord, manutention, convoyage court.",
    "activity.skipper":"Skipper professionnel","activity.skipperDesc":"Sortie, location, convoyage et prise en main du bateau.",
    "activity.boatRentalPro":"Loueur de bateaux","activity.boatRentalProDesc":"Location de bateaux, y compris pour le compte de propriétaires tiers.",
    "activity.provisioning":"Courses & avitaillement à bord","activity.provisioningDesc":"Courses alimentaires, boissons, glace et produits du quotidien livrés directement au bateau.",
    "providerModal.subIntro":"Choisissez la catégorie qui correspond à votre besoin.",
    "sub.provisioning.freshProduce":"Fruits & légumes frais","sub.provisioning.groceries":"Épicerie & produits secs","sub.provisioning.drinks":"Boissons","sub.provisioning.ice":"Glace","sub.provisioning.breakfast":"Petit-déjeuner & viennoiseries","sub.provisioning.hygiene":"Hygiène & entretien","sub.provisioning.custom":"Commande personnalisée",
    "booking.provisioningPlaceholder":"Ex. 3 packs d'eau, 2 bouteilles de jus, sodas, café… précisez votre besoin en {sub}, le port et l'heure de livraison souhaitée.",
    "results.noProvider":"Aucun prestataire disponible pour ce service pour le moment.",
    "boatFinder.eyebrow":"LOCATION DE BATEAUX","boatFinder.title":"Bateaux disponibles","boatFinder.empty":"Aucun bateau ne correspond à votre recherche.","boatFinder.allTypes":"Tous les types","boatFinder.minCapacity":"Capacité min.","boatFinder.skipperAny":"Avec ou sans skipper","boatFinder.skipperWith":"Avec skipper","boatFinder.skipperWithout":"Sans skipper",
    "boatDetail.model":"Modèle","boatDetail.port":"Port d'attache","boatDetail.length":"Longueur","boatDetail.halfDay":"Demi-journée","boatDetail.fullDay":"Journée",
    "boatDetail.type":"Type de bateau","boatDetail.typeSailboat":"Voilier","boatDetail.typeMotorboat":"Yacht à moteur","boatDetail.typeRib":"Semi-rigide","boatDetail.typeCatamaran":"Catamaran",
    "boatDetail.capacity":"Capacité (personnes)","boatDetail.pax":"pers.","boatDetail.cabinsField":"Nombre de cabines","boatDetail.cabins":"cabines","boatDetail.cabin":"cabine","boatDetail.year":"Année",
    "boatDetail.skipperIncluded":"Skipper inclus","boatDetail.skipperIncludedTag":"Skipper inclus","boatDetail.skipperOptionalTag":"Skipper en option",
    "boatDetail.onRequest":"Sur demande","boatDetail.perDaySuffix":" /jour","boatDetail.perHalfDaySuffix":" /demi-journée","boatDetail.description":"Description","boatDetail.noDescription":"Aucune description renseignée.","boatDetail.photos":"Photos (jusqu'à 6)",
    "boatDetail.request":"Demander une réservation","boatDetail.close":"Fermer","boatDetail.ownListing":"C'est votre propre annonce — vous ne pouvez pas la réserver.",
    "boatDetail.brand":"Marque","boatDetail.width":"Largeur","boatDetail.draft":"Tirant d'eau","boatDetail.berths":"Couchages",
    "boatDetail.engineType":"Type de moteur","boatDetail.engineCount":"Nombre de moteurs","boatDetail.enginePower":"Puissance (ch)","boatDetail.fuelType":"Type de carburant",
    "boatDetail.fuelTank":"Réservoir carburant","boatDetail.waterTank":"Réservoir d'eau","boatDetail.priceHalfDay":"Tarif demi-journée","boatDetail.priceFullDay":"Tarif journée",
    "boatDetail.deposit":"Dépôt de garantie","boatDetail.equipment":"Équipements","boatDetail.equipmentPlaceholder":"Ex : GPS, guirlande de mouillage, paddle, gilets...",
    "boatDetail.rules":"Règlement du bateau","boatDetail.cancellationPolicy":"Conditions d'annulation",
    "account.eyebrow":"MON COMPTE","account.createTitle":"Créer votre activité sur SkipperNow","account.loginTitle":"Se connecter à SkipperNow",
    "account.tabCreate":"Créer un compte","account.tabLogin":"Se connecter","common.back":"Retour",
    "account.roleClient":"Client","account.roleClientDesc":"Réserver un skipper, un prestataire ou un bateau",
    "account.roleSkipper":"Skipper","account.roleSkipperDesc":"Recevoir des demandes de sortie et de convoyage",
    "account.roleProvider":"Prestataire","account.roleProviderDesc":"Nettoyage, quai, chantier ou marin à la journée",
    "account.roleOwner":"Loueur / Propriétaire","account.roleOwnerDesc":"Proposer un ou plusieurs bateaux à la location",
    "account.nameLabel":"PRÉNOM ET NOM","account.namePlaceholder":"Votre nom","account.phoneLabel":"TÉLÉPHONE","account.photoLabel":"PHOTO DE PROFIL","account.photoReminder":"⚠️ Pensez à ajouter une photo de profil : les fiches sans photo inspirent moins confiance et sont moins souvent contactées.","account.diplomaLabel":"DIPLÔME / CERTIFICATION","account.diplomaCurrent":"Voir le document actuel","account.diplomaNote":"Photo ou PDF de votre diplôme (permis, brevet, carte professionnelle...). Utilisé pour la vérification par l'équipe SkipperNow, non affiché publiquement.","account.diplomaTypeLabel":"TYPE DE DIPLÔME / CERTIFICATION (affiché publiquement)","account.diplomaTypePlaceholder":"Ex. Permis côtier, Brevet 200, Carte professionnelle...","account.photoRequiredError":"Une photo de profil est obligatoire pour publier votre fiche.","account.phoneRequiredError":"Un numéro de téléphone est obligatoire pour publier votre fiche.","account.profileCompletion":"Profil complété","dash.leaveReview":"Laisser un avis","dash.reviewRatingLabel":"NOTE","dash.reviewCommentLabel":"COMMENTAIRE (OPTIONNEL)","dash.reviewSubmit":"Envoyer mon avis","dash.reviewNeedStars":"Merci de choisir une note.","card.reviewsSingle":"avis","card.reviewsPlural":"avis","card.diplomaBadgePrefix":"Diplôme vérifié :","card.sendMessage":"Envoyer un message",
    "account.experienceLabel":"ANNÉES D'EXPÉRIENCE","account.languagesLabel":"LANGUES PARLÉES","account.languagesPlaceholder":"Ex : Français, English, Español",
    "account.skillsLabel":"COMPÉTENCES / TYPES DE BATEAUX MAÎTRISÉS","account.skillsPlaceholder":"Ex : Voilier, Catamaran, Yacht à moteur, Convoyage",
    "account.travelRadiusLabel":"RAYON DE DÉPLACEMENT","account.priceHalfDayLabel":"TARIF DEMI-JOURNÉE","account.priceHourLabel":"TARIF HORAIRE (optionnel)","account.travelFeeLabel":"FRAIS DE DÉPLACEMENT",
    "account.siretLabel":"SIRET / N° D'ENTREPRISE","account.insuranceLabel":"ASSURANCE PROFESSIONNELLE","account.insurancePlaceholder":"Assureur et n° de police",
    "account.emailLabel":"EMAIL","account.passwordLabel":"MOT DE PASSE","account.passwordPlaceholder":"8 caractères minimum",
    "account.portLabel":"PORT PRINCIPAL — VILLE, PAYS","account.portPlaceholder":"Ex. Port Vauban, Antibes, France","account.zoneLabel":"VILLE / ZONE D'INTERVENTION","account.zonePlaceholder":"Ex. Antibes, Cannes, Golfe-Juan…","account.portHelp":"Choisissez une suggestion dans la liste pour que votre ville soit bien reconnue.",
    "account.activityLabel":"ACTIVITÉ PROPOSÉE","account.createSubmit":"Créer mon compte","account.loginSubmit":"Se connecter","account.forgot":"Mot de passe oublié ?",
    "account.errMissing":"Complétez les champs et utilisez au moins 8 caractères pour le mot de passe.",
    "account.errName":"Indiquez votre nom.","account.errPort":"Indiquez votre port principal.",
    "account.loginError":"Email ou mot de passe incorrect. Utilisez « Mot de passe oublié » si besoin.",
    "error.generic":"Une erreur est survenue. Merci de réessayer.","error.phoneFormat":"Le numéro de téléphone contient des caractères non valides. Retapez-le manuellement (chiffres, espaces, + et - uniquement).","error.duplicate":"Cette information est déjà utilisée par un autre compte.","error.invalidCredentials":"Email ou mot de passe incorrect.","error.emailTaken":"Cet email est déjà associé à un compte.","error.network":"Problème de connexion. Vérifiez votre connexion internet et réessayez.","error.permission":"Vous n'avez pas les droits nécessaires pour effectuer cette action.","error.session":"Votre session a expiré. Merci de vous reconnecter.","error.missingField":"Un champ obligatoire est manquant.","action.savedSuccess":"✓ Vos informations ont bien été enregistrées.",
    "account.emailNotConfirmed":"Votre adresse email n'est pas encore confirmée. Ouvrez le message reçu de SkipperNow.",
    "account.signupSuccess":"Compte créé. Vérifiez votre email puis revenez vous connecter.",
    "account.forgotNeedEmail":"Entrez d'abord votre adresse email.","account.forgotSent":"Email envoyé. Vérifiez aussi vos courriers indésirables.",
    "account.forgotError":"Impossible d'envoyer l'email : ",
    "booking.eyebrowRequest":"DEMANDE DE RÉSERVATION","booking.defaultTarget":"Professionnel sélectionné",
    "booking.port":"Port","booking.price":"Tarif","booking.priceTbd":"À définir avec le professionnel",
    "booking.nameLabel":"VOTRE NOM","booking.phoneLabel":"TÉLÉPHONE","booking.boatLabel":"TYPE DE BATEAU","booking.boatOptionalLabel":"TYPE DE BATEAU (OPTIONNEL)","booking.boatPlaceholder":"Ex. Cap Camarat 9.0",
    "booking.detailsLabel":"DÉCRIVEZ VOTRE BESOIN","booking.detailsPlaceholder":"Nettoyage, sortie, convoyage, nombre de personnes…","booking.rentalDetailsLabel":"PRÉCISIONS (OPTIONNEL)","booking.rentalDetailsPlaceholder":"Nombre de passagers, horaire souhaité, demandes particulières…","booking.photosLabel":"PHOTOS (OPTIONNEL)",
    "booking.paymentNote":"Le professionnel vous propose un prix. Vous ne payez qu'après avoir accepté son devis.",
    "booking.submit":"Envoyer la demande","booking.successTitle":"Demande envoyée",
    "booking.successText":"Le professionnel peut maintenant consulter votre demande et vous proposer un prix.","booking.successCta":"Voir ma demande",
    "booking.needLogin":"Connectez-vous avant d'envoyer une demande.","booking.needClient":"Un compte client est nécessaire pour envoyer une demande.",
    "booking.needBoat":"Indiquez le type de bateau.","booking.needPort":"Indiquez le port ou la ville.","booking.needDate":"Choisissez une date.","booking.needFutureDate":"Choisissez une date à venir.","booking.needDays":"Indiquez le nombre de jours (minimum 2).","booking.needDetails":"Décrivez votre besoin en quelques mots.","booking.sending":"Envoi en cours…","dash.requestSent":"Envoyée","dash.requestReceived":"Reçue",
    "dash.clientEyebrow":"ESPACE CLIENT","dash.clientTitle":"Mes réservations",
    "dash.proEyebrow":"ESPACE PROFESSIONNEL","dash.proTitle":"Mes missions",
    "dash.adminEyebrow":"ADMINISTRATION","dash.adminTitle":"Tableau de bord SkipperNow",
    "dash.navRequests":"Mes demandes","dash.navBoats":"Mes bateaux","dash.viewUserBoats":"Voir ses bateaux","dash.editBoat":"Modifier l'annonce","dash.boatsOf":"Bateaux de","dash.clearFilter":"Voir tous les bateaux","dash.navProfile":"Mon profil","dash.navAvailability":"Disponibilités","dash.logout":"Se déconnecter","dash.navMessages":"Messages","dash.noMessages":"Aucune conversation pour le moment.","dash.noUnreadMessages":"Aucun nouveau message.","dash.messagePlaceholder":"Écrivez votre message…","dash.send":"Envoyer","dash.loading":"Chargement…","dash.deleteMessage":"Supprimer","dash.confirmDeleteMessage":"Supprimer ce message ?","dash.deleteConversation":"Supprimer la conversation","dash.confirmDeleteConversation":"Supprimer toute cette conversation ? Cette action est irréversible.","dash.tabUnread":"Non lus","dash.tabAll":"Tous","dash.navSupport":"Contacter le support","dash.noSupport":"Le support n'est pas disponible pour le moment.","dash.supportIntro":"Une question, un souci ? Écrivez directement à l'équipe SkipperNow.",
    "booking.privacyNote":"Pour votre sécurité, les coordonnées personnelles (téléphone, email) ne sont jamais partagées directement entre client et professionnel.",
    "dash.navForms":"Formulaires",
    "dash.navOverview":"Vue d'ensemble","dash.navTraffic":"Statistiques","dash.kpiVisitorsToday":"Visiteurs aujourd'hui","dash.kpiVisitors7d":"Visiteurs (7 j)","dash.kpiVisitors30d":"Visiteurs (30 j)","dash.kpiVisitorsYear":"Visiteurs (1 an)","dash.performance30d":"Résultats des 30 derniers jours","dash.kpiAccounts30d":"Nouveaux comptes","dash.kpiRequests30d":"Demandes envoyées","dash.kpiCompleted30d":"Missions terminées","dash.kpiConversion30d":"Visiteurs devenus membres","dash.topPagesTitle":"Pages consultées (30 derniers jours)","dash.noViewsYet":"Aucune visite enregistrée pour l'instant.","dash.visitorsTrackingNote":"Les visiteurs uniques ne sont fiables que depuis la mise en place du suivi, le {date}. Les pages vues plus anciennes sont comptées comme pages vues mais pas comme visiteurs uniques.","dash.trackingSinceUnknown":"date inconnue","dash.pageViews30d":"{count} page(s) vue(s) sur 30 jours","dash.originTitle":"Origine des visiteurs (30 jours)","dash.countryProbable":"Pays probable","dash.timezones":"Fuseaux horaires","dash.originPrivacyNote":"Localisation approximative d'après la langue et le fuseau horaire du navigateur, sans GPS ni stockage de l'adresse IP. Les anciennes visites n'ont pas de localisation.","dash.originEmpty":"Les premières localisations apparaîtront avec les nouvelles visites.","dash.visitorCount":"{count} visiteur(s)","dash.viewCount":"{count} vue(s)","dash.navValidations":"Validations","dash.navMissions":"Missions","dash.navUsers":"Utilisateurs","dash.navSettings":"Réglages",
    "dash.bookingFunnelTitle":"Tunnel de réservation (30 jours)","dash.bookingOpened":"Formulaires ouverts","dash.bookingLoginRequired":"Connexion demandée","dash.bookingSubmitted":"Envois tentés","dash.bookingCreated":"Demandes créées","dash.bookingFailed":"Échecs d'envoi",
    "dash.noRequests":"Aucune demande pour le moment.","dash.noBoats":"Aucun bateau ajouté pour le moment.","dash.noMissions":"Aucune mission pour le moment.",
    "dash.kpiUsers":"Utilisateurs","dash.kpiPending":"À valider","dash.kpiMissions":"Missions","dash.kpiRevenue":"Commission cumulée",
    "dash.navPayments":"Encaissements","dash.navPayouts":"Virements","dash.navRefunds":"Remboursements","dash.navCommissions":"Commissions","dash.navBoatsAdmin":"Bateaux",
    "dash.groupActivity":"Activité","dash.groupFinance":"Finance","dash.groupAccounts":"Comptes","dash.priorityQueueTitle":"À traiter en priorité","dash.priorityEmpty":"Rien d'urgent — tout est à jour.","dash.priorityValidation":"Profil à valider","dash.priorityDispute":"Litige ouvert","dash.priorityPayout":"Virement à préparer","dash.kpiTrendWeek":"sur 7 jours",
    "dash.groupContent":"Contenu","dash.navContent":"Ports & destinations","dash.contentAddPort":"Ajouter un port","dash.contentPortName":"Nom du port","dash.contentPortLat":"Latitude","dash.contentPortLng":"Longitude","dash.contentPortDesc":"Description","dash.contentPortOrder":"Ordre d'affichage","dash.contentPortActive":"Visible sur le site","dash.contentSave":"Enregistrer","dash.contentDelete":"Supprimer","dash.contentEdit":"Modifier","dash.contentCancel":"Annuler","dash.contentNoPorts":"Aucun port pour l'instant.","dash.contentSaved":"Enregistré.","dash.contentDeleted":"Port supprimé.","dash.contentConfirmDelete":"Supprimer ce port ? Cette action est définitive.",
    "dash.navHero":"Photos du carrousel","dash.heroAddSlide":"Ajouter une photo","dash.heroImageUrl":"URL de l'image","dash.heroAlt":"Description (accessibilité)","dash.heroOrder":"Ordre d'affichage","dash.heroActive":"Visible sur le site","dash.heroNoSlides":"Aucune photo pour l'instant.","dash.heroPreview":"Aperçu","dash.heroUploadLabel":"Ou envoyer une photo depuis votre ordinateur","dash.heroUploading":"Envoi en cours...","dash.heroUploaded":"Photo envoyée.","dash.navDestinations":"Destinations phares","dash.destAddTile":"Ajouter une destination","dash.destName":"Nom de la destination","dash.destNoTiles":"Aucune destination pour l'instant.","dash.navActivities":"Idées de sorties","dash.actAddTile":"Ajouter une sortie","dash.actPortName":"Port concerné","dash.actTitle":"Titre de la sortie","dash.actDesc":"Description","dash.actNoTiles":"Aucune sortie pour l'instant.","dash.navExcursions":"Mes excursions","dash.excAddTile":"Ajouter une excursion","dash.excTitle":"Titre de l'excursion","dash.excDesc":"Description","dash.excIncluded":"Ce qui est inclus (repas, matériel...)","dash.excPort":"Port de départ","dash.excPrice":"Prix par personne","dash.excDuration":"Durée (heures)","dash.excMaxGuests":"Nombre de places max","dash.excNoTiles":"Aucune excursion pour l'instant.","dash.guests":"personnes","dash.requestExcursion":"Demander cette excursion","dash.excGuestCount":"Nombre de personnes","dash.excDateWanted":"Date souhaitée","dash.excRequestSent":"Votre demande a été envoyée à l'agence.","dash.navMyLink":"Mon lien direct","directReq.eyebrow":"DEMANDE DIRECTE","directReq.title":"Envoyer ma demande","directReq.needAccount":"Connectez-vous ou créez un compte pour envoyer votre demande.","directReq.portLabel":"Port de départ","directReq.dateLabel":"Date souhaitée","directReq.descLabel":"Votre demande","directReq.submit":"Envoyer ma demande","directReq.sent":"Votre demande a été envoyée.","directReq.requestLabel":"Demande directe","directReq.dashboardExplain":"Partagez ce lien ou ce QR code avec un client que vous connaissez déjà : en un clic, il crée un compte (si besoin) et sa demande vous est directement adressée sur SkipperNow.","directReq.copyLink":"Copier le lien","directReq.copied":"Lien copié !","excFinder.eyebrow":"EXCURSIONS","excFinder.title":"Excursions disponibles","excFinder.empty":"Aucune excursion disponible pour ce port.","excFinder.perPerson":"/ personne","dash.reqPhone":"Téléphone manquant","dash.reqDiploma":"Diplôme manquant","dash.reqPhoto":"Photo de profil manquante","dash.reqPhotoLink":"Voir la photo","dash.missingBeforeApproval":"À compléter avant validation","dash.profileIncompleteReminder":"Complétez votre profil pour être visible et recevoir des missions","dash.completeProfile":"Compléter mon profil","dash.featuredBadge":"Mis en avant","dash.featuredUntil":"Mis en avant jusqu'au","dash.daysLeft":"jours restants","dash.featureFor":"Mettre en avant...","dash.days":"jours","dash.removeFeatured":"Retirer la mise en avant",
    "dash.navDisputes":"Litiges","dash.noDisputes":"Aucun litige en cours.","dash.resolveDispute":"Marquer comme résolu","dash.disputeOpen":"Litige ouvert","dash.disputeResolved":"Litige résolu",
    "dash.reportProblem":"Signaler un problème","dash.viewInvoice":"Reçu et facture",
    "dispute.reasonPrompt":"Décris le problème rencontré",
    "invoice.title":"Facture","invoice.ref":"Référence","invoice.date":"Date","invoice.total":"Total payé","invoice.net":"Net professionnel","invoice.print":"Imprimer",
    "invoice.legalNote":"Document récapitulatif généré par SkipperNow, à valeur de reçu. Pour une facture avec mentions légales complètes, contactez le support.",
    "dash.kpiActiveMissions":"Missions actives","dash.kpiHeldFunds":"Fonds sécurisés","dash.kpiToPayout":"À verser","dash.kpiPlatformRevenue":"Revenus plateforme",
    "dash.kpiNewUsers":"Nouveaux comptes (7j)","dash.kpiOpenDisputes":"Litiges ouverts",
    "dash.internalNoteLabel":"NOTE INTERNE (visible admin uniquement)","dash.saveNote":"Enregistrer la note","dash.rejectDocument":"Refuser le document","dash.documentRejected":"Document refusé",
    "dash.client":"Client","dash.professional":"Professionnel","dash.total":"Total","dash.commission":"Commission","dash.netPro":"Net professionnel","dash.paymentStatus":"Paiement",
    "dash.markPaidOut":"Marquer comme versé","dash.approveRefund":"Accepter le remboursement","dash.rejectRefund":"Refuser","dash.delete":"Supprimer",
    "dash.paymentsNote":"Missions payées par les clients. Le débit réel est exécuté par Stripe.","dash.payoutsNote":"Missions prêtes à être versées aux professionnels, ou déjà versées.",
    "dash.noRefunds":"Aucune demande de remboursement.","dash.requestRefund":"Demander un remboursement",
    "dash.commissionGlobalTitle":"Commission par défaut","dash.commissionProviderTitle":"Commission personnalisée par professionnel",
    "dash.chooseProvider":"Choisir un professionnel","dash.customRate":"Taux personnalisé (%)","dash.saveRate":"Enregistrer ce taux",
    "dash.stripeNote":"Le débit, le remboursement et le versement réels sont exécutés par les fonctions Supabase Edge (Stripe) déployées côté serveur.",
    "dash.missionsCount":"Missions liées","dash.suspended":"Suspendu","dash.owner":"Propriétaire",
    "paymentStatus.unpaid":"Non payée","paymentStatus.paid":"Payée","paymentStatus.transferred":"Versée","paymentStatus.payout_ready":"Prête à verser",
    "paymentStatus.refund_requested":"Remboursement demandé","paymentStatus.refunded":"Remboursée","paymentStatus.refund_rejected":"Remboursement refusé",
    "dash.accept":"Accepter la demande","dash.decline":"Décliner","dash.proposePrice":"Proposer un prix","dash.acceptQuote":"Accepter le devis",
    "dash.refuseQuote":"Refuser le devis","dash.pay":"Payer maintenant","dash.markDone":"Marquer comme terminée","dash.validate":"Valider la mission",
    "dash.cancel":"Annuler","dash.approve":"Valider le profil","dash.suspend":"Suspendre","dash.saveSettings":"Enregistrer les réglages",
    "dash.settingsCommission":"Commission par défaut (%)","dash.settingsUrgent":"Supplément demande urgente (€)","dash.settingsSupport":"Email d'assistance",
    "dash.payoutSetupNote":"Renseignez vos coordonnées de versement uniquement dans Paiements, via le formulaire sécurisé.","dash.managePayoutDetails":"Gérer mes coordonnées dans Paiements",
    "dash.payoutDetailsNote":"Ces coordonnées bancaires ne sont visibles que par vous et par l'administrateur, jamais par les clients.","dash.holderLabel":"TITULAIRE DU COMPTE","dash.ibanLabel":"IBAN","dash.bicLabel":"BIC","dash.noIban":"Ce professionnel n'a pas encore renseigné son IBAN.",
    "status.pending":"En attente de prix","status.quoted":"Prix proposé","status.accepted":"Devis accepté","status.rejected":"Devis refusé",
    "status.paid":"Payée","status.in_progress":"En cours","status.awaiting_validation":"À valider","status.completed":"Terminée","status.cancelled":"Annulée",
    "footer.disclaimer":"",
    "faq.greeting":"Bonjour ! Je peux répondre aux questions courantes sur SkipperNow. Choisissez une question ci-dessous ou tapez la vôtre.",
    "faq.title":"Assistant SkipperNow","faq.inputPlaceholder":"Écrivez votre question…",
    "faq.priceChip":"Combien ça coûte ?","faq.bookingChip":"Comment réserver ?","faq.becomeChip":"Devenir skipper","faq.contactChip":"Parler à un humain",
    "faq.price":"Le tarif est fixé librement par chaque professionnel après votre demande — vous ne payez qu'une fois le devis accepté, jamais avant.",
    "faq.booking":"Choisissez un port et une date, sélectionnez un skipper ou un prestataire, puis envoyez votre demande. Le professionnel vous répond avec un prix.",
    "faq.cancel":"Vous pouvez annuler une demande tant qu'elle n'est pas payée, directement depuis votre espace « Mes demandes ».",
    "faq.refund":"Une fois une mission terminée, vous pouvez demander un remboursement depuis votre espace client si besoin — l'équipe SkipperNow l'examine.",
    "faq.become":"Cliquez sur « Créer un compte », choisissez Skipper ou Prestataire, renseignez votre port principal, et votre profil sera examiné par notre équipe.",
    "faq.payment":"Le paiement est sécurisé et n'est débité qu'après acceptation du devis par vous.",
    "faq.contact":"Pas de souci, écrivez-nous directement depuis l'onglet « Contacter le support » de votre espace, ou par email via le lien Contact en bas de page.",
    "faq.fallback":"Je n'ai pas de réponse toute faite pour ça — le plus simple est de contacter directement l'équipe SkipperNow depuis l'onglet « Contacter le support » de votre espace.",
    "payment.eyebrow":"PAIEMENT SÉCURISÉ","payment.title":"Payer la mission","payment.amount":"Montant","payment.pay":"Payer",
  },
  en:{
    "nav.login":"Log in","nav.signup":"Create an account","nav.myAccount":"My account",
    "notif.unreadMessages":"unread message(s)","notif.quotesReceived":"quote(s) received to review","notif.awaitingValidation":"job(s) to validate","notif.newRequests":"new request(s) available",
    "notif.pendingValidations":"profile(s) pending approval","notif.adminNewRequests":"new client request(s) to process","notif.refundRequests":"refund request(s)","notif.openDisputes":"open dispute(s)","notif.empty":"No notifications yet.",
    "push.unsupported":"Notifications are not supported on this browser.","push.enable":"Enable notifications","push.enabled":"Notifications enabled!",
    "hero.eyebrow":"ONE PLATFORM. EVERYTHING BOATING.",
    "seo.titleDefault":"SkipperNow | Skippers, boats, services & experiences at sea","seo.descDefault":"Book a skipper, find a boat, a marine service or an experience at sea with SkipperNow, anywhere in the world.",
    "seo.title.skipper":"Find a skipper in {port} | SkipperNow","seo.desc.skipper":"Book a verified professional skipper in {port}. Secure payment, fast response, even last minute.",
    "seo.title.day_sailor":"Day sailor in {port} | SkipperNow","seo.desc.day_sailor":"Find a day sailor available in {port} for one-off jobs (cleaning, provisioning, dock assistance...).",
    "seo.title.cleaning":"Marine service provider in {port} | SkipperNow","seo.desc.cleaning":"Find a verified marine service provider in {port}: cleaning, maintenance, mechanics and more.",
    "hero.title":"The sea starts here.",
    "hero.subtitle":"Rent a boat, find a skipper or book marine services wherever you sail.",
    "hero.trust1":"Verified profiles","hero.trust2":"Fast response","hero.trust3":"Secure payment",
    "hero.ctaProviders":"Marine services","hero.ctaBoats":"Find a boat","hero.ctaSkipper":"Find a skipper",
    "search.portLabel":"DEPARTURE PORT — WORLDWIDE","search.portPlaceholder":"E.g. Cannes, Miami, Ibiza…",
    "search.dateLabel":"DATE","search.durationLabel":"DURATION","search.submit":"Search",
    "duration.half":"Half day","duration.day":"Full day","duration.multi":"Several days","duration.daysLabel":"NUMBER OF DAYS",
    "rental.badge":"BOAT RENTALS","rental.title":"List my boat for rent","providersShowcase.badge":"REGISTERED PROVIDERS","providersShowcase.title":"Verified professionals available","providersShowcase.subtitle":"Discover only profiles genuinely approved by SkipperNow.","providersShowcase.viewAll":"View professionals","providersShowcase.empty":"No provider registered yet.",
    "categories.badge":"CATEGORIES","categories.title":"What do you need?","categories.skipperDesc":"Trips, rentals, deliveries and boat familiarisation.","categories.daySailorDesc":"Hands-on help, handling, short delivery trips.","categories.providersDesc":"Cleaning, maintenance, mechanics, provisioning and dockside services.","categories.boatRentalTitle":"Boat Rental","categories.boatRentalDesc":"Find the right boat for your destination.","categories.experienceTitle":"Experiences on the Water","categories.experienceDesc":"Excursions, trips and unforgettable experiences on …97978 tokens truncated…" data-approve="${p.id}">${esc(t("dash.approve"))}</button>` : `<button class="small-btn danger" data-suspend="${p.id}">${esc(t("dash.suspend"))}</button>`}
    </div>
  </article>`;
}
function bindProfileActions(){
  document.querySelectorAll("[data-approve]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({verified:true, available:true}).eq("id", btn.dataset.approve);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-suspend]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.suspend")+" ?")) return;
    const {error} = await db.from("profiles").update({verified:false, available:false, suspended:true}).eq("id", btn.dataset.suspend);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-reject-doc]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const reason = prompt(t("dash.rejectDocument") + " — " + t("dispute.reasonPrompt"));
    if(reason === null || !reason.trim()) return;
    const {error} = await db.from("profiles").update({verified:false, document_rejection_reason: reason.trim()}).eq("id", btn.dataset.rejectDoc);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-feature]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({featured:true}).eq("id", btn.dataset.feature);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-unfeature]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const {error} = await db.from("profiles").update({featured:false}).eq("id", btn.dataset.unfeature);
    if(error) alert(friendlyError(error)); else openDashboard();
  }));
  document.querySelectorAll("[data-save-note]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const id = btn.dataset.saveNote;
    const note = document.querySelector(`[data-note-input="${id}"]`).value.trim();
    const msg = document.querySelector(`[data-note-msg="${id}"]`);
    const {error} = await db.from("profiles").update({admin_notes: note}).eq("id", id);
    if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); }
    else { msg.style.color = "#08794e"; msg.textContent = t("action.savedSuccess"); }
  }));
  document.querySelectorAll("[data-delete-user]").forEach(btn=>btn.addEventListener("click", async ()=>{
    if(!confirm(t("dash.delete")+" ?")) return;
    btn.disabled = true;
    const {data:{session}} = await db.auth.getSession();
    try{
      const res = await fetch(SUPABASE_URL + "/functions/v1/delete-user-admin", {
        method: "POST",
        headers: {"Content-Type":"application/json", "Authorization":"Bearer "+session.access_token, "apikey": SUPABASE_KEY},
        body: JSON.stringify({userId: btn.dataset.deleteUser})
      });
      const j = await res.json();
      if(!res.ok || !j.ok){ alert(j.error || "Erreur"); btn.disabled = false; return; }
      openDashboard();
    }catch(err){ alert(friendlyError(err)); btn.disabled = false; }
  }));
  document.querySelectorAll("[data-message-user]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const targetId = btn.dataset.messageUser;
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="messages"));
    await renderAdminPanel("messages");
    const list = document.querySelector("#conversationList");
    const thread = document.querySelector("#conversationThread");
    if(list) list.style.display = "none";
    if(thread) thread.style.display = "block";
    await openConversationThread(targetId, currentUser.id);
  }));
  document.querySelectorAll("[data-view-profile]").forEach(btn=>btn.addEventListener("click", ()=>{
    openProfileDetail(btn.dataset.viewProfile, true);
  }));
  document.querySelectorAll("[data-save-commission]").forEach(btn=>btn.addEventListener("click", async ()=>{
    const id = btn.dataset.saveCommission;
    const input = document.querySelector(`[data-commission-input="${id}"]`);
    const msg = document.querySelector(`[data-commission-msg="${id}"]`);
    const rate = Math.max(0, Math.min(50, Number(input.value)));
    const {error} = await db.from("profiles").update({commission_percent: rate}).eq("id", id);
    if(msg){ msg.style.color = error ? "#b42318" : "#08794e"; msg.textContent = error ? error.message : t("dash.saveRate"); }
  }));
  document.querySelectorAll("[data-view-boats]").forEach(btn=>btn.addEventListener("click", async ()=>{
    adminBoatsFilterOwnerId = btn.dataset.viewBoats;
    document.querySelectorAll(".dash-side button").forEach(b=>b.classList.toggle("active", b.dataset.panel==="boats"));
    await renderAdminPanel("boats");
  }));
}
async function getOrCreateConversation(clientId, skipperId){
  const {data, error: lookupError} = await db.from("conversations").select("*").eq("client_id", clientId).eq("skipper_id", skipperId).order("created_at", {ascending:true}).order("id", {ascending:true}).limit(1).maybeSingle();
  if(lookupError) throw lookupError;
  if(data) return data;
  const {data:created, error} = await db.from("conversations").insert({client_id: clientId, skipper_id: skipperId}).select().single();
  if(error) throw error;
  return created;
}
async function openSupportThread(){
  const main = document.querySelector("#dashMain");
  main.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  const {data: admin, error} = await db.from("profiles").select("id").eq("role","admin").limit(1).maybeSingle();
  if(error || !admin){ main.innerHTML = `<div class="empty-note">${esc(t("dash.noSupport"))}</div>`; return; }
  main.innerHTML = `<div class="note-box">${esc(t("dash.supportIntro"))}</div><div id="conversationThread"></div>`;
  await openConversationThread(currentUser.id, admin.id);
}

function roleLabel(p){
  if(!p) return "";
  if(p.role === "skipper") return t("account.roleSkipper");
  if(p.role === "provider") return t("account.roleProvider") + (p.provider_activity ? " · " + activityLabel(p.provider_activity) : "");
  if(p.role === "client") return t("account.roleClient");
  if(p.role === "admin") return "Admin";
  return "";
}
function messageSelectionCopy(){
  return ({fr:{all:"Tout sélectionner",select:"Sélectionner la conversation",remove:"Supprimer la sélection",selected:"sélectionnée(s)",scope:"Conversations affichées",confirm:"Supprimer définitivement {n} conversation(s) et leurs messages pour tous les participants ?",failed:"Certaines conversations n’ont pas pu être supprimées."},en:{all:"Select all",select:"Select conversation",remove:"Delete selected",selected:"selected",scope:"Displayed conversations",confirm:"Permanently delete {n} conversation(s) and their messages for all participants?",failed:"Some conversations could not be deleted."},es:{all:"Seleccionar todo",select:"Seleccionar conversación",remove:"Eliminar selección",selected:"seleccionada(s)",scope:"Conversaciones mostradas",confirm:"¿Eliminar definitivamente {n} conversación(es) y sus mensajes para todos los participantes?",failed:"No se pudieron eliminar algunas conversaciones."}})[currentLang] || {all:"Select all",select:"Select conversation",remove:"Delete selected",selected:"selected",scope:"Displayed conversations",confirm:"Delete {n} conversations and their messages for all participants?",failed:"Some conversations could not be deleted."};
}
function bindConversationSelection(main, myRoleColumn){
  const boxes = [...main.querySelectorAll("[data-select-conversation]")];
  const all = main.querySelector("#selectAllConversations");
  const remove = main.querySelector("#deleteSelectedConversations");
  const count = main.querySelector("#conversationSelectionCount");
  if(!all || !remove || !count) return;
  const copy = messageSelectionCopy();
  let busy = false;
  const update = ()=>{
    const selected = boxes.filter(box=>box.checked).length;
    all.checked = boxes.length > 0 && selected === boxes.length;
    all.indeterminate = selected > 0 && selected < boxes.length;
    remove.disabled = busy || selected === 0;
    count.textContent = `${selected} ${copy.selected}`;
  };
  all.addEventListener("change", ()=>{ if(busy) return; boxes.forEach(box=>box.checked=all.checked); update(); });
  boxes.forEach(box=>box.addEventListener("change", update));
  remove.addEventListener("click", async ()=>{
    if(busy) return;
    const ids = boxes.filter(box=>box.checked).map(box=>box.dataset.selectConversation);
    if(!ids.length || !confirm(copy.confirm.replace("{n}", String(ids.length)))) return;
    busy = true; all.disabled = true; boxes.forEach(box=>box.disabled=true); update();
    try{
      const {data, error} = await db.from("conversations").delete().in("id", ids).select("id");
      if(error) throw error;
      if((data||[]).length !== ids.length) alert(copy.failed);
      await refreshNotifications();
      await renderMessagesPanel(myRoleColumn);
    }catch(error){
      alert(friendlyError(error));
    }finally{
      busy = false; all.disabled = false; boxes.forEach(box=>box.disabled=false); update();
    }
  });
  update();
}
async function renderMessagesPanel(myRoleColumn, filterMode){
  const main = document.querySelector("#dashMain");
  main.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  currentMessagesRoleColumn = myRoleColumn;
  const mode = filterMode || currentMessagesFilterMode || "unread";
  currentMessagesFilterMode = mode;
  // Match the notification badge: a professional can also be a client in a conversation.
  const query = db.from("conversations").select("*")
    .or(`client_id.eq.${currentUser.id},skipper_id.eq.${currentUser.id}`)
    .order("created_at",{ascending:false});
  const {data: conversations, error} = await query;
  if(error){ main.innerHTML = `<div class="note-box">${esc(friendlyError(error))}</div>`; return; }
  const rows = conversations || [];
  const tabsHtml = `<div style="display:flex;gap:8px;margin-bottom:12px">
    <button type="button" class="small-btn${mode==="unread" ? " active" : ""}" data-messages-filter="unread">${esc(t("dash.tabUnread"))}</button>
    <button type="button" class="small-btn${mode==="all" ? " active" : ""}" data-messages-filter="all">${esc(t("dash.tabAll"))}</button>
  </div>`;
  if(!rows.length){ main.innerHTML = tabsHtml + `<div class="empty-note">${esc(t("dash.noMessages"))}</div>`; bindMessagesFilterTabs(main, myRoleColumn); return; }
  const otherIds = rows.map(c => String(c.client_id) === String(currentUser.id) ? c.skipper_id : c.client_id);
  const {data: profiles} = await db.from("profiles").select("id,full_name,role,provider_activity").in("id", otherIds);
  const byId = Object.fromEntries((profiles||[]).map(p=>[String(p.id), p]));
  const {data: unreadRows} = await db.from("messages").select("id,conversation_id").is("read_at", null).neq("sender_id", currentUser.id).in("conversation_id", rows.map(c=>c.id));
  const unreadByConv = {};
  (unreadRows||[]).forEach(m => { unreadByConv[m.conversation_id] = (unreadByConv[m.conversation_id]||0) + 1; });
  const sorted = mode === "unread" ? rows.filter(c => unreadByConv[c.id] > 0) : rows;
  if(!sorted.length){ main.innerHTML = tabsHtml + `<div class="empty-note">${esc(mode==="unread" ? t("dash.noUnreadMessages") : t("dash.noMessages"))}</div>`; bindMessagesFilterTabs(main, myRoleColumn); return; }
  const selectionCopy = messageSelectionCopy();
  main.innerHTML = tabsHtml + `<div id="conversationList"><div class="message-selection-bar">
    <label><input type="checkbox" class="message-select-box" id="selectAllConversations">${esc(selectionCopy.all)}</label>
    <span class="message-selection-count">${esc(selectionCopy.scope)} · <span id="conversationSelectionCount" aria-live="polite"></span></span>
    <button type="button" class="small-btn danger" id="deleteSelectedConversations" disabled>${esc(selectionCopy.remove)}</button>
  </div>${sorted.map(c=>{
    const otherId = String(c.client_id) === String(currentUser.id) ? c.skipper_id : c.client_id;
    const p = byId[String(otherId)];
    const unread = unreadByConv[c.id] || 0;
    return `<div style="display:flex;align-items:stretch;gap:6px">
      <label class="message-select-row"><input type="checkbox" class="message-select-box" data-select-conversation="${c.id}" aria-label="${esc(selectionCopy.select)} : ${esc(p?.full_name || "—")}"></label>
      <button type="button" class="request-card" style="flex:1;text-align:left;cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px;${unread ? "border-color:var(--aqua);background:var(--mist)" : ""}" data-conversation-id="${c.id}" data-conversation="${c.client_id}|${c.skipper_id}"><strong>${unread ? "🔵 " : ""}${esc(p?.full_name || "—")}</strong><span style="display:flex;align-items:center;gap:8px"><span class="tag">${esc(roleLabel(p))}</span>${unread ? `<span class="tag" style="background:#c0392b;color:#fff">${unread}</span>` : ""}</span></button>
      <button type="button" class="small-btn danger" data-delete-conversation="${c.id}" title="${esc(t("dash.deleteConversation"))}" style="flex:0 0 auto">🗑</button>
    </div>`;
  }).join("")}</div><div id="conversationThread" style="display:none"></div>`;
  bindMessagesFilterTabs(main, myRoleColumn);
  bindConversationSelection(main, myRoleColumn);
  main.querySelectorAll("[data-conversation]").forEach(btn=>btn.addEventListener("click", ()=>{
    const [clientId, skipperId] = btn.dataset.conversation.split("|");
    document.querySelector("#conversationList").style.display = "none";
    document.querySelector("#conversationThread").style.display = "block";
    openConversationThread(clientId, skipperId, btn.dataset.conversationId);
  }));
  main.querySelectorAll("[data-delete-conversation]").forEach(btn=>btn.addEventListener("click", async (e)=>{
    e.stopPropagation();
    if(!confirm(t("dash.confirmDeleteConversation"))) return;
    const {error: delConvError} = await db.from("conversations").delete().eq("id", btn.dataset.deleteConversation);
    if(delConvError){ alert(friendlyError(delConvError)); return; }
    await renderMessagesPanel(myRoleColumn);
  }));
}
async function openConversationThread(clientId, skipperId, conversationId){
  unsubscribeThreadChannel();
  const thread = document.querySelector("#conversationThread") || document.querySelector("#dashMain");
  thread.innerHTML = `<div class="empty-note">${esc(t("dash.loading"))}</div>`;
  try{
    let conversation;
    if(conversationId){
      const {data, error} = await db.from("conversations").select("*").eq("id", conversationId).eq("client_id", clientId).eq("skipper_id", skipperId).single();
      if(error) throw error;
      conversation = data;
    }else{
      conversation = await getOrCreateConversation(clientId, skipperId);
    }
    const otherId = String(clientId) === String(currentUser.id) ? skipperId : clientId;
    const [{data: messages, error}, {data: otherProfile}] = await Promise.all([
      db.from("messages").select("*").eq("conversation_id", conversation.id).order("created_at",{ascending:true}),
      db.from("profiles").select("full_name,role,provider_activity,contact_email,preferred_language").eq("id", otherId).maybeSingle()
    ]);
    if(error) throw error;
    const rows = messages || [];
    const unreadIds = rows.filter(m => String(m.sender_id) !== String(currentUser.id) && !m.read_at).map(m=>m.id);
    if(unreadIds.length){
      const {error: readError} = await db.from("messages").update({read_at: new Date().toISOString()}).eq("conversation_id", conversation.id).neq("sender_id", currentUser.id).in("id", unreadIds);
      if(readError) throw readError;
      await refreshNotifications();
    }
    thread.innerHTML = `
      <button type="button" class="back-link" id="backToConversationList" style="margin:0 0 12px">← ${esc(t("common.back"))}</button>
      <div class="request-top" style="margin-bottom:10px">
        <div><h3 style="margin:0">${esc(otherProfile?.full_name || "—")}</h3></div>
        <span class="tag">${esc(roleLabel(otherProfile))}</span>
      </div>
      <div class="note-box">${esc(t("booking.privacyNote"))}</div>
      <div id="messageThreadBody" style="max-height:320px;overflow:auto;display:flex;flex-direction:column;gap:8px;margin:12px 0">
        ${rows.length ? rows.map(m=>`<div style="align-self:${String(m.sender_id)===String(currentUser.id)?"flex-end":"flex-start"};max-width:80%;display:flex;align-items:flex-end;gap:6px">${String(m.sender_id)===String(currentUser.id)?`<button type="button" class="small-btn" data-delete-message="${m.id}" title="${esc(t("dash.deleteMessage"))}" style="border:0;background:transparent;color:var(--muted);padding:2px 4px;font-size:12px">✕</button>`:""}<div style="background:${String(m.sender_id)===String(currentUser.id)?"var(--navy)":"var(--mist)"};color:${String(m.sender_id)===String(currentUser.id)?"#fff":"var(--ink)"};padding:10px 13px;border-radius:14px">${esc(m.body)}</div></div>`).join("") : `<div class="empty-note">${esc(t("dash.noMessages"))}</div>`}
      </div>
      <div style="display:flex;gap:8px">
        <input id="messageInput" placeholder="${esc(t("dash.messagePlaceholder"))}" style="flex:1;border:1px solid var(--line);border-radius:12px;padding:11px">
        <button class="primary" id="messageSendBtn">${esc(t("dash.send"))}</button>
      </div>`;
    const scrollBody = document.querySelector("#messageThreadBody");
    if(scrollBody) scrollBody.scrollTop = scrollBody.scrollHeight;
    currentThreadChannel = db.channel("conversation-"+conversation.id)
      .on("postgres_changes", {event:"INSERT", schema:"public", table:"messages", filter:`conversation_id=eq.${conversation.id}`}, payload=>{
        const m = payload.new;
        const body_ = document.querySelector("#messageThreadBody");
        if(!body_) return;
        const mine = String(m.sender_id) === String(currentUser.id);
        if(!mine){
          const emptyNote = body_.querySelector(".empty-note");
          if(emptyNote) emptyNote.remove();
          const bubble = document.createElement("div");
          bubble.style.cssText = "align-self:flex-start;max-width:80%;display:flex;align-items:flex-end;gap:6px";
          bubble.innerHTML = `<div style="background:var(--mist);color:var(--ink);padding:10px 13px;border-radius:14px">${esc(m.body)}</div>`;
          body_.appendChild(bubble);
          body_.scrollTop = body_.scrollHeight;
          db.from("messages").update({read_at: new Date().toISOString()}).eq("id", m.id).then(()=>refreshNotifications());
        }
      })
      .subscribe();
    document.querySelectorAll("[data-delete-message]").forEach(btn=>btn.addEventListener("click", async (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if(!confirm(t("dash.confirmDeleteMessage"))) return;
      const {error: delError} = await db.from("messages").delete().eq("id", btn.dataset.deleteMessage);
      if(delError){ alert(friendlyError(delError)); return; }
      await openConversationThread(clientId, skipperId, conversation.id);
    }));
    document.querySelector("#backToConversationList").addEventListener("click", ()=>{ unsubscribeThreadChannel(); renderMessagesPanel(currentMessagesRoleColumn); });
    document.querySelector("#messageSendBtn").addEventListener("click", async ()=>{
      const input = document.querySelector("#messageInput");
      const body = sanitizeContactInfo(input.value.trim());
      if(!body) return;
      const {error: sendError} = await db.from("messages").insert({conversation_id: conversation.id, sender_id: currentUser.id, body});
      if(sendError){ alert(friendlyError(sendError)); return; }
      if(otherProfile?.contact_email){
        fetch(SUPABASE_URL + "/functions/v1/notify-new-message", {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            to: otherProfile.contact_email,
            recipientName: otherProfile.full_name || "",
            senderName: currentProfile?.full_name || "",
            preview: body.slice(0, 180)
          })
        }).catch(()=>{});
      }
      notifyRecipient(otherId, currentProfile?.full_name || "SkipperNow", body.slice(0, 150), "https://skippernow.fr");
      input.value = "";
      await openConversationThread(clientId, skipperId, conversation.id);
    });
  }catch(err){
    thread.innerHTML = `<div class="note-box">${esc(friendlyError(err))}</div>`;
  }
}

function profileCompletionPercent(profile){
  if(!profile || !["skipper","provider"].includes(profile.role)) return null;
  const checks = [
    !!profile.profile_photo_url,
    !!(profile.bio && profile.bio.trim()),
    !!(profile.price_from_cents || profile.price_half_day_cents || profile.price_hour_cents),
    !!(profile.skills && profile.skills.trim()),
    !!profile.experience_years,
    !!(profile.phone && profile.phone.trim())
  ];
  if(profileNeedsDiploma(profile)) checks.push(!!(profile.diploma_type && profile.diploma_type.trim()));
  const done = checks.filter(Boolean).length;
  return Math.round((done / checks.length) * 100);
}
function profileForm(profile){
 const isPro = ["skipper","provider","owner"].includes(profile?.role);
 const showPayout = ["skipper","provider"].includes(profile?.role);
 const needsDiploma = profileNeedsDiploma(profile);
 const completion = profileCompletionPercent(profile);
  return `${completion !== null ? `<div class="field" style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:800;color:var(--navy);margin-bottom:6px"><span>${esc(t("account.profileCompletion"))}</span><span>${completion}%</span></div>
      <div style="background:var(--line);border-radius:999px;height:10px;overflow:hidden"><div style="background:var(--aqua);height:100%;width:${completion}%;border-radius:999px;transition:width .3s"></div></div>
    </div>` : ""}
    ${!profile?.profile_photo_url ? `<div class="note-box" style="background:#fff8e6;border-color:#f5d98a;color:#8a6d1a">${esc(t("account.photoReminder"))}</div>` : ""}
    <div class="field"><label>${esc(t("account.photoLabel"))}</label>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
        ${profile?.profile_photo_url ? `<img loading="lazy" src="${esc(profile.profile_photo_url)}" style="width:64px;height:64px;object-fit:cover;border-radius:50%">` : `<div style="width:64px;height:64px;border-radius:50%;background:var(--mist);display:grid;place-items:center;font-size:24px">⚓</div>`}
        <input id="profilePhotoInput" type="file" accept="image/*">
      </div>
    </div>
    <div class="field"><label>${esc(t("account.nameLabel"))}</label><input id="profileName" value="${esc(profile?.full_name||"")}"></div>
    <div class="field" style="position:relative"><label>${esc(profile?.role === "provider" ? t("account.zoneLabel") : t("account.portLabel"))}</label><input id="profilePort" autocomplete="off" value="${esc(profile?.home_port||"")}">
      <div id="profilePortSuggestions" class="port-suggestions"></div>
      <div class="muted" style="margin-top:4px;font-size:12px">${esc(t("account.portHelp"))}</div>
    </div>
    <div class="field"><label>${esc(t("account.phoneLabel"))}${needsDiploma ? ' <span style="color:#b42318">*</span>' : ""}</label><input id="profilePhone" value="${esc(profile?.phone||"")}"></div>
    ${isPro ? `<div class="field"><label>${esc(t("account.experienceLabel"))}</label><input id="profileExperience" type="number" min="0" step="1" value="${profile?.experience_years??""}"></div>
    <div class="field"><label>${esc(t("account.languagesLabel"))}</label><input id="profileLanguages" placeholder="${esc(t("account.languagesPlaceholder"))}" value="${esc(profile?.languages||"")}"></div>
    <div class="field"><label>${esc(t("account.skillsLabel"))}</label><input id="profileSkills" placeholder="${esc(t("account.skillsPlaceholder"))}" value="${esc(profile?.skills||"")}"></div>
    <div class="field"><label>${esc(t("account.travelRadiusLabel"))} (km)</label><input id="profileTravelRadius" type="number" min="0" step="1" value="${profile?.travel_radius_km??""}"></div>` : ""}
    ${isPro ? `<div class="field"><label>${esc(t("card.priceFrom"))} (€)</label><input id="profilePriceFrom" type="number" min="0" step="1" value="${profile?.price_from_cents ? Number(profile.price_from_cents)/100 : ""}" placeholder="Ex. 200"></div>
    <div class="field"><label>${esc(t("account.priceHalfDayLabel"))} (€)</label><input id="profilePriceHalf" type="number" min="0" step="1" value="${profile?.price_half_day_cents ? Number(profile.price_half_day_cents)/100 : ""}"></div>
    <div class="field"><label>${esc(t("account.priceHourLabel"))} (€)</label><input id="profilePriceHour" type="number" min="0" step="1" value="${profile?.price_hour_cents ? Number(profile.price_hour_cents)/100 : ""}"></div>
    <div class="field"><label>${esc(t("account.travelFeeLabel"))} (€)</label><input id="profileTravelFee" type="number" min="0" step="1" value="${profile?.travel_fee_cents ? Number(profile.travel_fee_cents)/100 : ""}"></div>` : ""}
    <div class="field"><label>${esc(t("boatDetail.description"))}</label><textarea id="profileBio" rows="4">${esc(profile?.bio||"")}</textarea></div>
    ${needsDiploma ? `<div class="field"><label>${esc(t("account.diplomaLabel"))}</label>
      ${profile?.diploma_url ? `<div class="muted" style="margin-bottom:6px"><a href="${esc(profile.diploma_url)}" target="_blank">${esc(t("account.diplomaCurrent"))}</a></div>` : ""}
      <input id="profileDiplomaInput" type="file" accept="image/*,.pdf">
      <div class="muted" style="margin-top:4px;font-size:12.5px">${esc(t("account.diplomaNote"))}</div>
    </div>
    <div class="field"><label>${esc(t("account.diplomaTypeLabel"))}</label><input id="profileDiplomaType" placeholder="${esc(t("account.diplomaTypePlaceholder"))}" value="${esc(profile?.diploma_type||"")}"></div>` : ""}
    ${["skipper","provider"].includes(profile?.role) ? `<div class="field"><label>${esc(t("account.siretLabel"))}</label><input id="profileSiret" value="${esc(profile?.siret||"")}"></div>
    <div class="field"><label>${esc(t("account.insuranceLabel"))}</label><input id="profileInsurance" placeholder="${esc(t("account.insurancePlaceholder"))}" value="${esc(profile?.insurance_info||"")}"></div>` : ""}
    ${showPayout ? `<div class="note-box"><p>${esc(t("dash.payoutSetupNote"))}</p><button class="small-btn" type="button" id="profilePayoutLink">${esc(t("dash.managePayoutDetails"))}</button></div>` : ""}
    <div class="note-box" style="margin-top:14px">
      <strong>${esc(saleText("Sécurité du compte","Account security","Seguridad de la cuenta"))}</strong>
      <div class="field" style="margin-top:10px"><label>${esc(saleText("Nouveau mot de passe","New password","Nueva contraseña"))}</label><input id="profileNewPassword" type="password" minlength="8" placeholder="${esc(saleText("8 caractères minimum","At least 8 characters","Mínimo 8 caracteres"))}"></div>
      <div class="field"><label>${esc(saleText("Confirmer le mot de passe","Confirm password","Confirmar contraseña"))}</label><input id="profileNewPasswordConfirm" type="password" minlength="8"></div>
      <button class="small-btn" type="button" id="changePasswordBtn">${esc(saleText("Changer mon mot de passe","Change my password","Cambiar mi contraseña"))}</button>
      <p class="ok-text" id="changePasswordMsg"></p>
    </div>
    <button class="primary wide" id="saveProfileBtn">${esc(t("dash.saveSettings"))}</button>
    <p class="ok-text" id="profileMsg"></p>`;
}
let profilePortSearchTimer;
function bindProfilePortAutocomplete(){
  const input = document.querySelector("#profilePort");
  const box = document.querySelector("#profilePortSuggestions");
  if(!input || !box || input.dataset.bound) return;
  input.dataset.bound = "1";
  const render = (items)=>{
    box.innerHTML = items.map((x,i)=>`<button type="button" class="port-option" data-i="${i}"><strong>${esc(x.name)}</strong><small>${esc(x.place)}</small></button>`).join("");
    box.classList.toggle("open", items.length>0);
    [...box.querySelectorAll(".port-option")].forEach((btn,i)=>btn.onclick=()=>{
      input.value = items[i].place && items[i].place !== items[i].name ? `${items[i].name}, ${items[i].place}` : items[i].name;
      box.classList.remove("open");
    });
  };
  const search = async (q)=>{
    const local = localPortMatches(q);
    if(q.length < 3){ render(local); return; }
    try{
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&q=" + encodeURIComponent(q + " port marina");
      const res = await fetch(url,{headers:{"Accept-Language":currentLang}});
      const data = await res.json();
      const remote = data.map(x=>({name:(x.name||x.display_name.split(",")[0]),place:x.display_name}));
      const seen = new Set();
      const merged = [...local, ...remote].filter(x=>{const k=(x.name+"|"+x.place).toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,10);
      render(merged);
    }catch(_e){ render(local); }
  };
  input.addEventListener("focus", ()=>{ if(!input.value) render(POPULAR_PORTS.slice(0,8).map(x=>({name:x[0],place:x[1]}))); });
  input.addEventListener("input", ()=>{ clearTimeout(profilePortSearchTimer); profilePortSearchTimer = setTimeout(()=>search(input.value.trim()),300); });
  document.addEventListener("click", e=>{ if(!e.target.closest("#profilePortSuggestions") && e.target.id!=="profilePort") box.classList.remove("open"); });
}
function bindProfileForm(){
  bindProfilePortAutocomplete();
  document.querySelector("#profilePayoutLink")?.addEventListener("click", ()=>document.querySelector('.dash-side [data-panel="payments"]')?.click());
  document.querySelector("#changePasswordBtn")?.addEventListener("click", async ()=>{
    const pass=document.querySelector("#profileNewPassword")?.value||"";
    const confirmPass=document.querySelector("#profileNewPasswordConfirm")?.value||"";
    const msg=document.querySelector("#changePasswordMsg");
    if(pass.length<8){ msg.style.color="#b42318"; msg.textContent=saleText("Le mot de passe doit contenir au moins 8 caractères.","Password must be at least 8 characters.","La contraseña debe tener al menos 8 caracteres."); return; }
    if(pass!==confirmPass){ msg.style.color="#b42318"; msg.textContent=saleText("Les deux mots de passe ne correspondent pas.","Passwords do not match.","Las contraseñas no coinciden."); return; }
    const btn=document.querySelector("#changePasswordBtn"); btn.disabled=true;
    const {error}=await db.auth.updateUser({password:pass});
    btn.disabled=false;
    msg.style.color=error?"#b42318":"#08794e";
    msg.textContent=error?friendlyError(error):saleText("Mot de passe modifié.","Password changed.","Contraseña modificada.");
    if(!error){ document.querySelector("#profileNewPassword").value=""; document.querySelector("#profileNewPasswordConfirm").value=""; }
  });
  document.querySelector("#saveProfileBtn").addEventListener("click", async ()=>{
    const btn = document.querySelector("#saveProfileBtn");
    const msg = document.querySelector("#profileMsg");
    btn.disabled = true;
    const needsPhoto = ["skipper","provider"].includes(currentProfile?.role);
    const photoFileEarly = document.querySelector("#profilePhotoInput")?.files[0];
    if(needsPhoto && !photoFileEarly && !currentProfile?.profile_photo_url){
      msg.style.color = "#b42318";
      msg.textContent = t("account.photoRequiredError");
      btn.disabled = false;
      return;
    }
    const phoneEarly = document.querySelector("#profilePhone")?.value.trim();
    if(needsPhoto && !phoneEarly){
      msg.style.color = "#b42318";
      msg.textContent = t("account.phoneRequiredError");
      btn.disabled = false;
      return;
    }
    const priceInput = document.querySelector("#profilePriceFrom");
    const patch = {
      full_name: document.querySelector("#profileName").value.trim(),
      home_port: document.querySelector("#profilePort").value.trim(),
      phone: document.querySelector("#profilePhone").value.trim(),
      bio: sanitizeContactInfo(document.querySelector("#profileBio").value.trim())
    };
    const expInput = document.querySelector("#profileExperience");
    if(expInput) patch.experience_years = Number(expInput.value) || null;
    const langInput = document.querySelector("#profileLanguages");
    if(langInput) patch.languages = langInput.value.trim();
    const skillsInput = document.querySelector("#profileSkills");
    if(skillsInput) patch.skills = skillsInput.value.trim();
    const radiusInput = document.querySelector("#profileTravelRadius");
    if(radiusInput) patch.travel_radius_km = Number(radiusInput.value) || null;
    const siretInput = document.querySelector("#profileSiret");
    if(siretInput) patch.siret = siretInput.value.trim();
    const insuranceInput = document.querySelector("#profileInsurance");
    if(insuranceInput) patch.insurance_info = insuranceInput.value.trim();
    const diplomaTypeInput = document.querySelector("#profileDiplomaType");
    if(diplomaTypeInput) patch.diploma_type = diplomaTypeInput.value.trim();
    const priceHalfInput = document.querySelector("#profilePriceHalf");
    if(priceHalfInput){
      const half = Number(priceHalfInput.value);
      patch.price_half_day_cents = Number.isFinite(half) && half > 0 ? Math.round(half*100) : null;
    }
    const priceHourInput = document.querySelector("#profilePriceHour");
    if(priceHourInput){
      const hour = Number(priceHourInput.value);
      patch.price_hour_cents = Number.isFinite(hour) && hour > 0 ? Math.round(hour*100) : null;
    }
    const travelFeeInput = document.querySelector("#profileTravelFee");
    if(travelFeeInput){
      const fee = Number(travelFeeInput.value);
      patch.travel_fee_cents = Number.isFinite(fee) && fee > 0 ? Math.round(fee*100) : null;
    }
    const photoFile = document.querySelector("#profilePhotoInput")?.files[0];
    if(photoFile){
      const path = `${currentUser.id}/avatar-${Date.now()}-${photoFile.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
      const {error: upErr} = await db.storage.from("mission-photos").upload(path, photoFile);
      if(upErr){ msg.style.color = "#b42318"; msg.textContent = friendlyError(upErr); btn.disabled = false; return; }
      patch.profile_photo_url = db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl;
    }
    const diplomaFile = document.querySelector("#profileDiplomaInput")?.files[0];
    if(diplomaFile){
      const path = `${currentUser.id}/diploma-${Date.now()}-${diplomaFile.name.replace(/[^a-zA-Z0-9.\-_]/g,"_")}`;
      const {error: upErr} = await db.storage.from("mission-photos").upload(path, diplomaFile);
      if(upErr){ msg.style.color = "#b42318"; msg.textContent = friendlyError(upErr); btn.disabled = false; return; }
      patch.diploma_url = db.storage.from("mission-photos").getPublicUrl(path).data.publicUrl;
    }
    if(priceInput){
      const euros = Number(priceInput.value);
      patch.price_from_cents = Number.isFinite(euros) && euros > 0 ? Math.round(euros*100) : null;
    }
    const {error} = await db.from("profiles").update(patch).eq("id", currentUser.id);
    if(error){ msg.style.color = "#b42318"; msg.textContent = friendlyError(error); btn.disabled = false; return; }
    await loadProfile();
    refreshDashboardIdentity("profile");
    msg.style.color = "#08794e";
    msg.textContent = t("action.savedSuccess");
    btn.disabled = false;
  });
}

function refreshDynamicTexts(){
  const heading = document.querySelector("#resultsHeading");
  const sub = document.querySelector("#resultsSub");
  const cfg = TAB_CONFIG[activeActivity] || TAB_CONFIG.skipper;
  if(heading) heading.textContent = t(cfg.headingKey);
  if(sub) sub.textContent = t(cfg.subKey);
  updateSeoMeta();
  loadListings();
  renderHomeBoatStrip();
  refreshAccountButton();
}

const FAQ_ENTRIES = [
  {keywords:["prix","tarif","coût","cout","combien"], answerKey:"faq.price"},
  {keywords:["réserv","reserv","booking","comment ça marche","comment ca marche"], answerKey:"faq.booking"},
  {keywords:["annul","cancel"], answerKey:"faq.cancel"},
  {keywords:["rembours","refund"], answerKey:"faq.refund"},
  {keywords:["skipper","devenir","inscri","join","prestataire"], answerKey:"faq.become"},
  {keywords:["paiement","payer","pay","sécuri","securi","stripe"], answerKey:"faq.payment"},
  {keywords:["contact","support","aide","help","humain"], answerKey:"faq.contact"}
];
const FAQ_CHIPS = ["faq.price","faq.booking","faq.become","faq.contact"];

function faqAppendMessage(text, who){
  const box = document.querySelector("#faqMessages");
  const bubble = document.createElement("div");
  bubble.style.cssText = `align-self:${who==="user"?"flex-end":"flex-start"};max-width:85%;padding:9px 12px;border-radius:13px;font-size:14px;line-height:1.4;background:${who==="user"?"var(--navy)":"var(--mist)"};color:${who==="user"?"#fff":"var(--ink)"}`;
  bubble.textContent = text;
  box.appendChild(bubble);
  box.scrollTop = box.scrollHeight;
}
function faqAnswerFor(message){
  const lower = message.toLowerCase();
  const hit = FAQ_ENTRIES.find(e => e.keywords.some(k => lower.includes(k)));
  return t(hit ? hit.answerKey : "faq.fallback");
}
function faqRenderChips(){
  const chipsBox = document.querySelector("#faqChips");
  chipsBox.innerHTML = FAQ_CHIPS.map(k=>`<button type="button" class="tag" style="cursor:pointer;border:1px solid var(--line)" data-faq-chip="${k}">${esc(t(k+"Chip"))}</button>`).join("");
  chipsBox.querySelectorAll("[data-faq-chip]").forEach(btn=>btn.addEventListener("click", ()=>{
    const question = btn.textContent;
    faqAppendMessage(question, "user");
    faqAppendMessage(t(btn.dataset.faqChip), "bot");
  }));
}
function initFaqBot(){
  const toggle = document.querySelector("#faqToggle");
  const panel = document.querySelector("#faqPanel");
  const closeBtn = document.querySelector("#faqClose");
  const sendBtn = document.querySelector("#faqSend");
  const input = document.querySelector("#faqInput");
  let opened = false;
  toggle.addEventListener("click", ()=>{
    opened = !opened;
    panel.style.display = opened ? "flex" : "none";
    if(opened && !document.querySelector("#faqMessages").childElementCount){
      faqAppendMessage(t("faq.greeting"), "bot");
      faqRenderChips();
    }
  });
  closeBtn.addEventListener("click", ()=>{ opened = false; panel.style.display = "none"; });
  function send(){
    const value = input.value.trim();
    if(!value) return;
    faqAppendMessage(value, "user");
    input.value = "";
    setTimeout(()=>faqAppendMessage(faqAnswerFor(value), "bot"), 250);
  }
  sendBtn.addEventListener("click", send);
  input.addEventListener("keydown", e=>{ if(e.key === "Enter") send(); });
}

let heroCarouselTimer = null;
function startHeroCarousel(){
  if(heroCarouselTimer) clearInterval(heroCarouselTimer);
  const slides = [...document.querySelectorAll(".hero-bg")];
  if(slides.length < 2) return;
  let index = slides.findIndex(s=>s.classList.contains("active"));
  if(index < 0) index = 0;
  heroCarouselTimer = setInterval(()=>{
    slides[index].classList.remove("active");
    index = (index + 1) % slides.length;
    loadDeferredBackground(slides[index]);
    slides[index].classList.add("active");
  }, 2500);
}
async function loadHeroSlides(){
  const container = document.querySelector("#heroBgContainer");
  if(!container) return;
  const {data, error} = await db.from("hero_slides").select("*").eq("active", true).order("order_index",{ascending:true});
  if(error || !data || !data.length) return;
  container.innerHTML = data.map((s,i)=>`<div class="hero-bg${i===0?" active":""}" ${i===0?`style="background-image:url('${esc(s.image_url)}')"`:`data-bg="${esc(s.image_url)}"`} ${s.alt_text?`role="img" aria-label="${esc(s.alt_text)}"`:""}></div>`).join("");
  startHeroCarousel();
}
async function loadDestinationTiles(){
  const row = document.querySelector("#portTileRow");
  if(!row) return;
  const {data, error} = await db.from("destination_tiles").select("*").eq("active", true).order("order_index",{ascending:true});
  const tiles = (data && !error) ? data : [];
  if(!tiles.length) return;
  row.innerHTML = tiles.map(tl=>`<button type="button" class="tile-scroll-card" data-port="${esc(tl.name)}" style="background-image:url('${esc(tl.image_url)}')"><span>${esc(tl.name)}</span></button>`).join("");
  row.querySelectorAll(".tile-scroll-card").forEach(tile=>{
    tile.addEventListener("click", ()=>{ openBoatFinder(tile.dataset.port); highlightPortActivities(tile.dataset.port); });
  });
  autoScrollTileRow("portTileRow");
}
const activityPhotoCredits = {
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg/960px-Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg": {
    "id": "11af0976-748e-4f7b-b441-9db7dd5caa98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/7/78/Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg/960px-Mediterranean_coast_-_Eze%2C_France_-_panoramio.jpg",
    "file": "Mediterranean coast - Eze, France - panoramio.jpg",
    "author": "Sergey Ashmarin",
    "caption": "La côte vue depuis Èze",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Sainte-Marguerite_%28south_coast%29.jpg/960px-Sainte-Marguerite_%28south_coast%29.jpg": {
    "id": "2b07c1d2-3c49-4f78-9f7a-bf01bdf16a98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/6/6a/Sainte-Marguerite_%28south_coast%29.jpg/960px-Sainte-Marguerite_%28south_coast%29.jpg",
    "file": "Sainte-Marguerite (south coast).jpg",
    "author": "Tangopaso",
    "caption": "Littoral de l’île Sainte-Marguerite",
    "license": "Domaine public",
    "licenseUrl": "https://commons.wikimedia.org/wiki/File:Sainte-Marguerite_(south_coast).jpg"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Baie_de_Juan_Les_Pins.jpg/960px-Baie_de_Juan_Les_Pins.jpg": {
    "id": "6f4f8a9b-842e-4714-a849-eb63714e1c73",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Baie_de_Juan_Les_Pins.jpg/960px-Baie_de_Juan_Les_Pins.jpg",
    "file": "Baie de Juan Les Pins.jpg",
    "author": "Frederic Parizot",
    "caption": "Coucher de soleil sur la baie de Juan-les-Pins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Juan-les-Pins.jpg/960px-Juan-les-Pins.jpg": {
    "id": "078e3a2d-f8e8-4825-8bb6-a077225876f3",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/d/dc/Juan-les-Pins.jpg/960px-Juan-les-Pins.jpg",
    "file": "Juan-les-Pins.jpg",
    "author": "JaayJay",
    "caption": "Plage et baie de Juan-les-Pins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0/"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Plage_Mala_%C3%A0_Cap_d%27ail.jpg/960px-Plage_Mala_%C3%A0_Cap_d%27ail.jpg": {
    "id": "11af0976-748e-4f7b-b441-9db7dd5caa98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b1/Plage_Mala_%C3%A0_Cap_d%27ail.jpg/960px-Plage_Mala_%C3%A0_Cap_d%27ail.jpg",
    "file": "Plage Mala à Cap d'ail.jpg",
    "author": "Jon Mountjoy",
    "caption": "Plage Mala, entre Monaco et Èze",
    "license": "CC BY 2.0",
    "licenseUrl": "https://creativecommons.org/licenses/by/2.0"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Baie_des_milliardaires_2.JPG/960px-Baie_des_milliardaires_2.JPG": {
    "id": "078e3a2d-f8e8-4825-8bb6-a077225876f3",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/4/42/Baie_des_milliardaires_2.JPG/960px-Baie_des_milliardaires_2.JPG",
    "file": "Baie des milliardaires 2.JPG",
    "author": "Abxbay",
    "caption": "Crique de la baie des Milliardaires, cap d’Antibes",
    "license": "CC BY-SA 4.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0"
  },
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG/960px-Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG": {
    "id": "2b07c1d2-3c49-4f78-9f7a-bf01bdf16a98",
    "url": "https://thumb.wikimedia.org/wikipedia/commons/thumb/5/5a/Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG/960px-Sud-est_%C3%AEle_Saint-Honorat_%282014%29.JPG",
    "file": "Sud-est île Saint-Honorat (2014).JPG",
    "author": "Florian Pépellin",
    "caption": "Eaux claires de Saint-Honorat, îles de Lérins",
    "license": "CC BY-SA 3.0",
    "licenseUrl": "https://creativecommons.org/licenses/by-sa/3.0"
  }
};
function activityPhotoCreditHtml(url){
  const p = activityPhotoCredits[url];
  if(!p) return "";
  return `<small class="activity-photo-credit" style="display:block;font-size:11px;line-height:1.45;color:var(--muted);margin:0 0 10px">${esc(p.caption)} · <a href="https://commons.wikimedia.org/wiki/File:${encodeURIComponent(p.file)}" target="_blank" rel="noopener noreferrer">${esc(p.author)}</a> · <a href="${esc(p.licenseUrl)}" target="_blank" rel="noopener noreferrer">${esc(p.license)}</a> · recadrage</small>`;
}
let portActivitiesCache = [];
async function loadPortActivities(){
  const row = document.querySelector("#activityRow");
  if(!row) return;
  const {data, error} = await db.from("port_activities").select("*").eq("active", true).order("order_index",{ascending:true});
  portActivitiesCache = (data && !error) ? data : [];
  renderPortActivities();
}
function renderPortActivities(highlightPort){
  const row = document.querySelector("#activityRow");
  if(!row) return;
  if(!portActivitiesCache.length){ document.querySelector("#activityRow").closest("section").style.display = "none"; return; }
  let list = portActivitiesCache;
  const badge = document.querySelector("#activityFilterBadge");
  const label = document.querySelector("#activityFilterLabel");
  if(highlightPort){
    const matches = portActivitiesCache.filter(a=>a.port_name.toLowerCase() === highlightPort.toLowerCase());
    const others = portActivitiesCache.filter(a=>a.port_name.toLowerCase() !== highlightPort.toLowerCase());
    list = matches.concat(others);
    if(matches.length){ badge.style.display = "inline-flex"; label.textContent = `${t("activities.filterShowing")} ${highlightPort}`; }
    else badge.style.display = "none";
  }else{
    badge.style.display = "none";
  }
  row.innerHTML = list.map(a=>`<article class="activity-card" data-activity-port="${esc(a.port_name)}">
    <div class="activity-card-photo" style="background-image:url('${esc(a.image_url)}')"><span class="activity-card-port">${esc(a.port_name)}</span></div>
    <div class="activity-card-body">
      ${activityPhotoCreditHtml(a.image_url)}
      <h3>${esc(a.title)}</h3>
      ${a.description ? `<p>${esc(a.description)}</p>` : ""}
      <div class="activity-card-cta">${esc(t("activities.reserve"))}</div>
    </div>
  </article>`).join("");
  row.querySelectorAll(".activity-card").forEach(card=>{
    card.addEventListener("click", (event)=>{ if(!event.target.closest("a")) openBoatFinder(card.dataset.activityPort); });
  });
}
function highlightPortActivities(port){
  renderPortActivities(port);
  document.querySelector("#activityRow")?.scrollTo({left:0, behavior:"smooth"});
}
document.querySelector("#activityFilterClear")?.addEventListener("click", ()=>renderPortActivities());

function slugifyPort(name){
  return (name||"").toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
}
function nmDistance(lat1, lng1, lat2, lng2){
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2-lat1), dLng = toRad(lng2-lng1);
  const avgLatCos = Math.cos(toRad((lat1+lat2)/2));
  const latNm = dLat * 3440.065;
  const lngNm = dLng * avgLatCos * 3440.065;
  return Math.sqrt(latNm*latNm + lngNm*lngNm);
}
function ddToDms(deg, isLat){
  const dir = isLat ? (deg>=0?"N":"S") : (deg>=0?"E":"W");
  const abs = Math.abs(deg);
  const d = Math.floor(abs);
  const mFull = (abs-d)*60;
  const m = Math.floor(mFull);
  const s = Math.round((mFull-m)*60);
  return `${d}°${String(m).padStart(2,"0")}'${String(s).padStart(2,"0")}"${dir}`;
}
async function loadLogbook(){
  const section = document.querySelector("#logbookSection");
  if(!section) return;
  const {data, error} = await db.from("ports").select("*").eq("active", true).order("order_index",{ascending:true});
  const ports = (data && !error) ? data : [];
  if(!ports.length){ section.style.display = "none"; return; }
  const strip = document.querySelector("#logbookStrip");
  const totalEl = document.querySelector("#logbookTotal");
  let totalNm = 0;
  let html = "";
  ports.forEach((p, i)=>{
    html += `<div class="logbook-port">
      <div class="logbook-port-index">Port ${String(i+1).padStart(2,"0")}</div>
      <div class="logbook-port-name">${esc(p.name)}</div>
      <div class="logbook-port-coords">${ddToDms(p.lat,true)} ${ddToDms(p.lng,false)}</div>
      ${p.description ? `<p class="logbook-port-desc">${esc(p.description)}</p>` : ""}
      <a class="logbook-port-link" href="/skipper-${slugifyPort(p.name)}/">${esc(t("logbook.seeSkippers"))}</a>
    </div>`;
    if(i < ports.length-1){
      const next = ports[i+1];
      const leg = nmDistance(p.lat, p.lng, next.lat, next.lng);
      totalNm += leg;
      html += `<div class="logbook-leg"><div class="logbook-leg-line"></div><div class="logbook-leg-nm">${Math.round(leg)}&nbsp;${esc(t("logbook.nm"))}</div></div>`;
    }
  });
  strip.innerHTML = html;
  totalEl.textContent = `~${Math.round(totalNm)}\u00A0${t("logbook.nm").toUpperCase()} · ${ports[0].name.toUpperCase()} → ${ports[ports.length-1].name.toUpperCase()}`;
}

(async function init(){
  applyStaticTranslations();
  observeDeferredBackgrounds();
  startHeroCarousel();
  initFaqBot();
  const params = new URLSearchParams(location.search);
  const urlPort = params.get("port");
  const urlActivity = params.get("activity");
  if(urlPort) portInput.value = urlPort;
  if(urlActivity && TAB_CONFIG[urlActivity]){
    activeActivity = urlActivity;
    document.querySelectorAll("#listingTabs button").forEach(b=>b.classList.toggle("active", b.dataset.activity===urlActivity));
  }
  if(urlActivity === "skipper"){
    showProviderResults("skipper");
    openModal("providerModal");
  }
  if(urlActivity === "boat_rental"){ openBoatFinder(urlPort||""); }
  if(urlActivity === "boat_sale"){ openBoatSaleFinder(urlPort||""); }
  if(urlActivity === "excursion"){ openExcursionFinder(urlPort||""); }
  const urlJoin = params.get("join");
  if(urlJoin === "owner" || urlJoin === "skipper" || urlJoin === "provider"){ openAccountModal("create", urlJoin); }
  updateSeoMeta();
  const {data:{session}} = await db.auth.getSession();
  currentUser = session?.user || null;
  if(currentUser) await loadProfile();
  refreshAccountButton();
  await resumePaymentReturn();
  const urlPro = params.get("pro");
  if(urlPro) openDirectRequest(urlPro);
  const loadHomeContent = ()=>Promise.all([
    preloadHomeBoats(), preloadHomeProviders(), loadListings(), loadTrustStats(),
    loadLogbook(), loadHeroSlides(), loadDestinationTiles(), loadPortActivities()
  ]).catch(error=>console.warn("SkipperNow home content:",error));
  const needsImmediateContent = Boolean(urlPort || urlActivity || urlPro);
  if(needsImmediateContent) await loadHomeContent();
  else setTimeout(loadHomeContent, 500);
  if(currentUser && sessionStorage.getItem("skippernow-quick-request")) openQuickRequest();
})();

db.auth.onAuthStateChange(async (event, session)=>{
  if(event === "SIGNED_OUT"){ currentUser = null; currentProfile = null; refreshAccountButton(); return; }
  if(event === "PASSWORD_RECOVERY"){
    currentUser = session?.user || currentUser;
    document.querySelector("#recoveryMessage").textContent="";
    document.querySelector("#recoveryPassword").value="";
    document.querySelector("#recoveryPasswordConfirm").value="";
    openModal("passwordRecoveryModal");
    return;
  }
  if(session?.user){
    currentUser = session.user;
    await loadProfile();
    refreshAccountButton();
    if(event === "SIGNED_IN" && new URLSearchParams(location.search).has("payment_mission")) setTimeout(()=>resumePaymentReturn(),0);
    const urlPro = new URLSearchParams(location.search).get("pro");
    if(urlPro) openDirectRequest(urlPro);
  }
});


/* Documentation NUC — uploads privately stored; server validation is authoritative. */
const nucDocKinds={registration:"Enregistrement / immatriculation",navigation_permit:"Permis de navigation NUC",armament_permit:"Permis d'armement (si applicable)",commercial_insurance:"Assurance commerciale",captain_certificate:"Titre professionnel du capitaine",safety_certificate:"Documents de sécurité",other:"Autre justificatif"};
function nucStatus(st){return ({pending:"À examiner",approved:"Validé",rejected:"Refusé",expired:"Expiré"})[st]||st;}
async function renderNucOwnerPanel(main){
 if(!currentUser)return;
 const [{data:ex,error:err},{data:docs,error:derr}]=await Promise.all([
  db.from("excursions").select("id,title,port,active,compliance_status,compliance_rejection_reason").eq("provider_id",currentUser.id).order("created_at",{ascending:false}),
  db.from("excursion_compliance_documents").select("*").eq("owner_id",currentUser.id).order("created_at",{ascending:false})
 ]);
 if(err||derr){main.textContent=(err||derr).message;return;}
 const rows=ex||[], files=docs||[];
 main.innerHTML='<h3>⚓ Documents et contrôle des excursions</h3><p class="muted">Les sorties commerciales ne peuvent être proposées avant validation. Les documents sont privés. Pour les activités hors régime NUC, contactez SkipperNow afin de vérifier le régime local applicable.</p>'+
 (rows.length?rows.map(e=>'<div class="request-card"><strong>'+esc(e.title)+'</strong> · '+esc(e.port||'')+' · '+esc(nucStatus(e.compliance_status))+(e.compliance_rejection_reason?'<p>'+esc(e.compliance_rejection_reason)+'</p>':'')+'<div style="font-size:13px;margin:8px 0">Publication : '+(e.active?'Active':'Non publiée')+'</div>'+files.filter(d=>d.excursion_id===e.id).map(d=>'<div style="padding:5px 0">'+esc(nucDocKinds[d.document_type])+' — '+esc(nucStatus(d.review_status))+(d.expires_on?' · expire le '+esc(d.expires_on):'')+'</div>').join('')+'<form data-nuc-upload="'+esc(e.id)+'" style="margin-top:12px"><label>Type de document</label><select name="kind">'+Object.entries(nucDocKinds).map(([k,v])=>'<option value="'+k+'">'+esc(v)+'</option>').join('')+'</select><label>Date de fin de validité (si indiquée)</label><input name="expiry" type="date"><label>Justificatif PDF ou image (10 Mo max.)</label><input name="document" type="file" accept=".pdf,image/jpeg,image/png,image/webp" required><button type="submit" class="small-btn fill" style="margin-top:8px">Envoyer pour contrôle</button><p class="muted" data-upload-msg></p></form></div>').join(''):'<p class="empty-note">Créez d’abord une excursion dans « Mes excursions » pour transmettre les pièces justificatives.</p>');
 main.querySelectorAll('[data-nuc-upload]').forEach(form=>form.addEventListener('submit',async ev=>{
  ev.preventDefault();const msg=form.querySelector('[data-upload-msg]');const btn=form.querySelector('button[type=submit]');const f=form.elements.document.files[0];
  if(!f||f.size>10485760||!['application/pdf','image/jpeg','image/png','image/webp'].includes(f.type)){msg.textContent='Fichier PDF ou image, 10 Mo maximum.';return;}
  btn.disabled=true;msg.textContent='Envoi en cours…';
  const excId=form.dataset.nucUpload;
  const safe=f.name.replace(/[^a-z0-9._-]/gi,'_');
  const path=currentUser.id+'/'+excId+'/'+crypto.randomUUID()+'-'+safe;
  const up=await db.storage.from('excursion-compliance').upload(path,f,{contentType:f.type});
  if(up.error){msg.textContent=up.error.message;btn.disabled=false;return;}
  const insert=await db.from('excursion_compliance_documents').insert({excursion_id:excId,owner_id:currentUser.id,document_type:form.elements.kind.value,storage_path:path,expires_on:form.elements.expiry.value||null});
  if(insert.error){await db.storage.from('excursion-compliance').remove([path]);msg.textContent=insert.error.message;btn.disabled=false;return;}
  await renderNucOwnerPanel(main);
 }));
}
async function renderNucAdminPanel(main){
 const [{data:ex,error:err},{data:docs,error:derr}]=await Promise.all([
 db.from('excursions').select('id,title,port,provider_id,active,compliance_status,compliance_rejection_reason').order('created_at',{ascending:false}),
 db.from('excursion_compliance_documents').select('*').order('created_at',{ascending:false})
 ]);
 if(err||derr){main.textContent=(err||derr).message;return;}
 const rows=ex||[], files=docs||[];
 main.innerHTML='<h3>⚓ Vérification des excursions</h3><p class="muted">Contrôler la validité des documents, les qualifications et le régime juridique applicable avant validation. Ce contrôle interne ne remplace pas une autorisation maritime.</p>'+
 (rows.length?rows.map(e=>'<div class="request-card"><h4>'+esc(e.title)+' — '+esc(e.port||'')+'</h4><p>'+esc(nucStatus(e.compliance_status))+' · '+(e.active?'Publiée':'Non publiée')+'</p>'+files.filter(d=>d.excursion_id===e.id).map(d=>'<div style="border-top:1px solid #ddd;padding:8px 0"><strong>'+esc(nucDocKinds[d.document_type])+'</strong> · '+esc(nucStatus(d.review_status))+(d.expires_on?' · '+esc(d.expires_on):'')+' <button class="small-btn" type="button" data-nuc-view="'+esc(d.id)+'">Consulter</button> <button class="small-btn" type="button" data-nuc-doc="'+esc(d.id)+'" data-nuc-status="approved">Accepter</button> <button class="small-btn" type="button" data-nuc-doc="'+esc(d.id)+'" data-nuc-status="rejected">Refuser</button></div>').join('')+'<p><button type="button" class="small-btn fill" data-nuc-exc="'+esc(e.id)+'" data-nuc-decision="approved">Valider l’excursion</button> <button type="button" class="small-btn" data-nuc-exc="'+esc(e.id)+'" data-nuc-decision="rejected">Refuser / suspendre</button></p></div>').join(''):'<p class="empty-note">Aucune excursion à vérifier.</p>');
 main.querySelectorAll('[data-nuc-view]').forEach(btn=>btn.addEventListener('click',async()=>{const d=files.find(x=>x.id===btn.dataset.nucView);if(!d)return;const {data,error}=await db.storage.from('excursion-compliance').createSignedUrl(d.storage_path,60);if(error)return alert(error.message);window.open(data.signedUrl,'_blank','noopener,noreferrer');}));
 main.querySelectorAll('[data-nuc-doc]').forEach(btn=>btn.addEventListener('click',async()=>{const decision=btn.dataset.nucStatus;const reason=decision==='rejected'?prompt('Motif du refus (obligatoire)'):null;if(decision==='rejected'&&!reason?.trim())return;const {error}=await db.from('excursion_compliance_documents').update({review_status:decision,checked_by:currentUser.id,checked_at:new Date().toISOString(),rejection_reason:reason||null}).eq('id',btn.dataset.nucDoc);if(error)alert(error.message);else await renderNucAdminPanel(main);}));
 main.querySelectorAll('[data-nuc-exc]').forEach(btn=>btn.addEventListener('click',async()=>{const decision=btn.dataset.nucDecision;const reason=decision==='rejected'?prompt('Motif du refus / suspension (obligatoire)'):null;if(decision==='rejected'&&!reason?.trim())return;const changes={compliance_status:decision,compliance_reviewed_by:currentUser.id,compliance_reviewed_at:new Date().toISOString(),compliance_rejection_reason:reason||null,active:false};const {error}=await db.from('excursions').update(changes).eq('id',btn.dataset.nucExc);if(error)alert(error.message);else await renderNucAdminPanel(main);}));
}
