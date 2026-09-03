# SkipperNow

Plateforme mondiale de mise en relation entre clients (propriétaires ou locataires de bateaux) et professionnels du nautisme : skippers, marins à la journée, prestataires (nettoyage, entretien, services à quai) et loueurs de bateaux.

Site en production : https://skippernow.fr

## Structure du projet

Tout le site (HTML, CSS, JS) est contenu dans **`index.html`** — c'est le seul fichier front-end actif. Il n'y a pas de build step : le fichier est servi tel quel.

```
index.html                              → site complet (front-end)
skippernow-icon.svg                     → icône du site
manifest.webmanifest                    → manifest PWA
CNAME                                   → domaine personnalisé (GitHub Pages)
supabase/functions/delete-user-admin/   → une des Edge Functions (voir ci-dessous)
```

## Hébergement et déploiement

Le site est hébergé sur **GitHub Pages** avec un domaine personnalisé (`skippernow.fr`, configuré via le fichier `CNAME` et les DNS chez Gandi). Tout push sur `main` republie automatiquement le site — il n'y a pas d'étape de build.

## Backend : Supabase

- **URL et clé publique (anon)** sont codées en dur dans `index.html` (lignes ~679-680). C'est normal : la clé publique/anon Supabase est faite pour être exposée côté client, elle est protégée par les policies RLS côté serveur.
- **Tables utilisées** : `profiles`, `boats`, `missions`, `messages`, `conversations`, `payout_details`, `platform_settings`, `skipper_unavailability`, `page_views`.
- **Statistiques visiteurs** : `analytics.js` est chargé sur toutes les pages et appelle la fonction Supabase sécurisée `record_page_visit`. La migration correspondante est versionnée dans `supabase/page-analytics.sql`.
- **Stockage (Storage)** : bucket `mission-photos` pour les preuves de mission.
- **Authentification** : Supabase Auth (email/mot de passe), avec 4 rôles gérés via la colonne `role` de `profiles` (`client`, `skipper`, `provider`, `admin`) et une colonne `provider_activity` pour distinguer skipper/marin à la journée/prestataire de nettoyage au sein du rôle `provider`.

⚠️ **Le schéma SQL complet (tables, policies RLS, triggers) n'est pas encore versionné dans ce repo.** À faire : exporter le schéma depuis Supabase et l'ajouter ici pour pouvoir reconstruire le projet en cas de perte d'accès.

## Edge Functions (paiement Stripe)

Le site appelle 5 Edge Functions Supabase pour les paiements et la modération :

| Fonction appelée               | Rôle                                                    | Versionnée dans ce repo |
|---------------------------------|----------------------------------------------------------|:---:|
| `smooth-function`               | Crée le PaymentIntent Stripe (paiement d'une mission)     | ❌ |
| `clever-processor`               | Confirme le paiement côté serveur après validation Stripe | ❌ |
| `rapid-task`                     | (à documenter)                                            | ❌ |
| `delete-boat-admin`              | Suppression d'un bateau par un administrateur              | ❌ |
| `delete-user-admin`              | Suppression d'un compte par un administrateur               | ✅ `supabase/functions/delete-user-admin/` |

⚠️ **4 des 5 fonctions ne sont pas versionnées ici** — leur code n'existe que dans le tableau de bord Supabase. À corriger en priorité : les récupérer et les ajouter à ce repo pour permettre la revue de code et éviter toute perte en cas de problème sur le projet Supabase.

Les clés secrètes (Stripe secret key, clé `service_role` Supabase) ne doivent **jamais** apparaître dans `index.html` ni dans ce repo : elles restent uniquement dans les variables d'environnement des Edge Functions, côté Supabase.

## Paiement

Le paiement client se fait via **Stripe** (PaymentElement embarqué), avec les fonds conservés jusqu'à validation de la mission par le client, puis versement au professionnel. La clé publiable Stripe (`pk_live_...`) est codée en dur dans `index.html` — c'est attendu, une clé publiable est faite pour être publique.

## Langues

Le site est traduit en français, anglais et espagnol via un objet `I18N` centralisé dans `index.html` (attributs `data-i18n` sur les éléments HTML).

## Ce qui reste à faire (voir audit du repo pour le détail complet)

- Versionner les 4 Edge Functions manquantes.
- Versionner le schéma SQL (tables + policies RLS).
- Ajouter un `sitemap.xml` et un `robots.txt` (le SEO dynamique par port/activité est déjà en place dans le code, mais pas encore exploité par ces fichiers).
- Retirer la vérification par email codé en dur dans `delete-user-admin` au profit d'une vérification par rôle uniquement.
