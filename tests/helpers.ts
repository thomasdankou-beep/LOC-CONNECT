import { db } from "@/lib/db";
import { seedSystemData } from "@/prisma/system";
import { loadActor, type Actor } from "@/lib/auth/actor";
import { addDays, parseDate, toISODate, todayUTC } from "@/lib/dates";
import { invalidateSettings } from "@/lib/settings";
import { resetRateLimits } from "@/lib/rate-limit";

const TABLES = [
  "ModificationLine", "ModificationRequest", "ReservationVersion", "BalanceEntry", "Payout", "LenderReimbursement", "FinancialTransaction", "Refund", "PaymentAllocation",
  "CashSettlement", "ExtraCharge", "ReturnPhoto", "ReturnReport", "Deposit", "DeliveryProof", "Delivery", "Attachment", "DisputeMessage", "Dispute", "Review", "Payment", "WebhookEvent",
  "ReservationStatusHistory", "ContactMessage", "ReservationItem", "Reservation", "HoldItem", "Hold", "CartItem", "Cart", "Notification", "AuditLog", "Favorite", "Promotion", "Subscription",
  "AvailabilityBlock", "StockMovement", "ProductPriceHistory", "ProductPhoto", "Product", "LenderUnavailability", "LenderScore", "ClientScore", "ValidationAction",
  "LenderMember", "Lender", "UserRole", "RolePermission", "Role", "Permission", "Session", "PasswordResetToken", "User", "Category", "City", "CancellationRule", "CancellationPolicy", "Setting",
];

export async function resetDb() {
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  invalidateSettings();
  resetRateLimits();
  await seedSystemData(db);
  // Les scénarios historiques raisonnent sur une caution fixe par produit ; le calcul en pourcentage a ses propres tests.
  await db.setting.update({ where: { key: "deposit.mode" }, data: { value: "FIXED_PER_PRODUCT" } });
  invalidateSettings();
}

let n = 0;
const uid = () => `${Date.now().toString(36)}${(n++).toString(36)}`;

export async function makeBase() {
  const city = await db.city.create({ data: { slug: `abidjan-${uid()}`, name: "Abidjan", region: "Lagunes" } });
  const city2 = await db.city.create({ data: { slug: `bouake-${uid()}`, name: "Bouaké", region: "Vallée du Bandama" } });
  const category = await db.category.create({ data: { slug: `cat-${uid()}`, name: "Événementiel" } });
  return { city, city2, category };
}

export async function makeClient(name = "Client") {
  const user = await db.user.create({ data: { email: `${name.toLowerCase()}-${uid()}@test.ci`, passwordHash: "x", firstName: name, lastName: "Test", accountType: "CLIENT" } });
  return { user, actor: (await loadActor(user.id))! };
}

export async function makeAdmin(role = "SUPER_ADMIN") {
  const user = await db.user.create({ data: { email: `admin-${uid()}@test.ci`, passwordHash: "x", firstName: "Admin", lastName: "Test", accountType: "ADMIN" } });
  const r = await db.role.findUniqueOrThrow({ where: { key: `SYSTEM:${role}` } });
  await db.userRole.create({ data: { userId: user.id, roleId: r.id } });
  return { user, actor: (await loadActor(user.id))! };
}

export async function makeLender(cityId: string, opts: { name?: string; status?: "APPROVED" | "PENDING"; payout?: boolean; delivery?: boolean } = {}) {
  const user = await db.user.create({ data: { email: `lender-${uid()}@test.ci`, passwordHash: "x", firstName: "Loueur", lastName: opts.name ?? "Test", accountType: "LENDER" } });
  const lender = await db.lender.create({
    data: { ownerId: user.id, slug: `loueur-${uid()}`, companyName: opts.name ?? `Loueur ${uid()}`, cityId, status: opts.status ?? "APPROVED", payoutMethod: opts.payout === false ? null : "WAVE", payoutAccount: opts.payout === false ? null : "0700000000", offersDelivery: opts.delivery ?? true },
  });
  return { user, lender, actor: (await loadActor(user.id))! as Actor & { lenderId: string } };
}

export async function makeProduct(lenderId: string, categoryId: string, cityId: string, over: Partial<{ name: string; unitPrice: number; stock: number; deposit: number; refundPrice: number; extra: boolean }> = {}) {
  return db.product.create({
    data: {
      slug: `produit-${uid()}`,
      name: over.name ?? "Chaise pliante",
      description: "Chaise pliante pour événements, lot de test.",
      unitPrice: over.unitPrice ?? 1000,
      stockQuantity: over.stock ?? 10,
      depositAmount: over.deposit ?? 2000,
      refundPrice: over.refundPrice ?? 5000,
      status: "PUBLISHED",
      allowsExtraBilling: over.extra ?? true,
      lenderId,
      categoryId,
      cityId,
    },
  });
}

export const day = (offset: number) => toISODate(addDays(todayUTC(), offset));
export const date = (offset: number) => parseDate(day(offset));
