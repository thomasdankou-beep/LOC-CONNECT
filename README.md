# LOC'CONNECT

**La plateforme de location qui connecte clients et loueurs.** Marketplace de location de matériel en Côte d'Ivoire (montants en FCFA) : un client commande chez plusieurs loueurs dans un même panier et règle en un seul paiement ; chaque loueur gère ses produits, son stock, ses livraisons, ses retours et ses revenus ; l'administration modère, arbitre et pilote les paramètres commerciaux.

Application complète et fonctionnelle (pas une maquette) : Next.js 16 / React 19 / TypeScript / Tailwind CSS 4, API REST, PostgreSQL 16 + Prisma, authentification et permissions côté serveur.

## Ce qui est fonctionnel

| Domaine | Contenu |
|---|---|
| Catalogue | Catégories et sous-catégories, villes, recherche, filtres, tri, pagination, fiche produit avec calendrier de disponibilité réelle, pages loueur, favoris, avis |
| Réservation | Panier multi-loueurs, **HOLD** de stock à durée configurable, paiement unique réparti par loueur, retrait ou livraison par loueur |
| Paiement | Fournisseur abstrait, webhook signé (HMAC-SHA256), idempotence, paiement tardif remboursé automatiquement. **Fournisseur « simulé » par défaut : aucun argent réel n'est déplacé** |
| Paiement en espèces | Par loueur, sur autorisation de l'administration : **acompte en ligne** (la commission, avec un minimum) et caution en ligne, **solde en espèces** à la remise, confirmé par un **code de remise** donné par le client. Mode figé par ligne, factures mixtes en ligne + espèces, signalement d'impayé, déblocage par le support |
| Facturation | Factures de location (une par loueur), factures de casse et perte, avoirs ; numérotation continue sans trou, TVA 18 % pour les loueurs assujettis, documents A4 imprimables et enregistrables en PDF, listes client, loueur et administration |
| Caution et retour | Caution **en pourcentage de la location de chaque loueur** (30 % par défaut, réglable, avec un minimum en % de la valeur du matériel) ou fixée par produit, figée à la réservation et recalculée en cas de modification ; une caution **par ligne**, constat de retour (retourné / perdu / endommagé, photos privées), fenêtre de contestation, retenue plafonnée, complément de facturation optionnel |
| Annulation et remboursement | Politique par paliers configurable, annulation ligne par ligne, aperçu exact avant confirmation, déduction du solde du loueur ou recouvrement s'il a déjà été versé |
| Modification de réservation | Demande validée par le loueur (réponse sous 2 h par défaut, sinon escalade à l'administration), complément payé séparément, baisse remboursée |
| Litiges | Ciblés sur **un seul loueur**, messages et pièces jointes, arbitrage par l'administration (client, loueur ou partiel) |
| Finance loueur | Gel après la fin de location, montants bloqués en cas de litige, versements nets des déductions, recouvrements, journal de mouvements |
| Espace loueur | Tableau de bord, produits, stock, calendrier et indisponibilités, réservations, livraisons, retours, cautions, revenus, versements, avis, clients, équipe (sous-comptes, rôles et permissions personnalisés), journal d'activité |
| Administration | Tableau de bord, utilisateurs, loueurs (validation, suspension, commission spécifique), modération, catalogue, réservations, paiements, remboursements, commissions, cautions, litiges, versements, recouvrements, abonnements, mises en avant, audit, rôles, **paramètres commerciaux et politique d'annulation configurables** |
| Transverse | Notifications internes et e-mail, journal d'audit, limitation de débit, en-têtes de sécurité, SEO (métadonnées, sitemap, robots, données structurées), accessibilité clavier, thème clair et sombre |

Ce qui n'est **pas** inclus : paiements et versements réels (interface prête, aucun opérateur branché), SMS et WhatsApp, stockage objet géré (le disque local est utilisé par défaut, S3 est prévu), limiteur de débit distribué.

## Démarrage rapide

Prérequis : Node.js 22+, PostgreSQL 16+.

```bash
cp .env.example .env                 # puis adapter DATABASE_URL et générer les secrets
npm install
npx prisma migrate deploy            # crée le schéma
npm run db:seed -- --force           # données de démonstration (efface les données existantes)
npm run dev                          # http://localhost:3000
```

Base de données locale en une commande : `docker compose up -d db`.

### Comptes de démonstration

Mot de passe commun : `Demo2026!Loc` (modifiable via `SEED_DEMO_PASSWORD`). Domaine : `demo-locconnect.ci`.

| Rôle | Identifiants |
|---|---|
| Super administrateur | `admin@demo-locconnect.ci` |
| Admin support, finance, modération, stock | `support@`, `finance@`, `moderation@`, `stock@` |
| Clients | `client01@` à `client12@` |
| Loueurs (propriétaires) | `loueur01@` à `loueur16@` (`loueur16` est en attente de validation) |
| Loueur payé en espèces | `loueur02@` (acompte en ligne + solde en espèces ; `client01` a une réservation mixte à venir) |
| Sous-comptes de `loueur01` | `stock.loueur01@`, `commandes.loueur01@`, `finance.loueur01@`, `livraison.loueur01@`, `retours.loueur01@` |

Les jeux de données contiennent 10 catégories, 20 sous-catégories, 10 villes, 16 loueurs, plus de 50 produits, des réservations à tous les états, des paiements, cautions, livraisons, litiges, avis et un recouvrement.

## Scripts

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests d'intégration (base `DATABASE_URL_TEST`, créée et migrée automatiquement) |
| `npm run db:migrate` | Nouvelle migration en développement |
| `npm run db:deploy` | Applique les migrations (production) |
| `npm run db:seed -- --force` | Recharge les données de démonstration |
| `npm run db:bootstrap -- --email … --password …` | Initialise une base vide de production (données système + premier super administrateur) |
| `npm run docs:api` | Régénère `docs/API.md` depuis le code |

Les tests couvrent la machine à états, la concurrence (12 clients simultanés sur 3 unités), l'idempotence des webhooks, les cautions, l'annulation et le recouvrement, les modifications et leur escalade, les paramètres configurables, la politique d'annulation et le contrôle des droits.

## Déploiement

### Docker

```bash
cp .env.example .env
# Renseigner des secrets aléatoires : AUTH_SECRET, PAYMENT_WEBHOOK_SECRET, CRON_SECRET (openssl rand -base64 48)
# Mettre DEMO_MODE vide et APP_URL à l'adresse publique
docker compose up --build -d
```

Le conteneur applique les migrations au démarrage. En production l'application **refuse de démarrer** si un secret contient encore une valeur d'exemple. Voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) pour le reverse proxy, les tâches planifiées, les sauvegardes, le stockage S3 et le branchement d'un vrai opérateur de paiement.

### Sans Docker

`npm ci && npx prisma migrate deploy && npm run build && npm start`, derrière un reverse proxy HTTPS.

## Documentation

- [`docs/COURS.md`](docs/COURS.md) : **cours pour débutants** sur les langages et outils du projet (TypeScript, React, Tailwind, Next.js, Prisma), avec exercices
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : couches, modèle de données, machine à états, finance, concurrence, sécurité
- [`docs/API.md`](docs/API.md) : les 150 opérations de l'API REST (générée)
- [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md) : mise en production et exploitation

## Notes

- Le dossier `web/` est la **première maquette statique** (données fictives), conservée pour mémoire. Elle est exclue de la compilation et peut être supprimée : `git rm -r web`.
- Les photographies de démonstration proviennent d'Unsplash (licence Unsplash, usage libre). Les remplacer par les photos réelles des loueurs avant la mise en production.
- Les textes juridiques (`/conditions`, `/confidentialite`) décrivent le fonctionnement réel de la plateforme mais doivent être relus par un conseil juridique avant la mise en service commerciale.
