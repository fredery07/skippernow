# Maquette app mobile SkipperNow

Prototype front-end statique (HTML/CSS/JS, sans dépendance ni étape de build) présentant une maquette interactive de l'application mobile SkipperNow.

## Aperçu

Ouvrir `index.html` dans un navigateur. Le prototype simule un téléphone et propose un sélecteur de rôle en haut de page pour explorer les trois parcours :

- **Client** — accueil, recherche (skipper / marin à la journée / prestataire / location de bateau), fiche professionnel, réservation, paiement, suivi de mission, messagerie, profil.
- **Professionnel** (skipper / marin à la journée / prestataire) — missions (demandes, à venir, historique), détail de mission avec actions (accepter/refuser, démarrer, terminer), agenda de disponibilités, revenus & versements, messagerie, profil pro.
- **Administrateur** — tableau de bord (KPIs), gestion des utilisateurs, missions de la plateforme, litiges, réglages (commission, ports actifs, mode maintenance).

Toutes les données affichées sont fictives, à des fins de démonstration uniquement — aucune connexion à Supabase ou à un backend réel.

## Design

L'identité visuelle reprend celle du site en production (`index.html` à la racine du repo `skippernow`) : palette navy / aqua / laiton, typographies Fraunces (titres) et Inter (texte), et le même vocabulaire d'icônes (⚓ skipper, 🧽 prestataire, 👷 marin à la journée, ⛵ location de bateau).

## Structure

```
app-mockup/
  index.html   → maquette complète (HTML + CSS + JS inline, un seul fichier)
  README.md    → ce fichier
```
