# Architecture

## Vue d'ensemble

```
app/            Pages (App Router), routes API, layouts par espace : (site) (auth) (client) loueur admin
components/     Kit d'interface (ui), gabarits (layout), graphiques
features/       Composants métier côté navigateur, regroupés par domaine
services/       Logique métier : seule couche qui écrit en base, appelée par les pages ET par l'API
lib/            Briques transverses : auth, rbac, env, db, dates, argent, paramètres, audit, stockage, erreurs
prisma/         Schéma, migrations, données système et de démonstration
tests/          Tests d'intégration sur une vraie base PostgreSQL
```

Règle structurante : **les pages serveur et les routes API appellent les mêmes services**. Les contrôles de droits, les transactions et les règles métier vivent dans les services, jamais dans l'interface. Le navigateur n'est jamais source de vérité (prix, commission, caution, disponibilité, statut).

## Modèle de réservation

- Une **réservation** regroupe des **lignes** (`ReservationItem`), chacune liée à **un loueur**. Prix unitaire, sous-total, commission, caution et prix de remboursement sont **figés** sur la ligne à la création.
- Le statut est porté par la **ligne** (DRAFT, HOLD, PENDING_PAYMENT, PAID, CONFIRMED, READY, DELIVERING, DELIVERED, IN_USE, RETURN_PENDING, RETURNED, COMPLETED, CANCELLED, REFUNDED, DISPUTED). Le statut global de la réservation est **calculé** à partir de ses lignes. Un litige ciblé sur un loueur ne change pas le statut des lignes des autres loueurs.
- Toutes les transitions passent par `lib/state-machine.ts` (table de transitions autorisées) et sont historisées (`ReservationStatusHistory`).
- Périodes : intervalle semi-ouvert `[début, fin)` en jours calendaires UTC. Chevauchement : `début demandé < fin existante ET fin demandée > début existante`.

## Disponibilité et concurrence

`stock disponible = stock physique − réservé − HOLD actifs non expirés − blocages`, et 0 si le loueur est indisponible. Le calcul est refait **côté serveur dans une transaction** après un `SELECT … FOR UPDATE` sur les lignes produit concernées (`lockProducts`), ce qui sérialise les réservations concurrentes d'un même produit. Un HOLD expiré ne compte jamais, même si le nettoyage n'a pas encore tourné. Le test `concurrency.test.ts` lance 12 clients simultanés sur 3 unités : exactement 3 réussissent.

## Paiement

`services/payments` : abstraction `PaymentProvider` (création de charge, vérification de signature). Le paiement est confirmé **uniquement par webhook** signé en HMAC-SHA256. Le webhook est idempotent (`WebhookEvent` unique sur `(provider, eventId)`) et verrouille le paiement avant traitement. Un paiement confirmé après expiration du HOLD est remboursé automatiquement. L'écran de simulation passe par le même chemin que le webhook réel.

## Finance

- `FinancialTransaction` : journal comptable **immuable** (jamais mis à jour ni supprimé).
- `PaymentAllocation` : répartition d'un paiement par loueur (location, livraison, commission, part nette, caution).
- `BalanceEntry` : solde par loueur. Une vente devient versable après `payout.freeze_hours` suivant la fin de location ; un litige ou une contestation la **bloque**. Les remboursements créent une écriture négative.
- `LenderReimbursement` : suivi du recouvrement quand un remboursement concerne un loueur déjà versé (compensé sur le prochain versement ou recouvré manuellement).
- Les versements sont nets des déductions ; aucun versement si le solde net est nul ou négatif.

## Paiement en espèces (acompte en ligne + solde au loueur)

Chaque loueur choisit son mode (`Lender.paymentMode`) : `ONLINE_FULL` (tout en ligne) ou `DEPOSIT_CASH`. Le mode espèces exige l'option globale `cash.enabled` et l'autorisation de l'administration (`Lender.cashModeAllowed`).

