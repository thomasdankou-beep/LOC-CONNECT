import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { can, type Actor } from "@/lib/auth/actor";
import { db, lockProducts, transaction, type DbOrTx } from "@/lib/db";
import { conflict, forbidden, invalid, notFound } from "@/lib/errors";
import { MAX_MESSAGE_LENGTH, MAX_MESSAGE_PHOTOS, type MessageTarget } from "@/lib/product-messages";
import { MAX_UPLOAD_BYTES, saveUpload, storage } from "@/lib/storage";
import { PUBLIC_WHERE } from "./catalog";
import { notifyLender, notifyUsers } from "./notifications";

const permission = "PRODUCT_MESSAGE_MANAGE";

function conversationScope(actor: Actor): Prisma.ProductConversationWhereInput {
  if (actor.accountType === "CLIENT") return { clientId: actor.userId };
  if (actor.accountType === "LENDER" && actor.lenderId && can(actor, permission)) return { lenderId: actor.lenderId };
  throw forbidden();
}

const productInfo = { id: true, name: true, slug: true, deletedAt: true, status: true } as const;
const senderInfo = { firstName: true, lastName: true } as const;
const newest = [{ createdAt: "desc" }, { id: "desc" }] satisfies Prisma.ProductMessageOrderByWithRelationInput[];

function pageWindow(requested: number, total: number, size: number) {
  const totalPages = Math.max(1, Math.ceil(total / size));
  const page = Math.min(totalPages, Math.max(1, Math.trunc(requested) || 1));
  return { page, totalPages, skip: (page - 1) * size };
}

async function publicProduct(client: DbOrTx, productId: string) {
  return client.product.findFirst({
    where: { id: productId, ...PUBLIC_WHERE },
    select: { id: true, name: true, slug: true, lenderId: true, lender: { select: { companyName: true } } },
  });
}

export async function getMessageDraft(actor: Actor, productId: string) {
  if (actor.accountType !== "CLIENT") throw forbidden();
  const product = await publicProduct(db, productId);
  if (!product) return null;
  const existing = await db.productConversation.findUnique({
    where: { clientId_productId_lenderId: { clientId: actor.userId, productId, lenderId: product.lenderId } },
    select: { id: true },
  });
  return { product, existingId: existing?.id };
}

export async function listProductConversations(actor: Actor, requested = 1) {
  const where = conversationScope(actor);
  const { page, totalPages, skip } = pageWindow(requested, await db.productConversation.count({ where }), 20);
  const rows = await db.productConversation.findMany({
    where, skip, take: 20, orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      id: true, updatedAt: true, product: { select: { name: true } },
      client: { select: senderInfo }, lender: { select: { companyName: true } },
      messages: { orderBy: newest, take: 1, select: { body: true } },
    },
  });
  return { page, totalPages, rows };
}

export async function getProductConversation(actor: Actor, id: string, requested = 1) {
  const thread = await db.productConversation.findFirst({
    where: { id, ...conversationScope(actor) },
    select: {
      id: true, clientId: true, product: { select: productInfo }, client: { select: senderInfo },
      lender: { select: { companyName: true, status: true } }, _count: { select: { messages: true } },
    },
  });
  if (!thread) return null;
  const { page, totalPages, skip } = pageWindow(requested, thread._count.messages, 30);
  const messages = await db.productMessage.findMany({
    where: { conversationId: id }, skip, take: 30, orderBy: newest,
    select: {
      id: true, authorId: true, body: true, createdAt: true, author: { select: senderInfo },
      photos: { orderBy: { position: "asc" }, select: { storageKey: true } },
    },
  });
  return { ...thread, messages: messages.reverse(), page, totalPages };
}

export async function canReadProductMessagePhoto(actor: Actor, storageKey: string) {
  const photo = await db.productMessagePhoto.findFirst({
    where: { storageKey, message: { conversation: conversationScope(actor) } }, select: { id: true },
  });
  return Boolean(photo);
}

