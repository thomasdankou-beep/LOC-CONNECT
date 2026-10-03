import nodemailer from "nodemailer";
import type { Prisma } from "@prisma/client";
import { db, type DbOrTx } from "@/lib/db";
import { env } from "@/lib/env";

export type NotifyInput = {
  type: string;
  title: string;
  body: string;
  link?: string;
  data?: Prisma.InputJsonValue;
};

const emailEnabled = () => Boolean(env().SMTP_HOST);

/**
 * Notifications internes (toujours) et e-mail (si SMTP configuré, via une boîte d'envoi traitée hors transaction).
 * SMS et WhatsApp sont prévus comme extension : il suffit d'ajouter un canal dans `deliverPending`.
 */
export async function notifyUsers(client: DbOrTx, userIds: string[], input: NotifyInput): Promise<void> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return;
  const rows: Prisma.NotificationCreateManyInput[] = ids.map((userId) => ({
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    data: input.data,
    channel: "INTERNAL",
    status: "SENT",
    sentAt: new Date(),
  }));
  if (emailEnabled()) {
    for (const userId of ids) {
      rows.push({ userId, type: input.type, title: input.title, body: input.body, link: input.link, data: input.data, channel: "EMAIL", status: "PENDING" });
    }
  }
  await client.notification.createMany({ data: rows });
  if (emailEnabled()) setTimeout(() => void deliverPending().catch(() => undefined), 1500);
}

/** Destinataires côté loueur : le propriétaire et les sous-comptes actifs dont le rôle porte la permission demandée. */
export async function lenderRecipients(client: DbOrTx, lenderId: string, permission?: string): Promise<string[]> {
  const lender = await client.lender.findUnique({
    where: { id: lenderId },
    include: { members: { where: { status: "ACTIVE" }, include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  });
  if (!lender) return [];
  const ids = [lender.ownerId];
  for (const m of lender.members) {
    if (!permission || m.role.permissions.some((p) => p.permission.code === permission)) ids.push(m.userId);
  }
  return ids;
}

export async function notifyLender(client: DbOrTx, lenderId: string, input: NotifyInput, permission?: string): Promise<void> {
  await notifyUsers(client, await lenderRecipients(client, lenderId, permission), input);
}

export async function adminRecipients(client: DbOrTx, permission?: string): Promise<string[]> {
  const admins = await client.user.findMany({
    where: {
      accountType: "ADMIN",
      status: "ACTIVE",
      ...(permission ? { roles: { some: { role: { permissions: { some: { permission: { code: permission } } } } } } } : {}),
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function notifyAdmins(client: DbOrTx, input: NotifyInput, permission?: string): Promise<void> {
  await notifyUsers(client, await adminRecipients(client, permission), input);
}

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function mailer() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env().SMTP_HOST,
      port: env().SMTP_PORT,
      secure: env().SMTP_PORT === 465,
      auth: env().SMTP_USER ? { user: env().SMTP_USER, pass: env().SMTP_PASSWORD } : undefined,
    });
  }
  return transporter;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Envoie les e-mails en attente. Appelé par la maintenance et peu après l'écriture des notifications. */
export async function deliverPending(limit = 50): Promise<number> {
  if (!emailEnabled()) return 0;
  const pending = await db.notification.findMany({
    where: { channel: "EMAIL", status: "PENDING" },
    include: { user: { select: { email: true, firstName: true } } },
    take: limit,
    orderBy: { createdAt: "asc" },
  });
  let sent = 0;
  for (const n of pending) {
    try {
      const link = n.link ? `${env().APP_URL}${n.link}` : null;
      await mailer().sendMail({
        from: env().MAIL_FROM,
        to: n.user.email,
        subject: n.title,
        text: `Bonjour ${n.user.firstName},\n\n${n.body}${link ? `\n\n${link}` : ""}\n\nL'équipe LOC'CONNECT`,
        html: `<p>Bonjour ${esc(n.user.firstName)},</p><p>${esc(n.body)}</p>${link ? `<p><a href="${esc(link)}">Ouvrir dans LOC'CONNECT</a></p>` : ""}<p>L'équipe LOC'CONNECT</p>`,
      });
      await db.notification.update({ where: { id: n.id }, data: { status: "SENT", sentAt: new Date() } });
      sent++;
    } catch {
      await db.notification.update({ where: { id: n.id }, data: { status: "FAILED" } });
    }
  }
  return sent;
}

export async function listNotifications(userId: string, opts: { unreadOnly?: boolean; take?: number } = {}) {
  return db.notification.findMany({
    where: { userId, channel: "INTERNAL", ...(opts.unreadOnly ? { readAt: null } : {}) },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 50,
  });
}

export const unreadCount = (userId: string) => db.notification.count({ where: { userId, channel: "INTERNAL", readAt: null } });

export async function markRead(userId: string, id?: string): Promise<void> {
  await db.notification.updateMany({ where: { userId, channel: "INTERNAL", readAt: null, ...(id ? { id } : {}) }, data: { readAt: new Date() } });
}

