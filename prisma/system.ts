import type { PrismaClient } from "@prisma/client";
import { PERMISSIONS, SYSTEM_ROLES } from "../lib/rbac/permissions";
import { SETTING_DEFS } from "../lib/settings";

/** Données système indispensables : permissions, rôles, paramètres, politique d'annulation. Idempotent. */
export async function seedSystemData(db: PrismaClient) {
  for (const p of PERMISSIONS) {
    await db.permission.upsert({ where: { code: p.code }, update: { label: p.label, domain: p.domain, scope: p.scope }, create: p });
  }
  const permissions = await db.permission.findMany();
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));

  for (const r of SYSTEM_ROLES) {
    const key = `SYSTEM:${r.code}`;
    const role = await db.role.upsert({
      where: { key },
      update: { name: r.name, description: r.description },
      create: { key, code: r.code, name: r.name, description: r.description, scope: r.scope, isSystem: true },
    });
    await db.rolePermission.deleteMany({ where: { roleId: role.id } });
    await db.rolePermission.createMany({ data: r.permissions.map((code) => ({ roleId: role.id, permissionId: byCode.get(code)! })) });
  }

  for (const [key, def] of Object.entries(SETTING_DEFS)) {
    await db.setting.upsert({ where: { key }, update: { description: def.description, group: def.group }, create: { key, value: def.default, description: def.description, group: def.group } });
  }

  const existing = await db.cancellationPolicy.findFirst({ where: { isDefault: true } });
  if (!existing) {
    await db.cancellationPolicy.create({
      data: {
        name: "Politique standard",
        description: "Remboursement intégral jusqu'à 72 h avant le début, 50 % entre 72 h et 24 h, aucun remboursement ensuite.",
        isDefault: true,
        rules: { create: [{ minHoursBefore: 72, refundPercent: 100 }, { minHoursBefore: 24, refundPercent: 50 }, { minHoursBefore: 0, refundPercent: 0 }] },
      },
    });
  }
}
