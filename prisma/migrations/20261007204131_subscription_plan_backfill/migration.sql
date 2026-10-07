-- Reprise des abonnements actifs existants : la formule du loueur fixe désormais son taux de commission.
UPDATE "Lender" AS l
SET "plan" = s."plan", "planRenewsAt" = s."endsAt"
FROM "Subscription" AS s
WHERE s."lenderId" = l."id" AND s."status" = 'ACTIVE' AND s."plan" <> 'FREE';
