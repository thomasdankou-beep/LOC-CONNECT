import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { loadActor, type Actor } from "@/lib/auth/actor";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { storage } from "@/lib/storage";
import { POST } from "@/app/api/product-messages/route";
import { GET as getFile } from "@/app/api/files/[...path]/route";
import { getMessageDraft, getProductConversation, listProductConversations, sendProductMessage } from "@/services/product-messages";
import { makeBase, makeClient, makeLender, makeProduct, resetDb } from "./helpers";

let active: Actor | null = null;
vi.mock("@/lib/auth/actor", async (load) => ({
  ...await load<typeof import("@/lib/auth/actor")>(),
  getActor: async () => active,
  requireActor: async () => {
    if (!active) throw new AppError("UNAUTHENTICATED", "Authentification requise.");
    return active;
  },
}));

beforeEach(async () => { active = null; await resetDb(); });
afterEach(async () => {
  for (const { storageKey } of await db.productMessagePhoto.findMany({ select: { storageKey: true } })) {
    await storage().delete(storageKey);
  }
});

async function fixture() {
  const { category, city } = await makeBase();
  const { lender, actor: owner } = await makeLender(city.id);
  const { actor: client } = await makeClient();
  const product = await makeProduct(lender.id, category.id, city.id);
  return { product, owner, client, city, category };
}

