import type { RoleScope } from "@prisma/client";

export type PermissionDef = { code: string; label: string; domain: string; scope: RoleScope };

const lender = (domain: string, items: [string, string][]): PermissionDef[] =>
  items.map(([code, label]) => ({ code, label, domain, scope: "LENDER" as const }));
const platform = (domain: string, items: [string, string][]): PermissionDef[] =>
  items.map(([code, label]) => ({ code, label, domain, scope: "PLATFORM" as const }));

/** Catalogue de permissions granulaires. Contrôlées côté serveur sur chaque endpoint et chaque ressource. */
export const PERMISSIONS: PermissionDef[] = [
  ...lender("Produits", [
    ["PRODUCT_VIEW", "Voir les produits"],
    ["PRODUCT_CREATE", "Créer des produits"],
    ["PRODUCT_UPDATE", "Modifier des produits"],
    ["PRODUCT_DELETE", "Supprimer ou désactiver des produits"],
    ["CALENDAR_MANAGE", "Gérer le calendrier et les indisponibilités"],
  ]),
  ...lender("Stock", [
    ["STOCK_VIEW", "Voir le stock"],
    ["STOCK_CREATE", "Créer des mouvements de stock"],
    ["STOCK_UPDATE", "Modifier le stock"],
    ["STOCK_ADJUST", "Ajuster le stock"],
  ]),
  ...lender("Commandes", [
    ["ORDER_VIEW", "Voir les réservations"],
    ["ORDER_PREPARE", "Préparer les commandes"],
    ["ORDER_VALIDATE", "Valider les commandes"],
    ["ORDER_STATUS_UPDATE", "Changer le statut des commandes"],
    ["MODIFICATION_DECIDE", "Répondre aux demandes de modification"],
    ["CUSTOMER_VIEW", "Voir les clients"],
    ["DISPUTE_VIEW", "Voir les litiges"],
    ["DISPUTE_RESPOND", "Répondre aux litiges"],
    ["REVIEW_VIEW", "Voir les avis"],
    ["REVIEW_REPLY", "Répondre aux avis"],
  ]),
  ...lender("Finance", [
    ["FINANCE_VIEW", "Voir les revenus"],
    ["PAYOUT_VIEW", "Voir les versements"],
    ["REFUND_VIEW", "Voir les remboursements"],
    ["DEPOSIT_VIEW", "Voir les cautions"],
    ["REPORT_FINANCE_EXPORT", "Exporter les rapports financiers"],
  ]),
  ...lender("Livraison", [
    ["DELIVERY_VIEW", "Voir les livraisons"],
    ["DELIVERY_UPDATE", "Mettre à jour les livraisons"],
    ["DELIVERY_PROOF_CREATE", "Ajouter une preuve de livraison"],
  ]),
  ...lender("Retours", [
    ["RETURN_VIEW", "Voir les retours"],
    ["RETURN_CREATE", "Créer un constat de retour"],
    ["RETURN_EVIDENCE_CREATE", "Ajouter des preuves de retour"],
    ["DAMAGE_REPORT_CREATE", "Déclarer des dommages"],
  ]),
  ...lender("Entreprise", [
    ["COMPANY_MANAGE", "Gérer le profil de l'entreprise"],
    ["TEAM_MANAGE", "Gérer les sous-comptes et rôles"],
    ["AUDIT_VIEW", "Consulter l'audit de l'entreprise"],
  ]),
  ...platform("Plateforme", [
    ["ADMIN_DASHBOARD", "Voir le tableau de bord"],
    ["ADMIN_USERS", "Gérer les utilisateurs"],
    ["ADMIN_LENDERS", "Valider et suspendre les loueurs"],
    ["ADMIN_PRODUCTS", "Modérer les produits"],
    ["ADMIN_CATALOG", "Gérer catégories et villes"],
    ["ADMIN_RESERVATIONS", "Gérer les réservations"],
    ["ADMIN_PAYMENTS", "Voir les paiements"],
    ["ADMIN_REFUNDS", "Gérer les remboursements"],
    ["ADMIN_COMMISSIONS", "Gérer les commissions"],
    ["ADMIN_DEPOSITS", "Gérer les cautions"],
    ["ADMIN_RETURNS", "Voir les retours"],
    ["ADMIN_DELIVERIES", "Voir les livraisons"],
    ["ADMIN_DISPUTES", "Arbitrer les litiges"],
    ["ADMIN_REVIEWS", "Modérer les avis"],
    ["ADMIN_PAYOUTS", "Gérer les versements"],
    ["ADMIN_RECOVERIES", "Gérer les recouvrements"],
    ["ADMIN_SUBSCRIPTIONS", "Gérer les abonnements"],
    ["ADMIN_PROMOTIONS", "Gérer les mises en avant"],
    ["ADMIN_NOTIFICATIONS", "Voir les notifications"],
    ["ADMIN_AUDIT", "Consulter l'audit global"],
    ["ADMIN_SETTINGS", "Modifier les paramètres"],
    ["ADMIN_ROLES", "Gérer les rôles"],
    ["ADMIN_STOCK", "Contrôler les stocks"],
    ["ADMIN_MODIFICATIONS", "Trancher les escalades de modification"],
  ]),
];

