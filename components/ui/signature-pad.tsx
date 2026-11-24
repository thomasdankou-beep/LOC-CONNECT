"use client";

import { useRef, type PointerEvent } from "react";
import { Button } from "./button";
import { SignatureTrace } from "./signature-trace";
import { MAX_SIGNATURE_POINTS, MAX_SIGNATURE_STROKES, SIGNATURE_HEIGHT, SIGNATURE_WIDTH, type Signature } from "@/lib/signature";

export function SignaturePad({ label, strokes, onChange }: { label: string; strokes: Signature; onChange: (value: Signature) => void }) {
  const activePointer = useRef<number | null>(null);
  const draft = useRef(strokes);

  function update(value: Signature) {
    draft.current = value;
    onChange(value);
  }

  function position(event: PointerEvent<HTMLDivElement>): Signature[number][number] {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.round(SIGNATURE_WIDTH * (event.clientX - rect.left) / rect.width);
    const y = Math.round(SIGNATURE_HEIGHT * (event.clientY - rect.top) / rect.height);
    return [Math.max(0, Math.min(x, SIGNATURE_WIDTH)), Math.max(0, Math.min(y, SIGNATURE_HEIGHT))];
  }

  function start(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== null || event.button !== 0 || draft.current.length >= MAX_SIGNATURE_STROKES) return;
    if (draft.current.reduce((n, line) => n + line.length, 0) >= MAX_SIGNATURE_POINTS) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    activePointer.current = event.pointerId;
    update([...draft.current, [position(event)]]);
  }

  function draw(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current !== event.pointerId || draft.current.reduce((n, line) => n + line.length, 0) >= MAX_SIGNATURE_POINTS) return;
    const point = position(event);
    const last = draft.current.at(-1)!;
    const [x, y] = last.at(-1)!;
    if (x === point[0] && y === point[1]) return;
    update([...draft.current.slice(0, -1), [...last, point]]);
  }

  function stop(event: PointerEvent<HTMLDivElement>) {
    if (activePointer.current === event.pointerId) activePointer.current = null;
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{label}</legend>
      <p className="text-xs text-muted">Signez au doigt ou à la souris dans le cadre.</p>
      <div
        className="h-32 touch-none select-none rounded-control border border-line bg-white text-navy"
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={(event) => { draw(event); stop(event); }}
        onPointerCancel={stop}
        onLostPointerCapture={stop}
      >
        <SignatureTrace strokes={strokes} className="block size-full pointer-events-none" />
      </div>
      <Button size="sm" variant="ghost" disabled={!strokes.length} onClick={() => { activePointer.current = null; update([]); }}>Effacer la signature</Button>
    </fieldset>
  );
}
