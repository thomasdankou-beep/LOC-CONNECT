import { z } from "zod";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { can, type Actor } from "@/lib/auth/actor";
import { notifyAdmins } from "./notifications";

export const contactInput = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide"),
  phone: z.string().trim().max(30).optional(),
  subject: z.string().trim().min(3, "Indiquez un objet").max(150),
  message: z.string().trim().min(10, "Votre message est trop court").max(3000),
  /** Champ piège : rempli uniquement par des robots. */
  website: z.string().max(0).optional(),
});

export async function submitContact(input: z.infer<typeof contactInput>, userId?: string | null) {
  const { website, ...data } = input;
  void website;
  const row = await db.contactMessage.create({ data: { ...data, userId: userId ?? null } });
  await notifyAdmins(db, { type: "contact.new", title: `Nouveau message : ${data.subject}`, body: `${data.name} (${data.email})`, link: "/admin/messages" }, "ADMIN_NOTIFICATIONS");
  return { id: row.id };
}

export async function listContactMessages(actor: Actor, opts: { handled?: boolean; page?: number } = {}) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_NOTIFICATIONS")) throw forbidden();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = 20;
  const where = opts.handled === undefined ? {} : { handled: opts.handled };
  const [total, rows] = await Promise.all([db.contactMessage.count({ where }), db.contactMessage.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize })]);
  return { rows, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function setContactHandled(actor: Actor, id: string, handled: boolean) {
  if (actor.accountType !== "ADMIN" || !can(actor, "ADMIN_NOTIFICATIONS")) throw forbidden();
  const row = await db.contactMessage.findUnique({ where: { id } });
  if (!row) throw notFound("Message");
  const updated = await db.contactMessage.update({ where: { id }, data: { handled, handledAt: handled ? new Date() : null, handledBy: handled ? actor.userId : null } });
  await audit(db, { userId: actor.userId, action: handled ? "contact.handled" : "contact.reopened", entity: "ContactMessage", entityId: id, meta: actor.meta });
  return updated;
}
