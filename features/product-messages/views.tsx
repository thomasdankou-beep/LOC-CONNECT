import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Pagination } from "@/components/ui/pagination";
import { Photo } from "@/components/ui/photo";
import { ArrowLeft, ChatCircleText } from "@/components/ui/icons";
import { actorName, type Actor } from "@/lib/auth/actor";
import { formatDateTime } from "@/lib/dates";
import { getProductConversation, listProductConversations } from "@/services/product-messages";
import { ProductMessageForm, RefreshMessages } from "./message-form";

const inboxPath = (actor: Actor) => actor.accountType === "CLIENT" ? "/mes-messages" : "/loueur/messages";

export async function ProductInbox({ actor, page }: { actor: Actor; page: number }) {
  const result = await listProductConversations(actor, page);
  const client = actor.accountType === "CLIENT";
  const base = inboxPath(actor);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={client ? "Mes messages" : "Messages clients"} />
      <RefreshMessages />
      {result.rows.length === 0 ? (
        <EmptyState icon={<ChatCircleText size={24} />} title="Aucune conversation"
          description={client ? "Pour poser une question ou demander une photo, ouvrez la fiche d’un article et sélectionnez « Contacter le loueur »." : "Les questions des clients sur vos articles apparaîtront ici."}
          action={client && <Link href="/catalogue" className="font-medium text-royal-ink">Voir le catalogue</Link>} />
      ) : (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {result.rows.map((thread) => (
            <li key={thread.id}>
              <Link className="block rounded-control p-4 hover:bg-surface-2" href={base + "/" + thread.id}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <span className="min-w-0 break-words font-semibold text-ink">{thread.product.name}</span>
                  <time dateTime={thread.updatedAt.toISOString()} className="text-xs text-muted">{formatDateTime(thread.updatedAt)}</time>
                </div>
                <p className="mt-1 text-sm font-medium text-ink">{client ? thread.lender.companyName : actorName(thread.client)}</p>
                <p className="mt-1 truncate text-sm text-muted">{thread.messages[0]?.body || "Photo jointe"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath={base} />
    </div>
  );
}

export async function ProductThread({ actor, id, page }: { actor: Actor; id: string; page: number }) {
  const thread = await getProductConversation(actor, id, page);
  if (!thread) notFound();
  const client = actor.accountType === "CLIENT";
  const base = inboxPath(actor);
  const available = !thread.product.deletedAt && thread.product.status === "PUBLISHED" && thread.lender.status === "APPROVED";
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={thread.product.name} description={client ? thread.lender.companyName : actorName(thread.client)}
        back={<Link href={base} className="mb-2 inline-flex items-center gap-1 text-sm text-royal-ink"><ArrowLeft size={16} /> Messages</Link>}
        actions={available && <Link href={"/produits/" + thread.product.slug} className="text-sm font-medium text-royal-ink hover:underline">Voir l’article</Link>} />
      <RefreshMessages />
      <ol aria-label="Historique des messages" className="mb-5 space-y-3">
        {thread.messages.map((message) => {
          const fromClient = message.authorId === thread.clientId;
          const sameSide = client === fromClient;
          const author = message.authorId === actor.userId ? "Vous" : client && !fromClient ? thread.lender.companyName : actorName(message.author);
          return (
            <li key={message.id} className={"w-fit max-w-[92%] rounded-card border border-line p-3 sm:max-w-[80%] sm:p-4 " + (sameSide ? "ml-auto bg-royal-soft" : "bg-surface")}>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-sm font-semibold text-ink">{author}</span>
                <time dateTime={message.createdAt.toISOString()} className="text-xs text-muted">{formatDateTime(message.createdAt)}</time>
              </div>
              {message.body && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] text-sm leading-relaxed text-ink">{message.body}</p>}
              {message.photos.length > 0 && <ul className="mt-2 flex flex-wrap gap-2">
                {message.photos.map((photo, index) => {
                  const url = "/api/files/" + photo.storageKey;
                  const label = "Photo " + (index + 1) + " de " + thread.product.name;
                  return <li key={photo.storageKey}><a href={url} target="_blank" rel="noopener noreferrer" aria-label={"Agrandir · " + label}>
                    <Photo src={url} alt={label} w={160} h={120} className="h-24 w-32 rounded-control border border-line bg-surface object-cover sm:h-28 sm:w-40" />
                  </a></li>;
                })}
              </ul>}
            </li>
          );
        })}
      </ol>
      <Pagination page={thread.page} totalPages={thread.totalPages} basePath={base + "/" + id} />
      <div className="mt-5">
        {thread.lender.status === "APPROVED" ? <ProductMessageForm key={id} target={{ conversationId: id }} basePath={base} /> : <Notice tone="info">Ce loueur est actuellement indisponible. Vous pouvez consulter les messages précédents.</Notice>}
      </div>
    </div>
  );
}
