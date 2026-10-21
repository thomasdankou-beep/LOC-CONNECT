"use client";

import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";

/** Apparition à l'entrée dans le viewport : guide la lecture de haut en bas. Désactivée si l'utilisateur réduit les animations. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-60px" }} transition={{ type: "spring", stiffness: 100, damping: 20, delay }}>
      {children}
    </motion.div>
  );
}
