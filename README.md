# SkipperNow V2

## Installation rapide

1. Ouvre `config.js`.
2. Dans Supabase, va dans **Project Settings > API**.
3. Copie le **Project URL** dans `supabaseUrl`.
4. Copie la clé **anon public** dans `supabaseAnonKey`.
5. Dans Supabase SQL Editor, colle et exécute le contenu de `supabase.sql`.
6. Envoie tous les fichiers du dossier sur GitHub.
7. Netlify redéploiera automatiquement le site.

## Inclus dans cette première version

- Création de compte client ou skipper
- Connexion
- Mot de passe oublié
- Recherche par port
- Profils de skippers
- Demande de réservation
- Tableau de bord
- Base Supabase sécurisée pour les réservations

Le paiement Stripe et la messagerie seront ajoutés dans l’étape suivante.


## Version ports du monde

Le champ de port recherche désormais mondialement via OpenStreetMap/Nominatim et propose aussi une liste rapide de grands ports et marinas. Le nom complet sélectionné est enregistré dans les profils et missions.
