"use client";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/cn";

/** Rubber stamp that lands on a blocked card with a short thud. Decorative: the status pill carries the meaning. */
export function Stamp({ text, tone = "block", className }: { text: string; tone?: "block" | "wall"; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden
      initial={reduce ? { opacity: 1, scale: 1, rotate: -8 } : { opacity: 0, scale: 2.2, rotate: -14 }}
      animate={{ opacity: 1, scale: 1, rotate: -8 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 22, mass: 0.9 }}
      className={cn(
        "pointer-events-none select-none rounded-md border-[3px] px-3 py-1 font-display text-2xl font-extrabold uppercase leading-none tracking-wider sm:text-3xl",
        tone === "block" ? "border-block text-block" : "border-wall text-wall",
        className,
      )}
    >
      {text}
    </motion.div>
  );
}
