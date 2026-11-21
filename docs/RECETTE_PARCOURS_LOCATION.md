# Recette des parcours de location

Ce correctif fiabilise les proformas, les conditions acceptées et les reprises de commande, ainsi que les liens entre stock, modifications et livraisons. Il conserve les décisions du cahier V1.4 : délai de modification normal de 24 h, accord du loueur systématique, réponse sous 2 h puis escalade à l'administration.

## Comportements à vérifier

| Parcours | Résultat attendu |
| --- | --- |
| Préparer un retrait, revenir sur une proforma avec livraison, payer | L'ancien HOLD et sa réservation non payée sont annulés ; le nouveau paiement respecte le montant et la livraison de la proforma. |
| Reprendre une commande sans changer ses détails | Même HOLD, même consentement et même réservation ; aucun doublon de paiement. |
| Changer une commande pendant un paiement en cours | Refus explicite ; les données du paiement en cours ne sont pas modifiées. |
| Modifier deux prix de manière à conserver le total | Paiement de la proforma refusé, avec demande de réédition. |
| Modifier le prix de remboursement d'un produit | Paiement de la proforma refusé, même si le montant à payer ne change pas. |
| Modifier les conditions du loueur après acceptation de la proforma | La facture reprend les conditions de la proforma acceptée. |
| Changer les conditions après affichage du formulaire de commande | Demande de relecture et de nouvelle acceptation. |
| Omettre l'acceptation via l'API | Aucun nouveau paiement initial ne peut être créé. |
| Double-cliquer sur proforma, préparation et paiement | Une seule réservation et un seul paiement initial. |
| Réserver un matériel à récupérer plus tard le même jour | Refus : le jour de récupération reste occupé. |
| Changer les dates d'une réservation livrée | Les dates de livraison et de récupération suivent les lignes actives du loueur ; la facture d'origine reste conservée. |
| Ajouter un loueur à une réservation déjà payée | Nouvelle commande requise, pour faire accepter ses conditions et chiffrer sa remise. |
| Changement des conditions de remise avant le webhook d'un complément | Modification annulée et complément remboursé ; paiement initial inchangé. |
| Panier mêlant livraison obligatoire et retrait uniquement | Explication du conflit et retour au panier pour séparer les commandes. |
| Saisir une heure invalide, un créneau inversé ou une date de livraison hors location | Refus côté serveur. |

## Disponibilité physique et facturation

La période facturée reste `[début, fin)` : aucune journée de location n'est ajoutée par le correctif.

La disponibilité ajoute `booking.return_buffer_days` à la date de fin : **1 par défaut**, donc le matériel reste occupé le jour de récupération et redevient réservable le lendemain. Le réglage, accessible dans l'administration, accepte 1 à 30 jours pour couvrir la remise en état. Le calendrier, le catalogue, le panier, le contrôle transactionnel et le stock du loueur appliquent la même règle.

Le moteur reste journalier. Une rotation de deux locations sur le même matériel le jour du retour est volontairement exclue du pilote, même si les heures pourraient sembler compatibles. Une gestion à l'heure pourra être développée séparément.

## Compatibilité et migration

1. Appliquer les migrations avec `npx prisma migrate deploy`, puis régénérer le client Prisma avec `npx prisma generate`.
2. La migration ajoute uniquement deux colonnes JSON nullable pour les conditions acceptées (`Hold.termsSnapshot` et `Reservation.termsSnapshot`). Elle ne réécrit aucune facture ou donnée financière historique.
3. Les anciennes proformas non payées n'ont pas d'empreinte financière complète : elles doivent être rééditées avant paiement. Leur numéro et leur contenu d'origine restent consultables.
4. Une ancienne réservation non payée sans instantané de consentement nécessite un nouveau passage par la commande et l'acceptation. Un paiement déjà initié reste consultable et traitable sans recréer une charge ni inventer rétroactivement un consentement.
5. Contrôler les réservations existantes qui se suivent sur un même matériel le jour du retour, avant d'activer cette version en exploitation. Elles ne sont pas automatiquement annulées.

## Périmètre du pilote

Le choix de remise reste global par commande. Un panier incompatible est expliqué et doit être séparé. L'ajout d'un nouveau loueur à une commande payée passe par une nouvelle commande. Ces règles de lancement protègent les montants et les consentements ; elles ne constituent pas encore un moteur de remise distincte pour chaque loueur.

Le fournisseur de paiement reste simulé. Aucun opérateur réel, clé de production ou déploiement commercial n'est ajouté par ce correctif.

## Vérification automatisée

Sur une base de test dédiée :

```bash
npx prisma generate
npm run typecheck
npm test
npm run build
```

`tests/checkout-consistency.test.ts` couvre les écarts de l'audit et les reprises concurrentes. Les tests historiques de paiement, commission, caution, permissions et concurrence sont conservés.
