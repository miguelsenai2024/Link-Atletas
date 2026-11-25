"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";

import "./MotionAccordion.css";

export interface MotionAccordionItem {
  question: React.ReactNode;
  answer: React.ReactNode;
}

export interface MotionAccordionProps {
  items: MotionAccordionItem[];
  /** @default 10 */
  gap?: number;
  className?: string;
}

function AccordionItem({
  item,
  isOpen,
  onToggle,
  itemId,
  panelId,
}: {
  item: MotionAccordionItem;
  isOpen: boolean;
  onToggle: () => void;
  itemId: string;
  panelId: string;
}) {
  const reducedMotion = useReducedMotion();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [contentH, setContentH] = React.useState(0);

  React.useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContentH(el.scrollHeight));
    ro.observe(el);
    setContentH(el.scrollHeight);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      layout={!reducedMotion}
      className="motion-accordion__item"
      transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 28, mass: 0.9 }}
      animate={{ scale: reducedMotion || isOpen ? 1 : 0.985 }}
      initial={false}
      style={{ originX: 0.5, originY: 0 }}
    >
      <button
        id={itemId}
        type="button"
        aria-controls={panelId}
        aria-expanded={isOpen}
        onClick={onToggle}
        className="motion-accordion__trigger"
      >
        <span className="motion-accordion__question">
          {item.question}
        </span>

        <motion.span
          aria-hidden="true"
          initial={false}
          animate={{
            rotate: isOpen ? 180 : 0,
            scale: isOpen ? 1.05 : 1,
          }}
          transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 28 }}
          className="motion-accordion__icon"
        >
          {isOpen ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 2"
              fill="none"
              aria-hidden
            >
              <path
                d="M1 1h12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              aria-hidden
            >
              <path
                d="M7 1v12M1 7h12"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
              />
            </svg>
          )}
        </motion.span>
      </button>

      <motion.div
        id={panelId}
        role="region"
        aria-hidden={!isOpen}
        inert={!isOpen}
        aria-labelledby={itemId}
        animate={{
          height: isOpen ? contentH : 0,
          opacity: isOpen ? 1 : 0,
        }}
        initial={false}
        transition={reducedMotion ? { duration: 0 } : {
          height: { type: "spring", stiffness: 340, damping: 34, mass: 0.9 },
          opacity: { duration: 0.2, ease: "easeOut" },
        }}
        style={{ overflow: "hidden" }}
      >
        <motion.div
          ref={contentRef}
          animate={{ y: reducedMotion || isOpen ? 0 : -8 }}
          transition={reducedMotion ? { duration: 0 } : {
            type: "spring",
            stiffness: 360,
            damping: 30,
            mass: 0.8,
          }}
          className="motion-accordion__content"
        >
          <p className="motion-accordion__answer">
            {item.answer}
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export function MotionAccordion({
  items,
  gap = 10,
  className,
}: MotionAccordionProps) {
  const rawId = React.useId();
  const baseId = `accordion-${rawId.replace(/:/g, "")}`;

  const [openIndex, setOpenIndex] = React.useState<number | null>(null);

  const toggle = (i: number) => setOpenIndex((prev) => (prev === i ? null : i));

  return (
    <div className={["motion-accordion", className].filter(Boolean).join(" ")}>
      <div className="motion-accordion__list" style={{ gap }}>
        {items.map((item, i) => (
          <AccordionItem
            key={i}
            item={item}
            isOpen={openIndex === i}
            onToggle={() => toggle(i)}
            itemId={`${baseId}-trigger-${i}`}
            panelId={`${baseId}-panel-${i}`}
          />
        ))}
      </div>
    </div>
  );
}