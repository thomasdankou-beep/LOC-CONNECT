"use client";

import { useId, useState } from "react";
import { addDays, parseDate, toISODate } from "@/lib/dates";

type Props = {
  start?: string;
  end?: string;
  min: string;
  controlClass: string;
  labelClass: string;
  className?: string;
};

export function SearchDateFields({ start, end, min, controlClass, labelClass, className }: Props) {
  const id = useId();
  const lastDay = start && end && start < end ? toISODate(addDays(parseDate(end), -1)) : undefined;
  const [multiple, setMultiple] = useState(Boolean(lastDay && start && lastDay > start));
  const [first, setFirst] = useState(start ?? "");
  const [last, setLast] = useState(lastDay && lastDay !== start ? lastDay : "");
  const earliestLast = first && /^\d{4}-\d{2}-\d{2}$/.test(first) ? toISODate(addDays(parseDate(first), 1)) : min;

  return (
    <fieldset className={className}>
      <legend className={labelClass}>Durée de location</legend>
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name="dateMode" value="single" checked={!multiple} onChange={() => setMultiple(false)} />
          Une journée
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="dateMode" value="multiple" checked={multiple} onChange={() => setMultiple(true)} />
          Plusieurs jours
        </label>
      </div>
      <div className={multiple ? "grid gap-3 sm:grid-cols-2" : ""}>
        <div>
          <label htmlFor={id + "-first"} className={labelClass}>{multiple ? "Premier jour" : "Jour de location"}</label>
          <input id={id + "-first"} name="rentalStart" type="date" min={min} value={first} required={multiple && Boolean(last)} onChange={(event) => setFirst(event.target.value)} className={controlClass} />
        </div>
        {multiple && (
          <div>
            <label htmlFor={id + "-last"} className={labelClass}>Dernier jour inclus</label>
            <input id={id + "-last"} name="rentalLast" type="date" min={earliestLast} value={last} required={Boolean(first)} onChange={(event) => setLast(event.target.value)} className={controlClass} />
          </div>
        )}
      </div>
    </fieldset>
  );
}
