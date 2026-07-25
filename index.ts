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

    const callerEmail = String(callerData.user.email || "").toLowerCase();
    if (callerEmail !== "frederytherond@hotmail.com") throw new Error("Accès administrateur refusé.");

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerProfile } = await admin.from("profiles").select("role").eq("id", callerData.user.id).maybeSingle();
    if (String(callerProfile?.role || "").toLowerCase() !== "admin") throw new Error("Rôle administrateur requis.");

    const body = await req.json();
    const userId = String(body?.userId || "");
    if (!userId) throw new Error("Identifiant du profil manquant.");
    if (userId === callerData.user.id) throw new Error("Le compte administrateur ne peut pas être supprimé.");

    // Supprime d’abord les données liées connues. Les erreurs de table absente sont ignorées.
    await admin.from("boat_rental_requests").delete().or(`owner_id.eq.${userId},requester_id.eq.${userId}`);
    await admin.from("boats").delete().eq("client_id", userId);
    await admin.from("missions").delete().or(`client_id.eq.${userId},skipper_id.eq.${userId},provider_id.eq.${userId}`);
    await admin.from("profiles").delete().eq("id", userId);

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) throw authDeleteError;

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
