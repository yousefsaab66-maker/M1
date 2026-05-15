"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: "left" | "center";
}

export function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: SectionTitleProps) {
  const ref = useRef<HTMLDivElement>(null);
  /** `useInView` can be true on the client while SSR assumed false → hydration mismatch. Gate until after mount. */
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const inViewRaw = useInView(ref, { once: true, margin: "-15% 0px" });
  const inView = hasMounted && inViewRaw;
  const reduceRaw = useReducedMotion();
  const reduce = hasMounted && reduceRaw;
  const initial = reduce ? false : { opacity: 0, y: 30 };
  const animate = reduce
    ? undefined
    : inView
      ? { opacity: 1, y: 0 }
      : { opacity: 0, y: 30 };
  return (
    <div
      ref={ref}
      className={`mx-auto max-w-3xl px-6 ${align === "center" ? "text-center" : "text-start"}`}
    >
      {eyebrow && (
        <motion.p
          className="eyebrow"
          initial={initial}
          animate={animate}
          transition={{ duration: 0.9, ease: [0.22, 0.61, 0.36, 1] }}
        >
          {eyebrow}
        </motion.p>
      )}
      <motion.h2
        className="font-display mt-4 text-4xl leading-[1.05] md:text-5xl lg:text-6xl"
        initial={initial}
        animate={animate}
        transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1], delay: 0.05 }}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          className="mx-auto mt-5 max-w-xl text-base leading-relaxed opacity-80"
          initial={initial}
          animate={animate}
          transition={{ duration: 1.1, ease: [0.22, 0.61, 0.36, 1], delay: 0.15 }}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

export function FadeIn({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const inViewRaw = useInView(ref, { once: true, margin: "-15% 0px" });
  const inView = hasMounted && inViewRaw;
  const reduceRaw = useReducedMotion();
  const reduce = hasMounted && reduceRaw;
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      animate={
        reduce
          ? undefined
          : inView
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 28 }
      }
      transition={{ duration: 1.05, ease: [0.22, 0.61, 0.36, 1], delay }}
    >
      {children}
    </motion.div>
  );
}