- **Figé par ligne** : `ReservationItem.paymentMode` et `cashDue` sont fixés à la réservation, comme la commission. Changer de mode n'affecte pas les commandes en cours.
- **Calcul** (`services/pricing.ts`) : pour une ligne en espèces, la part en ligne vaut `min(location, max(commission, cash.min_deposit))` ; le reste (`cashDue`) est réglé au loueur. En mode espèces, la livraison est aussi réglée au loueur (sauf sa commission éventuelle). La caution reste **toujours en ligne**.
- **Facture mixte** : un seul paiement en ligne (`Reservation.total`) couvre les loueurs en ligne en totalité et, pour les loueurs en espèces, l'acompte et la caution. `Reservation.cashTotal` est la somme due en espèces.
- **Solde par loueur** : `CashSettlement` (une ligne par réservation et par loueur) porte le montant dû, la part livraison, un **code de remise** à 4 chiffres visible du client seulement, le nombre d'essais erronés et le statut (`PENDING`, `PAID`, `UNPAID`, `CANCELLED`).
- **Remise** : le loueur saisit le code donné par le client pour confirmer l'encaissement ; sans cela, `IN_USE` (retrait) et `DELIVERED` (livraison) sont refusés (`CASH_NOT_CONFIRMED`). Après `cash.max_code_attempts` codes erronés, la saisie est bloquée jusqu'à l'intervention du support.
- **Impayé** : à partir du premier jour de location, le loueur peut signaler que le client n'a pas payé. Ses lignes sont annulées, la caution est restituée, l'acompte est conservé (la part au-delà de la commission reste au loueur), l'administration est prévenue.
- **Annulation et modification** : seule la part en ligne est remboursée ou complétée ; le solde en espèces est recalculé ou annulé. Une fois le solde payé en espèces, l'annulation et la modification en ligne sont refusées (traitement par le support).
- **Finance** : `PaymentAllocation.cashAmount` trace la part hors paiement ; aucune écriture de solde n'est créée pour l'argent encaissé directement par le loueur.

## Formules des loueurs (Découverte, Pro, Premium)

`services/plans.ts`. `Lender.plan` fixe le taux de commission : Découverte applique `commission.rate_bps` ; Pro et Premium ont un prix mensuel et un taux réduit (`plan.*`). Un taux spécifique du loueur (`commissionRateBps`, offre de lancement) s'applique s'il est plus bas. Le taux reste figé sur chaque ligne de réservation.

- **Changement** : vers une formule plus chère, effet immédiat ; la part non utilisée de la période payée est déduite. Le premier mois de la première formule payante est offert (`plan.first_month_free`). Vers une formule moins chère, effet à l'échéance (`Lender.nextPlan`).
- **Facturation** : le prix de la période est une écriture `SUBSCRIPTION_FEE` négative sur le solde, donc déduite du prochain versement, et une facture d'abonnement (`Invoice` de type `SUBSCRIPTION`, émise par LOC'CONNECT au loueur, sans réservation).
- **Renouvellement** : `renewPlans`, appelé par la maintenance, renouvelle chaque mois au prix en vigueur, applique les changements prévus, et repasse en Découverte un loueur suspendu.
- **Avantages** : badge Pro ou Premium, priorité dans le tri par pertinence du catalogue, produits Premium en page d'accueil après les mises en avant payées.
- **Simulateur** : `simulatePlans` compare le coût des trois formules sur le volume de location des 30 derniers jours (page `/loueur/abonnement`, encart du tableau de bord).
- `plan.self_service` permet de réserver le choix des formules à l'administration (`adminSetPlan` : durée et montant libres, 0 pour offrir).

## Facturation

`services/invoices.ts`. LOC'CONNECT émet les documents **au nom et pour le compte de chaque loueur** (mandat de facturation). Modèle `Invoice` : numéro, type, contenu figé (`data`, JSON), totaux HT, TVA et TTC.

