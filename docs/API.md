# API REST LOC'CONNECT

Document généré par `npm run docs:api` à partir du code (163 opérations). Ne pas modifier à la main.

## Conventions

- Toutes les réponses sont du JSON. Succès : `{ "success": true, "data": ... }`. Erreur : `{ "success": false, "error": { "code", "message", "request_id", "details"? } }`.
- Codes d'erreur : `VALIDATION_ERROR` (422), `UNAUTHENTICATED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `STOCK_INSUFFICIENT` (409), `INVALID_TRANSITION` (409), `RATE_LIMITED` (429), `CSRF_REJECTED` (403), `INTERNAL_ERROR` (500).
- Authentification : cookie de session `lc_session` (HttpOnly, SameSite=Lax). Les requêtes qui modifient des données vérifient l'en-tête `Origin`.
- Montants : entiers en FCFA. Dates de location : `AAAA-MM-JJ`, période semi-ouverte [début, fin).
- Idempotence : `idempotencyKey` sur la création de paiement ; les webhooks sont dédupliqués par `(provider, eventId)`.
- Webhook de paiement : signature HMAC-SHA256 du corps brut dans l'en-tête `x-signature`.
- Chaque route contrôle côté serveur le rôle **et** la permission, puis l'appartenance de la ressource (un loueur n'accède qu'à ses lignes).

## /api/admin

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/admin/audit` | journal d'audit global (utilisateur, action, entité, anciennes et nouvelles valeurs, IP). |
| `GET` | `/api/admin/cancellation-policy` | paliers de remboursement en vigueur. |
| `PUT` | `/api/admin/cancellation-policy` | remplace les paliers (délai minimal avant le début, pourcentage remboursé). |
| `GET` | `/api/admin/cash` | soldes payés en espèces aux loueurs, par statut. |
| `POST` | `/api/admin/cash/:id` | support, débloquer la saisie du code ou constater un paiement en espèces. |
| `GET` | `/api/admin/categories` | catégories et sous-catégories (y compris inactives). |
| `POST` | `/api/admin/categories` | crée une catégorie ou une sous-catégorie (parentId). |
| `PATCH` | `/api/admin/categories/:id` |  |
| `GET` | `/api/admin/cities` |  |
| `POST` | `/api/admin/cities` |  |
| `PATCH` | `/api/admin/cities/:id` |  |
| `GET` | `/api/admin/commissions` | commissions perçues par loueur et taux par défaut. |
| `GET` | `/api/admin/deliveries` |  |
| `GET` | `/api/admin/deposits` |  |
| `GET` | `/api/admin/disputes` | tous les litiges. Décision via PATCH /api/disputes/:id. |
| `GET` | `/api/admin/lenders` | loueurs (filtre par statut de validation). |
| `PATCH` | `/api/admin/lenders/:id` | valider, rejeter, suspendre ou réactiver un loueur (motif obligatoire pour rejeter ou suspendre). |
| `PUT` | `/api/admin/lenders/:id/cash-mode` | ouvre ou retire au loueur le mode acompte en ligne + solde en espèces. |
| `PATCH` | `/api/admin/lenders/:id/commission` | taux de commission spécifique (null = taux par défaut). Appliqué aux nouvelles réservations uniquement. |
| `PATCH` | `/api/admin/messages/:id` | marque un message de contact comme traité ou le rouvre. |
| `GET` | `/api/admin/notifications` | toutes les notifications (internes, e-mail). |
| `GET` | `/api/admin/payments` |  |
| `GET` | `/api/admin/payouts` | versements effectués. |
| `POST` | `/api/admin/payouts` | verse un loueur ({ lenderId }) ou tous les loueurs éligibles. Montants gelés et bloqués exclus, déductions compensées. |
| `GET` | `/api/admin/payouts/pending` | soldes par loueur (gelé, bloqué, disponible, déductions, versable). |
| `GET` | `/api/admin/products` |  |
| `PATCH` | `/api/admin/products/:id` | approuver, refuser (motif obligatoire) ou suspendre un produit. |
| `GET` | `/api/admin/promotions` | produits à la une et sponsorisés. |
| `POST` | `/api/admin/promotions` | met un produit en avant pour une durée donnée. |
| `PATCH` | `/api/admin/promotions/:id` | active ou désactive une mise en avant. |
| `GET` | `/api/admin/recoveries` | montants à recouvrer auprès des loueurs après remboursement d'un client. |
| `PATCH` | `/api/admin/recoveries/:id` | enregistre un recouvrement manuel (RECOVERED). La compensation sur versement est automatique. |
| `GET` | `/api/admin/refunds` |  |
| `GET` | `/api/admin/reservations` |  |
| `GET` | `/api/admin/returns` |  |
| `GET` | `/api/admin/reviews` |  |
| `PATCH` | `/api/admin/reviews/:id` | publier ou masquer un avis. |
| `GET` | `/api/admin/roles` | rôles plateforme et leurs membres. |
| `GET` | `/api/admin/settings` | paramètres commerciaux configurables (aucun n'est codé en dur). |
| `PATCH` | `/api/admin/settings` | modifie un paramètre (audité, effet immédiat sur les nouvelles opérations). |
| `GET` | `/api/admin/stats` | indicateurs du tableau de bord. |
| `GET` | `/api/admin/subscriptions` | historique des abonnements (Gratuit, PRO, PREMIUM). |
| `POST` | `/api/admin/subscriptions` | active une formule (la précédente est clôturée et conservée). |
| `GET` | `/api/admin/users` |  |
| `PATCH` | `/api/admin/users/:id` | suspendre, réactiver, désactiver (sessions révoquées) ou attribuer un rôle plateforme. |
| `GET` | `/api/admin/validations` | actions nécessitant une validation renforcée (ex. coordonnées de versement). |
| `PATCH` | `/api/admin/validations/:id` | approuve ou rejette. Le demandeur ne peut pas valider sa propre demande. |

## /api/auth

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/auth/forgot-password` | réponse identique que l'e-mail existe ou non (anti-énumération). |
| `POST` | `/api/auth/login` | ouvre une session (cookie httpOnly). Limité par IP, verrouillage progressif par compte. |
| `POST` | `/api/auth/logout` | révoque la session côté serveur et supprime le cookie. |
| `GET` | `/api/auth/me` | utilisateur courant, rôle, entreprise et permissions effectives. |
| `POST` | `/api/auth/register` | crée un compte CLIENT ou LOUEUR (en attente de validation). |
| `POST` | `/api/auth/reset-password` | choisit un nouveau mot de passe avec le jeton reçu par e-mail. |

