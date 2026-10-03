import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./states";

export type Column<T> = { header: string; cell: (row: T) => ReactNode; className?: string; align?: "left" | "right" };

/**
 * Tableau de données. Sous 768 px, chaque ligne devient une fiche empilée « libellé : valeur » :
 * aucune colonne n'est cachée et la page ne défile jamais horizontalement.
 */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty?: { title: string; description?: string; action?: ReactNode } }) {
  if (rows.length === 0) return <EmptyState title={empty?.title ?? "Aucun résultat"} description={empty?.description} action={empty?.action} />;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <div className="md:overflow-x-auto">
        <table className="block w-full text-left text-sm md:table">
          <thead className="sr-only md:not-sr-only md:table-header-group">
            <tr className="md:border-b md:border-line md:bg-surface-2/60">
              {columns.map((c) => (
                <th key={c.header} scope="col" className={cn("whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted", c.align === "right" && "text-right", c.className)}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="block divide-y divide-line md:table-row-group">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="block px-4 py-3 transition hover:bg-surface-2/40 md:table-row md:p-0">
                {columns.map((c) => (
                  <td key={c.header} data-label={c.header} className={cn("flex items-start justify-between gap-4 py-1.5 text-right before:shrink-0 before:text-left before:text-xs before:font-semibold before:uppercase before:tracking-wide before:text-muted before:content-[attr(data-label)] md:table-cell md:px-4 md:py-3 md:text-left md:align-middle md:before:content-none", "text-ink", c.align === "right" && "md:text-right md:tabular-nums", c.className)}>
                    <span className="min-w-0 max-w-[65%] md:max-w-none">{c.cell(row)}</span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