- **Facture de location** : une par loueur, à la confirmation du paiement initial, puis une par complément de modification. Elle porte la location complète (y compris la part payée en espèces), la livraison, la caution à titre d'information (hors facture) et le règlement prévu.
- **Facture de casse et perte** : émise dans `settleReport` quand les montants du constat sont arrêtés (acceptation, délai écoulé, décision). Indemnités hors champ de la TVA. Avant cela, `/factures/constat/:itemId` affiche un constat **provisoire**, sans numéro.
- **Avoir** : réduction d'une facture de location, lors d'une annulation (part remboursée et solde en espèces annulé), d'une baisse par modification, d'un solde en espèces impayé ou d'une décision de litige.
- **Numérotation** : `F-AAAA-NNNNNN` pour les factures, `AV-AAAA-NNNNNN` pour les avoirs, via `InvoiceSequence`, incrémentée dans la transaction d'émission : pas de trou, pas de doublon. `sourceKey` (unique) rend chaque émission idempotente.
- **TVA** : les prix du site sont TTC. Pour un loueur assujetti (`Lender.vatRegistered`), la TVA (`invoice.vat_rate_bps`, 18 %) est extraite du TTC et figée sur la facture.
- **Affichage** : `/factures/:id` (A4, « Télécharger en PDF » via l'impression du navigateur), `/factures/commande/:reservationId` (récapitulatif), listes `/mes-factures`, `/loueur/factures`, `/admin/factures`. La « situation au jour » (paiement, solde en espèces, complément, avoirs) est calculée à l'affichage et ne modifie pas la facture.
- **En-tête** : paramètres `invoice.company_*` (raison sociale, adresse, RCCM, NCC).

## Caution et retour

Une caution par ligne. Son montant dépend du paramètre `deposit.mode` :

- `PERCENT_OF_RENTAL` (par défaut) : `deposit.percent` (30 %) du sous-total de location de la ligne. La somme des lignes d'un loueur donne donc 30 % de son total. Le pourcentage est figé sur `ReservationItem.depositPercent` ; une modification (quantité, dates, ajout d'article) recalcule la caution avec ce même pourcentage.
- Plancher `deposit.min_value_percent` (10 % par défaut, 0 pour le désactiver) : avec la caution en pourcentage, la caution d'une ligne ne descend jamais sous ce pourcentage de la valeur de remplacement (`refundPrice × quantité`). Il est figé sur `ReservationItem.depositFloorPercent`.
- `FIXED_PER_PRODUCT` : caution par unité saisie par le loueur sur le produit (`depositPercent` reste nul).

Le constat de retour impose `retourné + perdu = loué`. La retenue est `min(pertes × prix de remboursement + dommages déclarés, caution)` ; l'excédent n'est facturable que si le produit l'autorise (`allowsExtraBilling`). Sans dommage, la caution est libérée immédiatement ; sinon le client a `return.contest_window_hours` pour contester, passé ce délai le constat est réglé automatiquement. Les photos de preuve sont **privées** : servies par `/api/files/private/…` avec contrôle d'accès.

## Modification

Demandes versionnées (`ModificationRequest` + lignes). Validation obligatoire du loueur sous `modification.lender_response_hours`, sinon escalade à l'administration (relance, acceptation ou refus). Le complément est un paiement distinct (`kind = MODIFICATION`) ; la baisse est remboursée intégralement. Une réservation n'est jamais modifiée avant validation et, si nécessaire, paiement.

## Droits (RBAC)

- Catalogue de permissions (`lib/rbac/permissions.ts`), rôles système et rôles personnalisés par loueur, sous-comptes rattachés à **un seul** loueur. Le propriétaire dispose implicitement des permissions loueur.
- Chaque route et chaque page serveur vérifie : authentification, permission, puis **appartenance** de la ressource (un loueur ne voit que ses lignes, un client que ses commandes).
- Les actions sensibles sont écrites dans `AuditLog` (auteur, date, ancienne et nouvelle valeur, IP).

## Paramètres commerciaux

Tout ce qui n'est pas figé par le cahier des charges est configurable : `lib/settings.ts` déclare chaque paramètre (type, valeur par défaut, groupe, libellé) et l'administration les édite sans redéploiement (`/admin/parametres`). La politique d'annulation (paliers) a son propre éditeur (`/admin/annulation`). La commission est figée à la réservation : changer un taux n'affecte jamais le passé. Le cache de paramètres est partagé via `globalThis` car Next.js compile pages et routes API dans des bundles distincts.

## Sécurité

Mots de passe hachés (bcrypt), sessions révocables en base (JWT dans un cookie HttpOnly), verrouillage après échecs de connexion, protection CSRF par contrôle de l'en-tête `Origin`, limitation de débit (en mémoire, interface prête pour Redis), validation systématique des entrées (Zod), en-têtes HTTP de sécurité, secrets d'exemple refusés en production, téléversements limités par type et taille.

## Interface

Next.js App Router, rendu serveur par défaut, composants client uniquement pour l'interaction. Jetons de design en variables CSS (clair et sombre), échelle d'arrondis unique, icônes Phosphor, police Geist. Les tableaux deviennent des fiches empilées sous 768 px.
