"use client";

import { animate, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

/**
 * Animates an integer from its previous value to `target` whenever `target` changes.
 * First render shows the real value immediately: the count-up marks a *change*, not page load.
 */
export function useCountUp(target: number, durationS = 0.9): number {
  const reduce = useReducedMotion();
  const [value, setValue] = useState(target);
  const previous = useRef(target);

  useEffect(() => {
    const from = previous.current;
    previous.current = target;
    if (from === target) return;
    if (reduce) {
      setValue(target);
      return;
    }
    const controls = animate(from, target, {
      duration: durationS,
      ease: [0.2, 0, 0, 1],
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [target, reduce, durationS]);

  return value;
}