## /api/cart

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/cart` | panier recalculé côté serveur (prix, caution, disponibilité réelle de chaque ligne). |
| `DELETE` | `/api/cart` | vide le panier. |
| `POST` | `/api/cart/items` | ajoute un produit avec ses dates et sa quantité (disponibilité vérifiée). |
| `PATCH` | `/api/cart/items/:id` | change la quantité ou les dates d'une ligne. |
| `DELETE` | `/api/cart/items/:id` | retire une ligne. |

## /api/categories

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/categories` | catégories racines avec leurs sous-catégories. |

## /api/cities

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/cities` | villes actives. |

## /api/contact

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/contact` | message envoyé depuis la page contact (public, limité par IP, champ piège anti-robots). |

## /api/cron

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/cron/maintenance` | tâches planifiées (expiration des HOLD, escalades, constats non contestés, e-mails). Authorization: Bearer CRON_SECRET. |

## /api/deliveries

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/deliveries/:id` | suivi d'une livraison. |
| `PATCH` | `/api/deliveries/:id` | planification (date, créneau, responsable, notes) par le loueur. |
| `POST` | `/api/deliveries/:id/proof` | preuve de livraison (photo privée, ou note). |
| `PATCH` | `/api/deliveries/:id/status` | fait avancer le suivi (PENDING, PREPARING, OUT_FOR_DELIVERY, DELIVERED, FAILED, RETURNED). |

## /api/deposits

