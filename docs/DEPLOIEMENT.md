# Déploiement et exploitation

## Variables d'environnement

Voir `.env.example`. Obligatoires en production :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL |
| `AUTH_SECRET` | Signature des sessions (≥ 32 caractères aléatoires) |
| `PAYMENT_WEBHOOK_SECRET` | Signature HMAC des webhooks de paiement |
| `CRON_SECRET` | Jeton de la route des tâches planifiées |
| `APP_URL` | URL publique HTTPS (vérification d'origine, liens des e-mails) |

Générer un secret : `openssl rand -base64 48`. L'application refuse de démarrer en production si un secret contient encore `remplacez-moi` ou `change-me`.

`DEMO_MODE` doit être **vide** en production (il affiche les comptes de démonstration sur la page de connexion). Ne lancez jamais le seed sur une base de production : il efface les données.

## Mise en route

1. Provisionner PostgreSQL 16+ et créer la base.
2. `docker compose up --build -d` (ou `npm ci && npx prisma migrate deploy && npm run build && npm start`).
3. Initialiser la base vide : `npm run db:bootstrap -- --email admin@votre-domaine.ci --password '<mot de passe fort>'` (dans Docker : `docker compose run --rm app npx tsx prisma/bootstrap.ts --email ... --password ...`). La commande crée les permissions, rôles, paramètres et la politique d'annulation par défaut, puis le premier super administrateur. Elle est idempotente. N'utilisez pas `db:seed` en production.
4. Placer un reverse proxy HTTPS (Caddy, Nginx) devant le port 3000. Transmettre `X-Forwarded-For` (utilisé par la limitation de débit) et `Host`.

## Tâches planifiées

Les expirations de HOLD, escalades de modification, règlements automatiques de constats non contestés et envois d'e-mails s'exécutent à la volée lors des visites et via la route dédiée. Pour une exécution régulière indépendante du trafic :

```bash
curl -fsS -X POST https://votre-domaine/api/cron/maintenance -H "Authorization: Bearer $CRON_SECRET"
```

à planifier toutes les 5 minutes (cron système, planificateur de l'hébergeur).

## Sauvegardes

- Base : `pg_dump` quotidien, conservé hors du serveur. Le journal comptable et l'audit sont en base.
- Fichiers : volume `uploads` (ou bucket S3). Les preuves de retour et de livraison sont privées.

## Stockage S3

Renseigner `STORAGE_DRIVER=s3`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. Le bucket ne doit pas être public : les fichiers privés sont servis par l'application après contrôle des droits.

## E-mail

Renseigner `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`. Sans SMTP, les e-mails sont enregistrés en base (canal EMAIL) mais pas envoyés.

## Brancher un vrai opérateur de paiement

1. Implémenter `PaymentProvider` (`services/payments/providers.ts`) : `createCharge` (initie le paiement chez l'opérateur, retourne l'URL de redirection éventuelle) et `verifySignature` (authentifie le webhook de l'opérateur).
2. Enregistrer le fournisseur dans `providers` et définir `PAYMENT_PROVIDER`.
3. Faire pointer le webhook de l'opérateur vers `POST /api/payments/webhook` en respectant le format `WebhookEventPayload`.
4. Le reste (HOLD, répartition par loueur, caution, remboursements, idempotence) ne change pas.

Les **versements** aux loueurs suivent le même principe : `runPayout` (`services/payouts.ts`) enregistre le versement ; un connecteur bancaire ou mobile money s'y insère avant l'écriture de statut `PAID`.

## Contrôles avant ouverture

- [ ] Secrets aléatoires, `DEMO_MODE` vide, `APP_URL` en HTTPS
- [ ] Fournisseur de paiement réel branché et testé en environnement de recette
- [ ] Conditions et politique de confidentialité validées juridiquement
- [ ] Photos réelles des loueurs, coordonnées du support dans `/admin/parametres`
- [ ] Sauvegarde de base testée en restauration
- [ ] Taux de commission et politique d'annulation validés dans l'administration
