import { SIGNATURE_HEIGHT, SIGNATURE_WIDTH, type Signature } from "@/lib/signature";

export function SignatureTrace({ strokes, className }: { strokes: Signature; className?: string }) {
  return (
    <svg viewBox={`0 0 ${SIGNATURE_WIDTH} ${SIGNATURE_HEIGHT}`} preserveAspectRatio="none" className={className} aria-hidden>
      <g stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {strokes.map((stroke, index) => stroke.length === 1
          ? <circle key={index} cx={stroke[0][0]} cy={stroke[0][1]} r={1} fill="currentColor" />
          : <polyline key={index} points={stroke.map(([x, y]) => `${x},${y}`).join(" ")} />)}
      </g>
    </svg>
  );
}