async function messageDestination(client: DbOrTx, actor: Actor, target: MessageTarget) {
  if ("productId" in target) {
    if (actor.accountType !== "CLIENT") throw forbidden();
    const product = await publicProduct(client, target.productId);
    if (!product) throw notFound("Article");
    return { id: null, clientId: actor.userId, productId: product.id, lenderId: product.lenderId, name: product.name };
  }

  const thread = await client.productConversation.findFirst({
    where: { id: target.conversationId, ...conversationScope(actor) },
    select: { id: true, productId: true, clientId: true, lenderId: true, product: { select: { name: true } }, lender: { select: { status: true } } },
  });
  if (!thread) throw notFound("Conversation");
  if (thread.lender.status !== "APPROVED") throw conflict("Ce loueur est actuellement indisponible.");
  return { id: thread.id, productId: thread.productId, clientId: thread.clientId, lenderId: thread.lenderId, name: thread.product.name };
}

async function removeUnlinkedPhotos(keys: string[]) {
  if (!keys.length) return;
  // Si le résultat du commit est incertain, vérifier les références avant de retirer un fichier.
  const linked = await db.productMessagePhoto.findMany({ where: { storageKey: { in: keys } }, select: { storageKey: true } });
  const retained = new Set(linked.map((p) => p.storageKey));
  await Promise.all(keys.filter((key) => !retained.has(key)).map((key) => storage().delete(key)));
}

export async function sendProductMessage(actor: Actor, target: MessageTarget, requestId: string, text: string, files: File[]) {
  const body = text.trim();
  if (!/^[a-zA-Z0-9_-]{12,100}$/.test(requestId)) throw invalid("Identifiant d’envoi invalide.");
  if (!body && !files.length) throw invalid("Écrivez un message ou joignez une photo.");
  if (body.length > MAX_MESSAGE_LENGTH) throw invalid("Le message dépasse 2 000 caractères.");
  if (files.length > MAX_MESSAGE_PHOTOS) throw invalid("Vous pouvez joindre jusqu’à trois photos par message.");
  if (files.some((file) => !file.size || file.size > MAX_UPLOAD_BYTES)) throw invalid("Chaque photo doit peser entre 1 octet et 6 Mo.");

  const initial = await messageDestination(db, actor, target);
  const keys: string[] = [];
  let retained = false;
  try {
    for (const file of files) {
      const saved = await saveUpload(file, "product-messages/" + initial.lenderId, "private");
      keys.push(saved.key);
    }
    const result = await transaction(async (tx) => {
      // Deux premiers messages simultanés doivent ouvrir un seul fil pour cet article.
      if ("productId" in target) await lockProducts(tx, [target.productId]);
      const dest = await messageDestination(tx, actor, target);
      if (initial.lenderId !== dest.lenderId) throw conflict("Le loueur de cet article a changé. Rouvrez la fiche.");
      const participants = { clientId: dest.clientId, productId: dest.productId, lenderId: dest.lenderId };
      const conversationId = dest.id ?? (await tx.productConversation.upsert({
        where: { clientId_productId_lenderId: participants }, create: participants, update: {}, select: { id: true },
      })).id;
      const messageId = randomUUID();
      const inserted = await tx.productMessage.createMany({
        data: { id: messageId, conversationId, authorId: actor.userId, requestId, body },
        skipDuplicates: true,
      });
      if (!inserted.count) return { conversationId, inserted: false };
      if (keys.length) await tx.productMessagePhoto.createMany({ data: keys.map((storageKey, position) => ({ messageId, storageKey, position })) });
      await tx.productConversation.update({ where: { id: conversationId }, data: { updatedAt: new Date() } });

      const notice = { type: "product.message", title: "Nouveau message sur un article", body: "Vous avez reçu un message au sujet de « " + dest.name + " »." };
      if (actor.accountType === "CLIENT") {
        await notifyLender(tx, dest.lenderId, { ...notice, link: "/loueur/messages/" + conversationId }, permission);
      } else {
        await notifyUsers(tx, [dest.clientId], { ...notice, link: "/mes-messages/" + conversationId });
      }
      return { conversationId, inserted: true };
    });
    retained = result.inserted;
    return { conversationId: result.conversationId };
  } finally {
    if (!retained) await removeUnlinkedPhotos(keys).catch(() => undefined);
  }
}