| Méthode | Chemin | Description |
|---|---|---|
| `PATCH` | `/api/deposits/:id/release` | libère la caution (constat de retour obligatoire). |
| `PATCH` | `/api/deposits/:id/withhold` | retenue décidée par l'administration (plafonnée par la caution, motif obligatoire, auditée). |

## /api/disputes

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/disputes` | litiges visibles selon le rôle. |
| `GET` | `/api/disputes/:id` | litige, messages, pièces jointes et décision. |
| `PATCH` | `/api/disputes/:id` | l'administration change le statut ou rend une décision (client, loueur ou partielle). |
| `POST` | `/api/disputes/:id/messages` | message et pièces jointes (multipart : `message`, `files`). Pièces privées. |

## /api/favorites

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/favorites` | produits favoris du client. |
| `POST` | `/api/favorites/:productId` | ajoute un favori (idempotent). |
| `DELETE` | `/api/favorites/:productId` | retire un favori. |

## /api/files

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/files/:path*` | photos de produits, publiques et mises en cache. GET /api/files/private/... : preuves de retour, pièces de litige, preuves de livraison. Accès contrôlé : client concerné, loueur concerné et rôles administrateurs seulement. |

## /api/health

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/health` | sonde de disponibilité (application et base de données) pour l'orchestrateur ou le répartiteur de charge. |

## /api/holds

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/holds` | bloque temporairement le stock du panier. Rate limiting dédié (distinct du limiteur général), limite de HOLD actifs par client, durée réduite pour les clients à fort taux de HOLD non convertis. |
| `GET` | `/api/holds/:id` | état du blocage et temps restant. |
| `DELETE` | `/api/holds/:id` | libère le blocage de stock. |
| `POST` | `/api/holds/:id/expire` | expiration immédiate (abandon du paiement). Le stock est libéré. |

## /api/invoices

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/invoices` | factures et avoirs du périmètre de l'acteur (client, loueur ou administration). |
| `GET` | `/api/invoices/:id` | contenu figé d'une facture ou d'un avoir. La version imprimable est servie par /factures/:id. |

