// Fonction absente de Supabase au moment de l'audit (30/07/2026) alors que index.html
// l'appelle bien via /functions/v1/delete-boat-admin — d'où l'échec silencieux constaté
// par l'utilisateur. Écrite sur le modèle de delete-user-admin, avec vérification du
// rôle admin UNIQUEMENT (pas d'email en dur, contrairement à delete-user-admin).
// Suppression directe de la ligne "boats" : ce schéma n'a pas de table boat_rental_requests
// ni de colonne missions.boat_id (les missions ne référencent qu'un boat_type en texte libre).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Session absente.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) throw new Error("Session invalide.");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerData.user.id).maybeSingle();
    if (String(callerProfile?.role || "").toLowerCase() !== "admin") throw new Error("Rôle administrateur requis.");

    const body = await req.json();
    const boatId = String(body?.boatId || "");
    if (!boatId) throw new Error("Identifiant du bateau manquant.");

    const { error: deleteError } = await admin.from("boats").delete().eq("id", boatId);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ ok: false, error: error instanceof Error ? error.message : "Erreur inconnue" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
