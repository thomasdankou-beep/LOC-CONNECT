import { cn } from "@/lib/cn";
import { Check } from "@/components/ui/icons";

const STEPS = ["Panier", "Récapitulatif", "Paiement", "Confirmation"];

export function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto text-sm" aria-label="Étapes de la réservation">
      {STEPS.map((s, i) => (
        <li key={s} className="flex shrink-0 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={cn("flex size-7 items-center justify-center rounded-full text-xs font-semibold", i < current ? "bg-success text-white" : i === current ? "bg-royal text-white" : "bg-surface-2 text-muted")}>
            {i < current ? <Check size={14} weight="bold" /> : i + 1}
          </span>
          <span className={cn(i === current ? "font-semibold text-ink" : "text-muted")}>{s}</span>
          {i < STEPS.length - 1 && <span className="mx-1 h-px w-6 bg-line sm:w-10" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
