# Tester LOC CONNECT sur Windows

Cette procédure lance la branche de la PR nº 5 sur votre ordinateur, avec une base de démonstration locale distincte. Prérequis : Git, Node.js 22 ou plus et Docker Desktop démarré.

Dans PowerShell, depuis un dossier où créer le projet :

```powershell
git clone --branch codex/fiabiliser-parcours-location --single-branch https://github.com/thomasdankou-beep/LOC-CONNECT.git LOC-CONNECT-test
cd LOC-CONNECT-test
Copy-Item .env.example .env
docker compose -p locconnect-test up -d db
npm ci
npx prisma generate
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Ouvrir ensuite http://localhost:3000 dans le navigateur. Les valeurs de `.env.example` conviennent uniquement à cette démonstration locale en mode développement ; elles doivent être remplacées avant toute mise en production.

Le projet Docker `locconnect-test` utilise son propre volume de base de données. Ne remplacez pas `DATABASE_URL` par celle d'un serveur en exploitation. Le chargement de démonstration sans `--force` s'arrête si des utilisateurs existent déjà.

## Comptes de démonstration

Mot de passe commun par défaut : `Demo2026!Loc`.

| Rôle | Adresse |
| --- | --- |
| Client | `client01@demo-locconnect.ci` |
| Deuxième client | `client02@demo-locconnect.ci` |
| Loueur | `loueur01@demo-locconnect.ci` |
| Administrateur | `admin@demo-locconnect.ci` |

Les autres loueurs vont de `loueur02` à `loueur16` ; le dernier attend sa validation. Le mode de paiement acompte et espèces est illustré par `loueur02`.

## Premiers parcours à vérifier

1. Se connecter comme client, consulter le panier prérempli ou choisir un article, puis demander une proforma.
2. Payer depuis la proforma, cocher l'acceptation et sélectionner **Simuler un paiement réussi**. Vérifier la réservation et la facture : articles, montants et remise doivent correspondre.
3. Dans **Mes réservations**, demander une modification sur une location débutant dans plus de 24 h. Se connecter au loueur concerné pour la valider. Vérifier le complément ou le remboursement et les dates de livraison.
4. Sur un produit dont tout le stock a été réservé, essayer avec le deuxième client de réserver le jour du retour : la quantité ne doit pas être disponible. Une marge logistique plus longue est configurable dans l'administration.

Tous les paiements de cette version sont simulés. Aucun argent réel n'est prélevé.

Les scénarios détaillés de correction et de migration figurent dans [RECETTE_PARCOURS_LOCATION.md](RECETTE_PARCOURS_LOCATION.md).

## Arrêter la démonstration

Faire `Ctrl+C` dans le terminal qui exécute `npm run dev`, puis :

```powershell
docker compose -p locconnect-test stop db
```

Cela conserve les données locales pour la prochaine session.
