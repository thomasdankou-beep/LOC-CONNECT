import { FileText } from "@/components/ui/icons";

export function Paperclip({ href, name }: { href: string; name: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 max-w-full items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm text-ink transition hover:bg-surface-2">
      <FileText size={16} className="shrink-0 text-royal-ink" />
      <span className="truncate">{name}</span>
    </a>
  );
}
