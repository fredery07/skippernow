window.SKIPPERNOW_CONFIG = {
  supabaseUrl: "https://pzvlarwsfvhenrniepkw.supabase.co",
  supabaseAnonKey: "sb_publishable_OxikOn1mhDcxkAVAucN5Lg_za-bJMS5"
};

(function(){
  if(window.__skippernowPartnersLoader) return;
  window.__skippernowPartnersLoader = true;

  const partners = document.createElement("script");
  partners.src = "/partners-v1.js?v=2";
  partners.defer = true;
  document.head.appendChild(partners);

  const layout = document.createElement("script");
  layout.src = "/home-layout-v1.js?v=2";
  layout.defer = true;
  document.head.appendChild(layout);

  const fix = document.createElement("script");
  fix.src = "/partners-fix-v2.js?v=1";
  fix.defer = true;
  document.head.appendChild(fix);
})();