## /api/lenders

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/lenders/me` | entreprise du loueur connecté et soldes (gelé, bloqué, disponible, déductions). |
| `PATCH` | `/api/lenders/me` | profil professionnel et conditions de livraison. |
| `GET` | `/api/lenders/me/audit` | audit de l'entreprise, filtrable par utilisateur, action, entité et période. |
| `GET` | `/api/lenders/me/balance` | soldes et écritures (gelés, bloqués, disponibles, déductions). |
| `GET` | `/api/lenders/me/clients` | clients ayant loué chez ce loueur. |
| `PUT` | `/api/lenders/me/payment-mode` | tout en ligne, ou acompte en ligne et solde en espèces (si ouvert par l'administration). |
| `POST` | `/api/lenders/me/payout-details` | demande de modification des coordonnées de versement (autorisation renforcée de l'administration). |
| `GET` | `/api/lenders/me/payouts` | versements reçus. |
| `GET` | `/api/lenders/me/permissions` | catalogue des permissions granulaires. |
| `GET` | `/api/lenders/me/plan` | formule en cours et simulation du coût de chaque formule sur les 30 derniers jours. |
| `PUT` | `/api/lenders/me/plan` | changer de formule (plus chère : immédiat et facturé ; moins chère : à l'échéance). |
| `GET` | `/api/lenders/me/roles` | rôles système et personnalisés disponibles. |
| `POST` | `/api/lenders/me/roles` | crée un rôle personnalisé depuis le catalogue de permissions. |
| `PATCH` | `/api/lenders/me/roles/:id` | modifie un rôle personnalisé (les rôles système sont en lecture seule). |
| `GET` | `/api/lenders/me/stock` | stock physique, réservé, bloqué et disponible aujourd'hui par produit. |
| `GET` | `/api/lenders/me/unavailabilities` | périodes d'indisponibilité du loueur. |
| `POST` | `/api/lenders/me/unavailabilities` | bloque les nouvelles réservations sur une période. |
| `DELETE` | `/api/lenders/me/unavailabilities/:id` |  |
| `GET` | `/api/lenders/me/users` | sous-comptes de l'entreprise. |
| `POST` | `/api/lenders/me/users` | crée un sous-compte rattaché exclusivement à cette entreprise (mot de passe provisoire affiché une fois). |
| `GET` | `/api/lenders/me/users/:id` | détail d'un sous-compte. |
| `PATCH` | `/api/lenders/me/users/:id` | rôle, identité, suspension. |
| `POST` | `/api/lenders/me/users/:id/disable` | désactive le sous-compte et révoque ses sessions (historique conservé). |
| `PUT` | `/api/lenders/me/users/:id/roles` | attribue un rôle (système ou personnalisé) au sous-compte. |
| `GET` | `/api/lenders/public/:slug` | profil public d'un loueur validé. |

## /api/me

| Méthode | Chemin | Description |
|---|---|---|
| `PATCH` | `/api/me` | met à jour le profil. |
| `DELETE` | `/api/me` | désactive et anonymise le compte (les éléments financiers sont conservés). |
| `GET` | `/api/me/notifications` | notifications internes de l'utilisateur. |
| `POST` | `/api/me/notifications` | marque une notification (ou toutes) comme lue. |
| `POST` | `/api/me/password` | change le mot de passe et révoque toutes les sessions. |

## /api/payments

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/payments` | initie le paiement unique d'une réservation (ou d'un complément de dommages). Le montant est calculé par le serveur. La clé d'idempotence évite tout double paiement. Avec le fournisseur "simulated", aucun argent réel n'est déplacé : la réponse porte `simulated: true`. |
| `GET` | `/api/payments/:id` | détail d'un paiement (client propriétaire, loueur concerné, finance). |
| `GET` | `/api/payments/:id/lender-splits` | répartition comptable entre loueurs (commission, net, caution). |
| `POST` | `/api/payments/:id/refunds` | remboursement exceptionnel (administration finance), plafonné par le paiement. |
| `POST` | `/api/payments/:id/simulate` | DÉMONSTRATION. Déclenche un webhook signé de réussite ou d'échec. Aucun paiement réel. |
| `POST` | `/api/payments/webhook` | webhook du fournisseur de paiement, source de vérité du résultat. En-tête `x-signature` : HMAC SHA-256 hex du corps brut. Un événement (id) n'est traité qu'une fois. |

## /api/products

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/products` | recherche publique (texte, catégorie, ville, prix, période, disponibilité, tri, pagination). |
| `POST` | `/api/products` | un loueur crée un produit (brouillon ou soumis à modération). |
| `GET` | `/api/products/:id` | fiche publique d'un produit publié (par identifiant ou slug). |
| `PATCH` | `/api/products/:id` | modification par le loueur propriétaire (prix historisé). |
| `DELETE` | `/api/products/:id` | suppression logique (refusée si des locations sont en cours). |
| `GET` | `/api/products/:id/availability` | disponibilité jour par jour (60 jours max). Public. |
| `POST` | `/api/products/:id/availability` | un loueur bloque une quantité sur une période (maintenance, usage interne). |
| `DELETE` | `/api/products/:id/availability` | lève un blocage. |
| `POST` | `/api/products/:id/photos` | téléverse une photo publique (JPEG, PNG ou WebP, 6 Mo max). |
| `DELETE` | `/api/products/:id/photos` | supprime une photo. |
| `POST` | `/api/products/:id/status` | publier (soumettre à modération), désactiver ou réactiver. |
| `POST` | `/api/products/:id/stock` | ajustement de stock journalisé (jamais sous le stock déjà engagé). |

## /api/refunds

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/refunds/:id` | détail d'un remboursement. |
| `GET` | `/api/refunds/:id/lender-impacts` | part supportée par chaque loueur et état du recouvrement. |