export const ALL_LENDER_PERMISSIONS = PERMISSIONS.filter((p) => p.scope === "LENDER").map((p) => p.code);
export const ALL_PLATFORM_PERMISSIONS = PERMISSIONS.filter((p) => p.scope === "PLATFORM").map((p) => p.code);

export type SystemRoleDef = { code: string; name: string; description: string; scope: RoleScope; permissions: string[] };

/** Rôles système. Le propriétaire loueur dispose implicitement de toutes les permissions loueur. */
export const SYSTEM_ROLES: SystemRoleDef[] = [
  { code: "SUPER_ADMIN", name: "Super administrateur", description: "Accès global et gestion des rôles", scope: "PLATFORM", permissions: ALL_PLATFORM_PERMISSIONS },
  {
    code: "ADMIN_SUPPORT",
    name: "Admin support",
    description: "Support, utilisateurs, réservations, litiges",
    scope: "PLATFORM",
    permissions: ["ADMIN_DASHBOARD", "ADMIN_USERS", "ADMIN_RESERVATIONS", "ADMIN_DISPUTES", "ADMIN_DELIVERIES", "ADMIN_RETURNS", "ADMIN_NOTIFICATIONS", "ADMIN_MODIFICATIONS"],
  },
  {
    code: "ADMIN_FINANCE",
    name: "Admin finance",
    description: "Paiements, remboursements, commissions, versements, cautions, recouvrements",
    scope: "PLATFORM",
    permissions: ["ADMIN_DASHBOARD", "ADMIN_PAYMENTS", "ADMIN_REFUNDS", "ADMIN_COMMISSIONS", "ADMIN_PAYOUTS", "ADMIN_DEPOSITS", "ADMIN_RECOVERIES", "ADMIN_SUBSCRIPTIONS", "ADMIN_PROMOTIONS", "ADMIN_RESERVATIONS"],
  },
  {
    code: "ADMIN_MODERATION",
    name: "Admin modération",
    description: "Loueurs, produits, contenus, avis",
    scope: "PLATFORM",
    permissions: ["ADMIN_DASHBOARD", "ADMIN_LENDERS", "ADMIN_PRODUCTS", "ADMIN_CATALOG", "ADMIN_REVIEWS"],
  },
  {
    code: "ADMIN_STOCK",
    name: "Admin stock",
    description: "Contrôle des stocks et mouvements",
    scope: "PLATFORM",
    permissions: ["ADMIN_DASHBOARD", "ADMIN_STOCK", "ADMIN_PRODUCTS"],
  },
  {
    code: "STOCK_MANAGER",
    name: "Gestionnaire stock",
    description: "Produits, stock et calendrier",
    scope: "LENDER",
    permissions: ["PRODUCT_VIEW", "PRODUCT_CREATE", "PRODUCT_UPDATE", "CALENDAR_MANAGE", "STOCK_VIEW", "STOCK_CREATE", "STOCK_UPDATE", "STOCK_ADJUST", "RETURN_VIEW"],
  },
  {
    code: "ORDER_MANAGER",
    name: "Responsable commandes",
    description: "Réservations, préparation et modifications",
    scope: "LENDER",
    permissions: ["ORDER_VIEW", "ORDER_PREPARE", "ORDER_VALIDATE", "ORDER_STATUS_UPDATE", "MODIFICATION_DECIDE", "CUSTOMER_VIEW", "DISPUTE_VIEW", "DISPUTE_RESPOND", "REVIEW_VIEW", "REVIEW_REPLY", "PRODUCT_VIEW"],
  },
  {
    code: "FINANCE_MANAGER",
    name: "Responsable finance",
    description: "Revenus, versements, cautions",
    scope: "LENDER",
    permissions: ["FINANCE_VIEW", "PAYOUT_VIEW", "REFUND_VIEW", "DEPOSIT_VIEW", "REPORT_FINANCE_EXPORT", "ORDER_VIEW"],
  },
  {
    code: "DELIVERY_MANAGER",
    name: "Responsable livraison",
    description: "Livraisons et preuves",
    scope: "LENDER",
    permissions: ["DELIVERY_VIEW", "DELIVERY_UPDATE", "DELIVERY_PROOF_CREATE", "ORDER_VIEW"],
  },
  {
    code: "RETURN_CONTROLLER",
    name: "Responsable retours et contrôle",
    description: "Constats de retour et preuves",
    scope: "LENDER",
    permissions: ["RETURN_VIEW", "RETURN_CREATE", "RETURN_EVIDENCE_CREATE", "DAMAGE_REPORT_CREATE", "DEPOSIT_VIEW", "ORDER_VIEW"],
  },
];