const png = () => new File([Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZZkAAAAASUVORK5CYII=", "base64"))], "article.png", { type: "image/png" });

async function post(actor: Actor | null, fields: Record<string, string>, photos: File[] = []) {
  active = actor;
  const form = new FormData();
  form.set("requestId", randomUUID());
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  for (const photo of photos) form.append("photos", photo);
  return POST(new NextRequest("http://localhost:3000/api/product-messages", { method: "POST", body: form }), { params: Promise.resolve({}) });
}

function photoResponse(actor: Actor | null, key: string) {
  active = actor;
  return getFile(new NextRequest("http://localhost:3000/api/files/" + key), { params: Promise.resolve({ path: key.split("/") }) });
}

it("ouvre un seul fil avant réservation, notifie les deux parties et livre la photo privée", async () => {
  const { client, owner, product } = await fixture();
  expect(await getMessageDraft(client, product.id)).toMatchObject({ existingId: undefined });
  expect(await db.productConversation.count()).toBe(0);
  const sent = await post(client, { productId: product.id, body: "Puis-je voir une photo récente ?" });
  expect(sent.status).toBe(201);
  const { data: { conversationId } } = await sent.json();
  expect((await getMessageDraft(client, product.id))?.existingId).toBe(conversationId);
  expect((await listProductConversations(owner)).rows[0]?.id).toBe(conversationId);
  expect((await post(owner, { conversationId, body: "" }, [png()])).status).toBe(201);
  const thread = await getProductConversation(client, conversationId);
  expect(thread?.messages).toHaveLength(2);
  const photoKey = thread!.messages.find((m) => m.authorId === owner.userId)!.photos[0].storageKey;
  expect(photoKey).toMatch(/^private\/product-messages\//);
  for (const actor of [client, owner]) {
    const photo = await photoResponse(actor, photoKey);
    expect(photo.status).toBe(200);
    expect(photo.headers.get("cache-control")).toContain("no-store");
    expect(photo.headers.get("content-type")).toBe("image/png");
    expect(new Uint8Array(await photo.arrayBuffer())).toEqual(new Uint8Array(await png().arrayBuffer()));
  }
  expect(await db.notification.count({ where: { userId: owner.userId, link: "/loueur/messages/" + conversationId, channel: "INTERNAL" } })).toBe(1);
  expect(await db.notification.count({ where: { userId: client.userId, link: "/mes-messages/" + conversationId, channel: "INTERNAL" } })).toBe(1);
  expect(await db.reservation.count()).toBe(0);
});

it("isole les clients, les entreprises et leurs équipes, y compris pour les photos", async () => {
  const { client, owner, product, city } = await fixture();
  const { actor: otherClient } = await makeClient();
  const { actor: otherLender } = await makeLender(city.id);
  const { conversationId } = await sendProductMessage(client, { productId: product.id }, randomUUID(), "Cette photo correspond-elle à votre article ?", [png()]);
  const key = (await db.productMessagePhoto.findFirstOrThrow()).storageKey;
  const unauth = await post(null, { productId: product.id, body: "Bonjour" });
  expect(unauth.status).toBe(401);
  expect((await photoResponse(null, key)).status).toBe(403);
  for (const actor of [otherClient, otherLender]) {
    expect((await listProductConversations(actor)).rows).toHaveLength(0);
    expect(await getProductConversation(actor, conversationId)).toBeNull();
    expect((await post(actor, { conversationId, body: "Bonjour" })).status).toBe(404);
    expect((await photoResponse(actor, key)).status).toBe(403);
  }
  for (const [code, allowed] of [["ORDER_MANAGER", true], ["FINANCE_MANAGER", false]] as const) {
    const role = await db.role.findUniqueOrThrow({ where: { key: "SYSTEM:" + code } });
    const member = await db.user.create({ data: { firstName: "Equipe", lastName: code, email: code + "@test.ci", passwordHash: "x", accountType: "LENDER" } });
    await db.lenderMember.create({ data: { lenderId: owner.lenderId!, userId: member.id, roleId: role.id } });
    const actor = (await loadActor(member.id))!;
    expect((await photoResponse(actor, key)).status).toBe(allowed ? 200 : 403);
    expect((await post(actor, { conversationId, body: "Réponse de l’équipe" })).status).toBe(allowed ? 201 : 403);
  }
});

it("regroupe les envois simultanés et déduplique les reprises, photos et notifications comprises", async () => {
  const { client, owner, product } = await fixture();
  const other = await makeClient();
  const requestId = randomUUID();
  const [a, b, c] = await Promise.all([
    sendProductMessage(client, { productId: product.id }, requestId, "Bonjour", [png()]),
    sendProductMessage(client, { productId: product.id }, requestId, "Bonjour", [png()]),
    sendProductMessage(client, { productId: product.id }, randomUUID(), "Et quelles dimensions ?", []),
  ]);
  expect([b, c]).toEqual([a, a]);
  expect(await db.productConversation.count()).toBe(1);
  expect(await db.productMessage.count()).toBe(2);
  expect(await db.productMessagePhoto.count()).toBe(1);
  expect(await db.notification.count({ where: { userId: owner.userId, type: "product.message", channel: "INTERNAL" } })).toBe(2);
  const separate = await sendProductMessage(other.actor, { productId: product.id }, randomUUID(), "Quelle taille ?", []);
  expect(separate.conversationId).not.toBe(a.conversationId);
  expect((await listProductConversations(client)).rows.map((t) => t.id)).toEqual([a.conversationId]);
});

it("valide le contenu et la publication avant de créer la conversation", async () => {
  const { client, owner, product } = await fixture();
  const target = { productId: product.id };
  expect((await post(owner, { ...target, body: "Bonjour" })).status).toBe(403);
  expect((await post(client, { ...target, body: " " })).status).toBe(422);
  expect((await post(client, { ...target, body: "a".repeat(2001) })).status).toBe(422);
  expect((await post(client, target, [png(), png(), png(), png()])).status).toBe(422);
  const removed = vi.spyOn(storage(), "delete");
  try {
    expect((await post(client, target, [png(), new File(["texte"], "article.jpg", { type: "image/jpeg" })])).status).toBe(422);
    expect(removed).toHaveBeenCalledTimes(1);
  } finally {
    removed.mockRestore();
  }
  await db.product.update({ where: { id: product.id }, data: { status: "DRAFT" } });
  expect(await getMessageDraft(client, product.id)).toBeNull();
  expect((await post(client, { ...target, body: "Bonjour" })).status).toBe(404);
  expect(await db.productConversation.count()).toBe(0);
  expect(await db.productMessagePhoto.count()).toBe(0);
});