## /api/reservation-items

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/reservation-items/:id/damage-invoice` | détail de la retenue de caution et du complément éventuellement facturé. |
| `GET` | `/api/reservation-items/:id/deposits` | caution de la ligne (une caution par ligne). |
| `POST` | `/api/reservation-items/:id/deposits` | garantit l'existence de la caution de la ligne (idempotent). La caution est bloquée automatiquement à la confirmation du paiement ; cette route sert au rattrapage administratif. |
| `GET` | `/api/reservation-items/:id/return-report` | constat (client, loueur concerné, admin). |
| `POST` | `/api/reservation-items/:id/return-report` | constat de retour par ligne (multipart : champ `data` JSON + fichiers `photos`). Les photos de retour sont privées : jamais publiques, accessibles au client, au loueur concerné et à l'administration. |
| `POST` | `/api/reservation-items/:id/return-report/acknowledge` | le client accepte le constat ; la caution est réglée immédiatement. |
| `POST` | `/api/reservation-items/:id/return-report/contest` | contestation dans la fenêtre. La caution est gelée et un litige ciblé est ouvert. |
| `POST` | `/api/reservation-items/:id/review` | avis sur le produit, le loueur et l'expérience, après une location terminée. |

## /api/reservations

| Méthode | Chemin | Description |
|---|---|---|
| `GET` | `/api/reservations` | liste selon le rôle (client : les siennes ; loueur : ses lignes ; admin : toutes). |
| `POST` | `/api/reservations` | crée la réservation (statut HOLD) depuis un blocage de stock actif. Montants recalculés côté serveur. |
| `GET` | `/api/reservations/:id` | détail selon le périmètre (le loueur ne voit que ses lignes). |
| `PATCH` | `/api/reservations/:id` | fait avancer le statut des lignes. Un loueur peut valider, préparer et remettre (permissions ORDER_*). L'administration peut corriger un statut (motif obligatoire, audité). Transitions validées par la machine à états. |
| `POST` | `/api/reservations/:id/cancel` | annule des lignes (ou tout) et rembourse selon la politique ; effet précisé par ligne et par loueur. |
| `GET` | `/api/reservations/:id/cancellation-preview` | montant remboursable avant confirmation. |
| `GET` | `/api/reservations/:id/cash` | soldes à régler en espèces (le code de remise n'est visible que du client et de l'administration). |
| `POST` | `/api/reservations/:id/cash` | le loueur confirme l'encaissement du solde avec le code de remise donné par le client. |
| `POST` | `/api/reservations/:id/cash/unpaid` | le client n'a pas payé le solde à la remise ; lignes du loueur annulées, caution restituée. |
| `POST` | `/api/reservations/:id/delivery` | le client précise adresse, zone, date et créneau de livraison avant la préparation. |
| `POST` | `/api/reservations/:id/dispute` | ouvre un litige ciblé sur un loueur (les autres loueurs ne sont pas impactés). |
| `GET` | `/api/reservations/:id/modifications` | historique des demandes. |
| `POST` | `/api/reservations/:id/modifications` | crée une demande de modification (jamais d'écrasement direct). |
| `GET` | `/api/reservations/:id/modifications/:modId` | détail d'une demande. |
| `POST` | `/api/reservations/:id/modifications/:modId/apply` | applique après validation et règlement. Disponibilité revérifiée avec verrouillage. |
| `POST` | `/api/reservations/:id/modifications/:modId/approve` | le loueur (ou l'administration en escalade) accepte. Sans complément à payer, la modification est appliquée. |
| `POST` | `/api/reservations/:id/modifications/:modId/cancel` | le client annule sa demande avant application. |
| `POST` | `/api/reservations/:id/modifications/:modId/pay` | crée le paiement complémentaire (distinct du paiement initial). Idempotent par clé. |
| `POST` | `/api/reservations/:id/modifications/:modId/reject` | refus motivé par le loueur ou l'administration. |
| `POST` | `/api/reservations/:id/modifications/:modId/relaunch` | l'administration relance le loueur avec un délai supplémentaire (escalade). |
| `POST` | `/api/reservations/:id/modifications/preview` | calcule complément, remboursement, caution et commission sans rien créer. |

## /api/reviews

| Méthode | Chemin | Description |
|---|---|---|
| `POST` | `/api/reviews/:id/reply` | réponse publique du loueur à un avis. |

